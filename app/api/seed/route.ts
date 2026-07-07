import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'

// POST /api/seed — 生成种子数据
export async function POST(request: NextRequest) {
  try {
    if (process.env.ALLOW_SEED !== 'true') {
      return NextResponse.json({ error: '种子数据生成未启用' }, { status: 403 })
    }

    // 清理旧数据
    await db.compensationRecord.deleteMany()
    await db.approvalRecord.deleteMany()
    await db.scanRecord.deleteMany()
    await db.inventory.deleteMany()
    await db.exceptionTicket.deleteMany()
    await db.waybillSnapshot.deleteMany()
    await db.syncLog.deleteMany()
    await db.user.deleteMany()
    await db.qCRule.deleteMany()
    await db.approvalThresholdConfig.deleteMany()
    await db.timeoutConfig.deleteMany()

    const hashedPassword = await bcrypt.hash('123456', 10)

    // 创建用户
    const users = await Promise.all([
      db.user.create({ data: { username: 'admin', password: hashedPassword, name: '系统管理员', role: 'ADMIN' } }),
      db.user.create({ data: { username: 'qc_supervisor', password: hashedPassword, name: '品控主管张三', role: 'QC_SUPERVISOR' } }),
      db.user.create({ data: { username: 'approver1_a', password: hashedPassword, name: '一级审批人李四', role: 'LEVEL1_APPROVER' } }),
      db.user.create({ data: { username: 'approver1_b', password: hashedPassword, name: '一级审批人王五', role: 'LEVEL1_APPROVER' } }),
      db.user.create({ data: { username: 'approver1_c', password: hashedPassword, name: '一级审批人赵六', role: 'LEVEL1_APPROVER' } }),
      db.user.create({ data: { username: 'approver2_a', password: hashedPassword, name: '二级审批人钱七', role: 'LEVEL2_APPROVER' } }),
      db.user.create({ data: { username: 'approver2_b', password: hashedPassword, name: '二级审批人孙八', role: 'LEVEL2_APPROVER' } }),
      db.user.create({ data: { username: 'operator_a', password: hashedPassword, name: '操作员周九', role: 'OPERATOR' } }),
      db.user.create({ data: { username: 'operator_b', password: hashedPassword, name: '操作员吴十', role: 'OPERATOR' } }),
      db.user.create({ data: { username: 'operator_c', password: hashedPassword, name: '操作员郑十一', role: 'OPERATOR' } }),
    ])

    // 创建审批阈值配置
    await db.approvalThresholdConfig.createMany({
      data: [
        { name: '小额工单', minAmount: 0, maxAmount: 500, requiredLevels: ['LEVEL1'] },
        { name: '中额工单', minAmount: 500, maxAmount: 3000, requiredLevels: ['LEVEL1', 'LEVEL2'] },
        { name: '大额工单', minAmount: 3000, maxAmount: null, requiredLevels: ['LEVEL1', 'LEVEL2'] },
      ],
    })

    // 创建超时配置
    await db.timeoutConfig.createMany({
      data: [
        { configKey: 'PENDING_APPROVAL', timeoutMinutes: 48 * 60, action: { type: 'escalate', target: 'LEVEL2_APPROVING' }, isActive: true },
        { configKey: 'LEVEL1_APPROVAL', timeoutMinutes: 24 * 60, action: { type: 'escalate', target: 'LEVEL2_APPROVING' }, isActive: true },
        { configKey: 'LEVEL2_APPROVAL', timeoutMinutes: 24 * 60, action: { type: 'auto_reject', target: 'CLOSED' }, isActive: true },
        { configKey: 'QC_HOLD', timeoutMinutes: 4 * 60, action: { type: 'escalate', target: 'LEVEL2_APPROVING' }, isActive: true },
      ],
    })

    // 创建品控规则
    await db.qCRule.createMany({
      data: [
        { name: '数量差异检测', exceptionSubType: 'QC_QUANTITY_MISMATCH', triggerCondition: { type: 'quantity_diff', threshold: 0.05, operator: 'gt' }, severity: 'HIGH', autoCreateTicket: true, defaultApprovalLevel: 'LEVEL1' },
        { name: '外观破损检测', exceptionSubType: 'QC_APPEARANCE_DAMAGE', triggerCondition: { type: 'damage_level', minLevel: 2 }, severity: 'MEDIUM', autoCreateTicket: true, defaultApprovalLevel: 'LEVEL1' },
        { name: '规格不符检测', exceptionSubType: 'QC_SPEC_MISMATCH', triggerCondition: { type: 'spec_mismatch', fields: ['skuSpec'] }, severity: 'HIGH', autoCreateTicket: true, defaultApprovalLevel: 'LEVEL1' },
        { name: '标签错误检测', exceptionSubType: 'QC_LABEL_ERROR', triggerCondition: { type: 'label_error', checkFields: ['externalCode', 'skuCode'] }, severity: 'MEDIUM', autoCreateTicket: true, defaultApprovalLevel: 'LEVEL1' },
        { name: '批次异常检测', exceptionSubType: 'QC_BATCH_ABNORMAL', triggerCondition: { type: 'batch_abnormal', matchMode: 'mismatch' }, severity: 'CRITICAL', autoCreateTicket: true, defaultApprovalLevel: 'LEVEL2' },
      ],
    })

    // 创建运单快照（模拟从 V2 同步的数据）
    const waybills = []
    const stores = ['朝阳店', '海淀店', '丰台店', '西城店', '东城店', '通州店', '大兴店', '石景山店']
    const recipients = ['张三', '李四', '王五', '赵六', '钱七', '孙八', '周九', '吴十', '郑十一', '刘十二']

    for (let i = 0; i < 50; i++) {
      const store = stores[i % stores.length]
      const recipient = recipients[i % recipients.length]
      const externalCode = `WB${String(20260001 + i).padStart(8, '0')}`
      const waybill = await db.waybillSnapshot.create({
        data: {
          v2OrderId: `v2-order-${i + 1}`,
          externalCode,
          storeName: store,
          recipientName: recipient,
          recipientPhone: `138${String(10000000 + i).slice(0, 8)}`,
          recipientAddress: `北京市${store}某某路${i + 1}号`,
          totalAmount: Math.floor(Math.random() * 5000) + 100,
          skuSummary: [
            { skuCode: `SKU-${String(i + 1).padStart(3, '0')}-A`, skuName: `商品A-${i + 1}`, quantity: 10, skuSpec: '500ml' },
            { skuCode: `SKU-${String(i + 1).padStart(3, '0')}-B`, skuName: `商品B-${i + 1}`, quantity: 5, skuSpec: '1L' },
          ],
        },
      })
      waybills.push(waybill)
    }

    // 创建异常工单（200+）
    const exceptionTypes = ['LOST', 'DAMAGED', 'REJECTED_BY_CUSTOMER', 'TIMEOUT_DELIVERY', 'WRONG_ADDRESS', 'QC_QUANTITY_MISMATCH', 'QC_APPEARANCE_DAMAGE', 'QC_SPEC_MISMATCH', 'QC_LABEL_ERROR', 'QC_BATCH_ABNORMAL']
    const statuses = ['PENDING_APPROVAL', 'LEVEL1_APPROVING', 'LEVEL2_APPROVING', 'EXECUTING', 'COMPLETED', 'CLOSED']
    const statusDistribution = [30, 35, 25, 40, 50, 20] // 200 total

    const approver1s = users.filter(u => u.role === 'LEVEL1_APPROVER')
    const approver2s = users.filter(u => u.role === 'LEVEL2_APPROVER')
    const operators = users.filter(u => u.role === 'OPERATOR' || u.role === 'QC_SUPERVISOR')

    let ticketCount = 0
    for (let si = 0; si < statuses.length; si++) {
      const count = statusDistribution[si]
      for (let j = 0; j < count; j++) {
        const waybill = waybills[(ticketCount) % waybills.length]
        const type = exceptionTypes[ticketCount % exceptionTypes.length]
        const source = type.startsWith('QC_') ? 'SCAN_TRIGGERED' : 'MANUAL_REPORT'
        const operator = operators[ticketCount % operators.length]
        const approver1 = approver1s[ticketCount % approver1s.length]
        const approver2 = approver2s[ticketCount % approver2s.length]

        const targetStatus = statuses[si]
        const createdAt = new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000))

        let currentApproverId: string | null = null
        if (targetStatus === 'PENDING_APPROVAL') currentApproverId = null
        else if (targetStatus === 'LEVEL1_APPROVING') currentApproverId = approver1.id
        else if (targetStatus === 'LEVEL2_APPROVING') currentApproverId = approver2.id
        else currentApproverId = null

        const ticket = await db.exceptionTicket.create({
          data: {
            waybillSnapshotId: waybill.id,
            exceptionType: type as never,
            source: source as never,
            description: `${type}异常 - 种子工单 #${ticketCount + 1}`,
            severity: (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const)[ticketCount % 4],
            reportedById: operator.id,
            currentStatus: targetStatus as never,
            currentApproverId,
            amount: waybill.totalAmount,
            resubmitCount: targetStatus === 'CLOSED' ? Math.floor(Math.random() * 3) + 1 : 0,
            createdAt,
          },
        })

        // 审批记录：只创建已完成的审批历史
        // LEVEL1_APPROVING: 无审批记录（等待一级审批）
        // LEVEL2_APPROVING: LEVEL1 审批记录（一级已通过，等待二级审批）
        // EXECUTING/COMPLETED: LEVEL1 + LEVEL2 审批记录（两级都已通过）
        if (['LEVEL2_APPROVING', 'EXECUTING', 'COMPLETED'].includes(targetStatus)) {
          await db.approvalRecord.create({
            data: {
              ticketId: ticket.id,
              approverId: approver1.id,
              level: 'LEVEL1',
              result: 'APPROVED',
              comment: '一级审批通过 - 种子数据',
              createdAt: new Date(ticket.createdAt.getTime() + 3600000),
            },
          })
        }
        if (['EXECUTING', 'COMPLETED'].includes(targetStatus)) {
          await db.approvalRecord.create({
            data: {
              ticketId: ticket.id,
              approverId: approver2.id,
              level: 'LEVEL2',
              result: 'APPROVED',
              comment: '二级审批通过 - 种子数据',
              createdAt: new Date(ticket.createdAt.getTime() + 7200000),
            },
          })
        }
        if (targetStatus === 'CLOSED') {
          await db.approvalRecord.create({
            data: {
              ticketId: ticket.id,
              approverId: approver1.id,
              level: 'LEVEL1',
              result: 'REJECTED',
              comment: '审批拒绝 - 已达重提上限',
              createdAt: new Date(ticket.createdAt.getTime() + 3600000),
            },
          })
        }

        // 为已完成工单创建赔付记录
        if (statuses[si] === 'COMPLETED' && Math.random() > 0.3) {
          const lastApproval = await db.approvalRecord.findFirst({
            where: { ticketId: ticket.id },
            orderBy: { createdAt: 'desc' },
          })
          if (lastApproval) {
            await db.compensationRecord.create({
              data: {
                ticketId: ticket.id,
                approvalRecordId: lastApproval.id,
                direction: source === 'SCAN_TRIGGERED' ? 'FROM_SUPPLIER' : 'TO_CUSTOMER',
                amount: Math.floor(Math.random() * ticket.amount * 0.5),
                status: 'EXECUTED',
                remark: '种子赔付数据',
              },
            })
          }
        }

        // 为扫描触发的工单创建扫描记录
        if (source === 'SCAN_TRIGGERED') {
          await db.scanRecord.create({
            data: {
              waybillSnapshotId: waybill.id,
              skuCode: `SKU-${String((ticketCount % 50) + 1).padStart(3, '0')}-A`,
              skuName: `商品A-${(ticketCount % 50) + 1}`,
              ticketId: ticket.id,
              operatorId: operator.id,
              qcRuleId: null,
              scanResult: 'QC_HOLD',
              resultDetail: JSON.stringify({ reason: '种子扫描数据' }),
              batchStatus: statuses[si] === 'COMPLETED' ? 'RELEASED' : 'LOCKED',
              createdAt: ticket.createdAt,
            },
          })
        }

        ticketCount++
      }
    }

    // 创建同步日志
    for (let i = 0; i < 30; i++) {
      await db.syncLog.create({
        data: {
          requestId: `seed-${i}`,
          endpoint: '/api/external/waybills/validate',
          method: 'GET',
          requestSummary: `{"code":"WB${20260001 + i}"}`,
          responseStatus: 200,
          success: i < 27,
          durationMs: Math.floor(Math.random() * 500) + 50,
          createdAt: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)),
        },
      })
    }

    return NextResponse.json({
      success: true,
      stats: {
        users: users.length,
        waybills: waybills.length,
        tickets: ticketCount,
        message: `种子数据生成完成：${users.length} 个用户，${waybills.length} 个运单快照，${ticketCount} 个工单`,
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `种子数据生成失败: ${msg}` }, { status: 500 })
  }
}