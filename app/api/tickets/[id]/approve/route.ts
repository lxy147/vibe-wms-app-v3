import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { validateTransition } from '@/lib/state-machine'
import { getCurrentUser } from '@/lib/auth'

// POST /api/tickets/[id]/approve — 审批操作
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
    const { result, comment, version } = body

    if (!result || !['APPROVED', 'REJECTED'].includes(result)) {
      return NextResponse.json({ error: '无效的审批结果' }, { status: 400 })
    }

    // 1. 获取工单
    const ticket = await db.exceptionTicket.findUnique({
      where: { id },
      include: { reportedBy: { select: { id: true } } },
    })

    if (!ticket) {
      return NextResponse.json({ error: '工单不存在' }, { status: 404 })
    }

    // 2. 权限校验：不能审批自己提交的工单
    if (ticket.reportedById === user.id) {
      return NextResponse.json({ error: '不能审批自己提交的工单' }, { status: 403 })
    }

    // 3. 权限校验：必须是当前指派的审批人
    if (ticket.currentApproverId !== user.id) {
      return NextResponse.json({ error: '您不是该工单的当前审批人' }, { status: 403 })
    }

    // 4. 权限校验：角色必须匹配当前审批层级
    const currentLevel = ticket.currentStatus === 'LEVEL1_APPROVING' ? 'LEVEL1' : 'LEVEL2'
    const requiredRole = currentLevel === 'LEVEL1' ? 'LEVEL1_APPROVER' : 'LEVEL2_APPROVER'
    if (user.role !== requiredRole && user.role !== 'ADMIN') {
      return NextResponse.json({ error: '您没有对应层级的审批权限' }, { status: 403 })
    }

    // 5. 乐观锁校验
    if (version !== undefined && ticket.version !== version) {
      return NextResponse.json({
        error: '该工单已被他人处理，请刷新后重试',
        code: 'CONCURRENT_CONFLICT',
      }, { status: 409 })
    }

    if (result === 'APPROVED') {
      // 审批通过 — 检查是否需要升级到二级审批
      const thresholdConfig = await db.approvalThresholdConfig.findFirst({
        where: {
          isActive: true,
          minAmount: { lte: ticket.amount },
          OR: [
            { maxAmount: { gte: ticket.amount } },
            { maxAmount: null },
          ],
        },
        orderBy: { minAmount: 'asc' },
      })

      const requiredLevels = (thresholdConfig?.requiredLevels as string[]) || ['LEVEL1']
      const needsLevel2 = requiredLevels.includes('LEVEL2') && currentLevel === 'LEVEL1'

      const nextStatus = needsLevel2 ? 'LEVEL2_APPROVING' : 'EXECUTING'

      // 验证状态转换
      if (!validateTransition(ticket.currentStatus, nextStatus)) {
        return NextResponse.json({ error: `不允许从 ${ticket.currentStatus} 转换到 ${nextStatus}` }, { status: 400 })
      }

      const nextLevel = nextStatus === 'LEVEL2_APPROVING' ? 'LEVEL2' : null
      let nextApproverId: string | null = null

      if (nextLevel) {
        const nextApprover = await db.user.findFirst({
          where: { role: 'LEVEL2_APPROVER', isActive: true, id: { not: user.id } },
        })
        nextApproverId = nextApprover?.id || null
      }

      await db.$transaction(async (tx) => {
        await tx.approvalRecord.create({
          data: {
            ticketId: id,
            approverId: user.id,
            level: currentLevel as 'LEVEL1' | 'LEVEL2',
            result: 'APPROVED',
            comment: comment || '',
          },
        })

        await tx.exceptionTicket.update({
          where: { id },
          data: {
            currentStatus: nextStatus,
            currentApproverId: nextApproverId,
            version: { increment: 1 },
          },
        })
      })

      return NextResponse.json({
        success: true,
        nextStatus,
        needsLevel2,
      })
    } else {
      // 审批拒绝
      const newResubmitCount = ticket.resubmitCount + 1
      const maxResubmit = ticket.maxResubmit || 3
      const nextStatus = newResubmitCount >= maxResubmit ? 'CLOSED' : 'PENDING_APPROVAL'

      if (!validateTransition(ticket.currentStatus, nextStatus)) {
        return NextResponse.json({ error: `不允许从 ${ticket.currentStatus} 转换到 ${nextStatus}` }, { status: 400 })
      }

      // 分配新的审批人（重提交时不能分配给原审批人）
      let nextApproverId: string | null = null
      if (nextStatus === 'PENDING_APPROVAL') {
        const nextApprover = await db.user.findFirst({
          where: { role: 'LEVEL1_APPROVER', isActive: true, id: { not: ticket.reportedById } },
        })
        nextApproverId = nextApprover?.id || null
      }

      await db.$transaction(async (tx) => {
        await tx.approvalRecord.create({
          data: {
            ticketId: id,
            approverId: user.id,
            level: currentLevel as 'LEVEL1' | 'LEVEL2',
            result: 'REJECTED',
            comment: comment || '',
          },
        })

        await tx.exceptionTicket.update({
          where: { id },
          data: {
            currentStatus: nextStatus,
            currentApproverId: nextApproverId,
            resubmitCount: newResubmitCount,
            version: { increment: 1 },
          },
        })

        // 如果工单关闭，解锁关联的批次
        if (nextStatus === 'CLOSED') {
          await tx.inventory.updateMany({
            where: { ticketId: id, batchStatus: 'LOCKED' },
            data: { batchStatus: 'RELEASED', ticketId: null },
          })
          await tx.scanRecord.updateMany({
            where: { ticketId: id, batchStatus: 'LOCKED' },
            data: { batchStatus: 'RELEASED' },
          })
        }
      })

      return NextResponse.json({
        success: true,
        nextStatus,
        resubmitCount: newResubmitCount,
        isClosed: nextStatus === 'CLOSED',
      })
    }
  } catch {
    return NextResponse.json({ error: '审批操作失败' }, { status: 500 })
  }
}