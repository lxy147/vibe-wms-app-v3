import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { validateWaybill } from '@/lib/v2-client'
import { validateTransition } from '@/lib/state-machine'

// GET /api/tickets — 工单列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') || '20')))
    const status = searchParams.get('status')
    const exceptionType = searchParams.get('exceptionType')
    const source = searchParams.get('source')
    const waybillExternalCode = searchParams.get('waybillExternalCode')
    const search = searchParams.get('search')
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    const where: Record<string, unknown> = {}
    if (status) where.currentStatus = status
    if (exceptionType) where.exceptionType = exceptionType
    if (source) where.source = source
    if (waybillExternalCode) {
      where.waybillSnapshot = { externalCode: { contains: waybillExternalCode } }
    }
    if (search) {
      where.OR = [
        { waybillSnapshot: { externalCode: { contains: search } } },
        { waybillSnapshot: { storeName: { contains: search } } },
        { description: { contains: search } },
      ]
    }

    const orderBy: Record<string, string> = { [sortBy]: sortOrder }

    const [tickets, total] = await Promise.all([
      db.exceptionTicket.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy,
        include: {
          waybillSnapshot: { select: { id: true, externalCode: true, storeName: true, lastSyncedAt: true } },
          reportedBy: { select: { id: true, name: true } },
          currentApprover: { select: { id: true, name: true } },
          _count: { select: { approvalRecords: true, scanRecords: true } },
        },
      }),
      db.exceptionTicket.count({ where }),
    ])

    return NextResponse.json({
      tickets,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch {
    return NextResponse.json({ error: '获取工单列表失败' }, { status: 500 })
  }
}

// POST /api/tickets — 创建工单（手工上报）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { waybillExternalCode, exceptionType, description, severity, amount, reportedById } = body

    if (!waybillExternalCode || !exceptionType || !reportedById) {
      return NextResponse.json({ error: '缺少必填字段' }, { status: 400 })
    }

    // 1. 实时校验运单存在性（必须调用 V2）
    const waybillResult = await validateWaybill(waybillExternalCode)
    if (!waybillResult.success || !waybillResult.data) {
      return NextResponse.json({
        error: '运单校验失败',
        detail: waybillResult.error || 'V2 接口返回异常',
      }, { status: waybillResult.error?.includes('暂不可用') ? 503 : 404 })
    }

    const v2Waybill = waybillResult.data

    // 2. 确保本地快照存在
    let snapshot = await db.waybillSnapshot.findUnique({
      where: { v2OrderId: v2Waybill.id },
    })

    if (!snapshot) {
      snapshot = await db.waybillSnapshot.create({
        data: {
          v2OrderId: v2Waybill.id,
          externalCode: v2Waybill.externalCode,
          storeName: v2Waybill.storeName,
          recipientName: v2Waybill.recipientName,
          recipientPhone: v2Waybill.recipientPhone,
          recipientAddress: v2Waybill.recipientAddress,
          totalAmount: v2Waybill.totalAmount || amount || 0,
          lastSyncedAt: new Date(),
        },
      })
    }

    // 3. 检查重复上报（同运单 + 同类型 + 未关闭工单）
    const existingTicket = await db.exceptionTicket.findFirst({
      where: {
        waybillSnapshotId: snapshot.id,
        exceptionType: body.exceptionType as never,
        currentStatus: { notIn: ['COMPLETED', 'CLOSED'] },
      },
    })

    if (existingTicket) {
      return NextResponse.json({
        error: '该运单已存在同类型未关闭的异常工单',
        existingTicketId: existingTicket.id,
      }, { status: 409 })
    }

    // 4. 确定审批路径
    const ticketAmount = amount || snapshot.totalAmount || 0
    const thresholdConfig = await db.approvalThresholdConfig.findFirst({
      where: {
        isActive: true,
        minAmount: { lte: ticketAmount },
        OR: [
          { maxAmount: { gte: ticketAmount } },
          { maxAmount: null },
        ],
      },
      orderBy: { minAmount: 'asc' },
    })

    const requiredLevels = (thresholdConfig?.requiredLevels as string[]) || ['LEVEL1']
    const initialStatus = requiredLevels.includes('LEVEL2') && !requiredLevels.includes('LEVEL1')
      ? 'LEVEL2_APPROVING'
      : 'LEVEL1_APPROVING'

    // 5. 分配审批人
    const approverRole = initialStatus === 'LEVEL2_APPROVING' ? 'LEVEL2_APPROVER' : 'LEVEL1_APPROVER'
    const approver = await db.user.findFirst({
      where: { role: approverRole, isActive: true, id: { not: reportedById } },
    })

    // 6. 创建工单
    const ticket = await db.exceptionTicket.create({
      data: {
        waybillSnapshotId: snapshot.id,
        exceptionType: body.exceptionType,
        source: 'MANUAL_REPORT',
        description,
        severity: severity || 'MEDIUM',
        reportedById,
        currentStatus: initialStatus,
        currentApproverId: approver?.id || null,
        amount: ticketAmount,
      },
      include: {
        waybillSnapshot: { select: { externalCode: true, storeName: true } },
        reportedBy: { select: { name: true } },
        currentApprover: { select: { name: true } },
      },
    })

    return NextResponse.json({ ticket }, { status: 201 })
  } catch {
    return NextResponse.json({ error: '创建工单失败' }, { status: 500 })
  }
}