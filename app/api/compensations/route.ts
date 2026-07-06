import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/compensations — 赔付记录列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') || '20')))
    const direction = searchParams.get('direction')
    const status = searchParams.get('status')

    const where: Record<string, unknown> = {}
    if (direction) where.direction = direction
    if (status) where.status = status

    const [records, total] = await Promise.all([
      db.compensationRecord.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          ticket: {
            select: { id: true, exceptionType: true, source: true },
          },
          approvalRecord: {
            select: { id: true, approver: { select: { name: true } } },
          },
        },
      }),
      db.compensationRecord.count({ where }),
    ])

    return NextResponse.json({
      records,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch {
    return NextResponse.json({ error: '获取赔付记录失败' }, { status: 500 })
  }
}