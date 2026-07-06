import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const [totalTickets, statusCounts, todayScans, pendingApprovals, recentSyncLogs] = await Promise.all([
      db.exceptionTicket.count(),
      db.exceptionTicket.groupBy({
        by: ['currentStatus'],
        _count: true,
      }),
      db.scanRecord.count({
        where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      }),
      db.exceptionTicket.count({
        where: { currentStatus: { in: ['LEVEL1_APPROVING', 'LEVEL2_APPROVING'] } },
      }),
      db.syncLog.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { success: true, endpoint: true, createdAt: true },
      }),
    ])

    const statusMap: Record<string, number> = {}
    statusCounts.forEach((s) => { statusMap[s.currentStatus] = s._count })

    return NextResponse.json({
      totalTickets,
      statusBreakdown: statusMap,
      todayScans,
      pendingApprovals,
      syncHealth: {
        recentLogs: recentSyncLogs,
        lastSyncAt: recentSyncLogs[0]?.createdAt || null,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: '获取统计数据失败' }, { status: 500 })
  }
}