import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { validateTransition } from '@/lib/state-machine'
import { getCurrentUser } from '@/lib/auth'

// POST /api/tickets/[id]/execute — 执行联动
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const body = await request.json()
    const { actionType, compensationAmount, remark } = body

    const ticket = await db.exceptionTicket.findUnique({
      where: { id },
      include: { waybillSnapshot: true },
    })

    if (!ticket) {
      return NextResponse.json({ error: '工单不存在' }, { status: 404 })
    }

    if (ticket.currentStatus !== 'EXECUTING') {
      return NextResponse.json({ error: '工单当前不在执行状态' }, { status: 400 })
    }

    if (!validateTransition(ticket.currentStatus, 'COMPLETED')) {
      return NextResponse.json({ error: '不允许的状态转换' }, { status: 400 })
    }

    // 确定赔付方向
    const isQCException = ticket.source === 'SCAN_TRIGGERED' ||
      ticket.exceptionType.startsWith('QC_')
    const compensationDirection = isQCException ? 'FROM_SUPPLIER' : 'TO_CUSTOMER'

    // 事务保证一致性
    const result = await db.$transaction(async (tx) => {
      // 1. 更新工单状态
      await tx.exceptionTicket.update({
        where: { id },
        data: {
          currentStatus: 'COMPLETED',
          version: { increment: 1 },
        },
      })

      // 2. 创建执行审批记录
      const execRecord = await tx.approvalRecord.create({
        data: {
          ticketId: id,
          approverId: user.id,
          level: ticket.currentStatus === 'LEVEL2_APPROVING' ? 'LEVEL2' : 'LEVEL1',
          result: 'APPROVED',
          comment: `执行完成 — ${actionType || '常规处理'}${remark ? ` — ${remark}` : ''}`,
        },
      })

      // 3. 如果有赔付金额，创建赔付记录
      if (compensationAmount && compensationAmount > 0) {
        await tx.compensationRecord.create({
          data: {
            ticketId: id,
            approvalRecordId: execRecord.id,
            direction: compensationDirection,
            amount: compensationAmount,
            status: 'EXECUTED',
            remark: remark || actionType || '',
          },
        })
      }

      // 4. 解锁关联的库存批次
      await tx.inventory.updateMany({
        where: { ticketId: id, batchStatus: 'LOCKED' },
        data: { batchStatus: 'RELEASED' },
      })

      // 5. 解锁关联的扫描记录
      await tx.scanRecord.updateMany({
        where: { ticketId: id, batchStatus: 'LOCKED' },
        data: { batchStatus: 'RELEASED' },
      })

      return { execRecord }
    })

    return NextResponse.json({
      success: true,
      message: '执行完成',
      direction: compensationDirection,
    })
  } catch {
    return NextResponse.json({ error: '执行操作失败' }, { status: 500 })
  }
}