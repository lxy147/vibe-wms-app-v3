import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/inventory — 库存列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') || '20')))
    const skuCode = searchParams.get('skuCode')
    const batchStatus = searchParams.get('batchStatus')

    const where: Record<string, unknown> = {}
    if (skuCode) where.skuCode = { contains: skuCode }
    if (batchStatus) where.batchStatus = batchStatus

    const [items, total] = await Promise.all([
      db.inventory.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { updatedAt: 'desc' },
        include: {
          waybillSnapshot: { select: { externalCode: true, storeName: true } },
          ticket: { select: { id: true, currentStatus: true } },
        },
      }),
      db.inventory.count({ where }),
    ])

    return NextResponse.json({
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch {
    return NextResponse.json({ error: '获取库存列表失败' }, { status: 500 })
  }
}