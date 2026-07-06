import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/cron/check-timeouts — 超时自动流转（Vercel Cron 调用）
export async function GET(request: NextRequest) {
  try {
    // 验证 Cron Secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const processed: string[] = []

    // 获取所有超时配置
    const timeouts = await db.timeoutConfig.findMany({ where: { isActive: true } })

    for (const timeout of timeouts) {
      const statusMap: Record<string, string[]> = {
        'PENDING_APPROVAL': ['PENDING_APPROVAL'],
        'LEVEL1_APPROVAL': ['LEVEL1_APPROVING'],
        'LEVEL2_APPROVAL': ['LEVEL2_APPROVING'],
        'QC_HOLD': ['PENDING_APPROVAL', 'LEVEL1_APPROVING', 'LEVEL2_APPROVING'],
      }

      const targetStatuses = statusMap[timeout.configKey] || [timeout.configKey]
      const cutoffTime = new Date(now.getTime() - timeout.timeoutMinutes * 60000)

      const expiredTickets = await db.exceptionTicket.findMany({
        where: {
          currentStatus: { in: targetStatuses as never[] },
          updatedAt: { lt: cutoffTime },
        },
      })

      for (const ticket of expiredTickets) {
        const action = timeout.action as { type: string; target?: string }
        const transitions: Record<string, string> = {
          'PENDING_APPROVAL': 'LEVEL2_APPROVING',
          'LEVEL1_APPROVING': 'LEVEL2_APPROVING',
          'LEVEL2_APPROVING': 'CLOSED',
        }
        const nextStatus = transitions[ticket.currentStatus] || 'CLOSED'

        await db.$transaction(async (tx) => {
          await tx.exceptionTicket.update({
            where: { id: ticket.id },
            data: {
              currentStatus: nextStatus as never,
              version: { increment: 1 },
            },
          })

          await tx.approvalRecord.create({
            data: {
              ticketId: ticket.id,
              approverId: 'SYSTEM',
              level: 'LEVEL2',
              result: nextStatus === 'CLOSED' ? 'REJECTED' : 'APPROVED',
              comment: `超时自动${nextStatus === 'CLOSED' ? '驳回' : '升级'} — 超时 ${timeout.timeoutMinutes} 分钟未处理`,
            },
          })

          // 如果关闭，解锁批次
          if (nextStatus === 'CLOSED') {
            await tx.inventory.updateMany({
              where: { ticketId: ticket.id, batchStatus: 'LOCKED' },
              data: { batchStatus: 'RELEASED' },
            })
          }
        })

        processed.push(`${ticket.id}: ${ticket.currentStatus} -> ${nextStatus}`)
      }
    }

    return NextResponse.json({
      processed: processed.length,
      details: processed,
      checkedAt: now.toISOString(),
    })
  } catch {
    return NextResponse.json({ error: '超时检查失败' }, { status: 500 })
  }
}