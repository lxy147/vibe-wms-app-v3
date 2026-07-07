import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { evaluateQCRules } from '@/lib/qc-engine'
import { validateSku, validateWaybill, getWaybillDetail } from '@/lib/v2-client'
import { getCurrentUser } from '@/lib/auth'

// POST /api/scan — 执行扫描操作
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const body = await request.json()
    const { waybillExternalCode, skuCode, actualQuantity, damageLevel } = body
    const operatorId = user.id

    if (!waybillExternalCode || !skuCode) {
      return NextResponse.json({ error: '缺少必填字段：运单号、SKU编码' }, { status: 400 })
    }

    // 1. 校验运单存在性（实时调用 V2）
    const waybillResult = await validateWaybill(waybillExternalCode)
    if (!waybillResult.success || !waybillResult.data) {
      return NextResponse.json({
        error: '运单校验失败',
        detail: waybillResult.error || 'V2 接口返回异常',
        v2Available: waybillResult.success,
      }, { status: waybillResult.error?.includes('暂不可用') ? 503 : 404 })
    }

    const v2Waybill = waybillResult.data

    // 2. 确保本地快照存在
    let snapshot = await db.waybillSnapshot.findUnique({
      where: { v2OrderId: v2Waybill.id },
    })

    if (!snapshot) {
      // 获取完整运单详情
      const detailResult = await getWaybillDetail(v2Waybill.id)
      if (detailResult.success && detailResult.data) {
        const detail = detailResult.data
        snapshot = await db.waybillSnapshot.create({
          data: {
            v2OrderId: detail.id,
            externalCode: detail.externalCode,
            storeName: detail.storeName,
            recipientName: detail.recipientName,
            recipientPhone: detail.recipientPhone,
            recipientAddress: detail.recipientAddress,
            totalAmount: detail.totalAmount || 0,
            skuSummary: detail.items as never,
            lastSyncedAt: new Date(),
          },
        })
      } else {
        // 降级：仅用基本信息创建快照
        snapshot = await db.waybillSnapshot.create({
          data: {
            v2OrderId: v2Waybill.id,
            externalCode: v2Waybill.externalCode,
            storeName: v2Waybill.storeName,
            recipientName: v2Waybill.recipientName,
            recipientPhone: v2Waybill.recipientPhone,
            recipientAddress: v2Waybill.recipientAddress,
            lastSyncedAt: new Date(),
          },
        })
      }
    }

    // 3. 校验 SKU 归属（实时调用 V2）
    const skuResult = await validateSku(v2Waybill.id, skuCode)
    if (!skuResult.success || !skuResult.data) {
      return NextResponse.json({
        error: 'SKU 校验失败',
        detail: skuResult.error || '该 SKU 不属于此运单',
      }, { status: 400 })
    }

    const v2Sku = skuResult.data

    // 4. 检查幂等性：是否存在未关闭的品控工单
    const existingTicket = await db.exceptionTicket.findFirst({
      where: {
        waybillSnapshotId: snapshot.id,
        source: 'SCAN_TRIGGERED',
        currentStatus: { notIn: ['COMPLETED', 'CLOSED'] },
        scanRecords: { some: { skuCode } },
      },
      include: { scanRecords: { where: { skuCode }, take: 1 } },
    })

    if (existingTicket) {
      // 幂等：仅追加扫描记录
      const scanRecord = await db.scanRecord.create({
        data: {
          waybillSnapshotId: snapshot.id,
          skuCode,
          skuName: v2Sku.skuName,
          ticketId: existingTicket.id,
          operatorId,
          scanResult: 'QC_HOLD',
          resultDetail: JSON.stringify({ reason: '重复扫描，该批次已存在未关闭品控工单' }),
          batchStatus: 'LOCKED',
        },
      })

      return NextResponse.json({
        scanRecord,
        existingTicket: { id: existingTicket.id },
        warning: '该批次已存在未关闭品控工单，已追加扫描记录，未创建新工单',
      }, { status: 200 })
    }

    // 5. 运行品控规则引擎
    const qcResult = await evaluateQCRules({
      skuCode,
      skuName: v2Sku.skuName,
      expectedQuantity: v2Sku.quantity,
      actualQuantity: actualQuantity || v2Sku.quantity,
      damageLevel,
      skuSpec: v2Sku.skuSpec,
      expectedSpec: v2Sku.skuSpec,
    })

    if (qcResult.passed) {
      // 品控通过
      const scanRecord = await db.scanRecord.create({
        data: {
          waybillSnapshotId: snapshot.id,
          skuCode,
          skuName: v2Sku.skuName,
          operatorId,
          scanResult: 'PASSED',
          resultDetail: JSON.stringify({ message: '品控通过' }),
          batchStatus: 'AVAILABLE',
        },
      })

      // 确保库存记录存在
      await db.inventory.upsert({
        where: {
          waybillSnapshotId_skuCode: {
            waybillSnapshotId: snapshot.id,
            skuCode,
          },
        },
        update: {},
        create: {
          skuCode,
          skuName: v2Sku.skuName,
          quantity: v2Sku.quantity,
          batchStatus: 'AVAILABLE',
          waybillSnapshotId: snapshot.id,
        },
      })

      return NextResponse.json({ scanRecord, passed: true })
    }

    // 6. 品控异常 — 锁定批次 + 创建工单
    const topRule = qcResult.matchedRules[0]

    const result = await db.$transaction(async (tx) => {
      // 确定审批级别
      const approvalLevel = topRule.defaultApprovalLevel

      // 查找对应审批人
      const approver = await tx.user.findFirst({
        where: {
          role: approvalLevel === 'LEVEL1' ? 'LEVEL1_APPROVER' : 'LEVEL2_APPROVER',
          isActive: true,
        },
      })

      // 创建工单
      const ticket = await tx.exceptionTicket.create({
        data: {
          waybillSnapshotId: snapshot!.id,
          exceptionType: topRule.exceptionSubType,
          source: 'SCAN_TRIGGERED',
          description: `品控异常：${topRule.ruleName} — ${topRule.reason}`,
          severity: topRule.severity,
          reportedById: operatorId,
          currentStatus: approvalLevel === 'LEVEL1' ? 'LEVEL1_APPROVING' : 'LEVEL2_APPROVING',
          currentApproverId: approver?.id || null,
          amount: snapshot!.totalAmount,
        },
      })

      // 创建扫描记录
      const scanRecord = await tx.scanRecord.create({
        data: {
          waybillSnapshotId: snapshot!.id,
          skuCode,
          skuName: v2Sku.skuName,
          ticketId: ticket.id,
          operatorId,
          qcRuleId: topRule.ruleId,
          scanResult: 'QC_HOLD',
          resultDetail: JSON.stringify({
            matchedRules: qcResult.matchedRules,
          }),
          batchStatus: 'LOCKED',
        },
      })

      // 锁定库存
      await tx.inventory.upsert({
        where: {
          waybillSnapshotId_skuCode: {
            waybillSnapshotId: snapshot!.id,
            skuCode,
          },
        },
        update: {
          batchStatus: 'LOCKED',
          ticketId: ticket.id,
        },
        create: {
          skuCode,
          skuName: v2Sku.skuName,
          quantity: v2Sku.quantity,
          batchStatus: 'LOCKED',
          waybillSnapshotId: snapshot!.id,
          ticketId: ticket.id,
        },
      })

      return { ticket, scanRecord }
    })

    return NextResponse.json({
      ticket: result.ticket,
      scanRecord: result.scanRecord,
      passed: false,
      matchedRules: qcResult.matchedRules,
    }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: '扫描操作失败', detail: error instanceof Error ? error.message : 'Unknown' }, { status: 500 })
  }
}

// GET /api/scan — 获取扫描记录列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') || '20')))
    const waybillExternalCode = searchParams.get('waybillExternalCode')
    const skuCode = searchParams.get('skuCode')
    const result = searchParams.get('result')

    const where: Record<string, unknown> = {}
    if (waybillExternalCode) {
      where.waybillSnapshot = { externalCode: { contains: waybillExternalCode } }
    }
    if (skuCode) where.skuCode = { contains: skuCode }
    if (result) where.scanResult = result

    const [records, total] = await Promise.all([
      db.scanRecord.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          waybillSnapshot: { select: { externalCode: true, storeName: true } },
          operator: { select: { name: true } },
          ticket: { select: { id: true, currentStatus: true } },
        },
      }),
      db.scanRecord.count({ where }),
    ])

    return NextResponse.json({
      records,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch {
    return NextResponse.json({ error: '获取扫描记录失败' }, { status: 500 })
  }
}