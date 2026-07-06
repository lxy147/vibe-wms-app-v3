import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCircuitBreakerStatus } from '@/lib/v2-client'

// GET /api/sync/status — 同步状态
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') || '20')))
    const success = searchParams.get('success')

    const where: Record<string, unknown> = {}
    if (success !== null && success !== undefined) where.success = success === 'true'

    const [logs, total, lastSuccess, successRate] = await Promise.all([
      db.syncLog.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      db.syncLog.count({ where }),
      db.syncLog.findFirst({
        where: { success: true },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      (async () => {
        const total24h = await db.syncLog.count({
          where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        })
        const success24h = await db.syncLog.count({
          where: {
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            success: true,
          },
        })
        return total24h > 0 ? Math.round((success24h / total24h) * 100) : 100
      })(),
    ])

    const circuitBreaker = getCircuitBreakerStatus()

    return NextResponse.json({
      logs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      lastSyncAt: lastSuccess?.createdAt || null,
      successRate24h: successRate,
      circuitBreaker,
    })
  } catch {
    return NextResponse.json({ error: '获取同步状态失败' }, { status: 500 })
  }
}