import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/config/approval-thresholds
export async function GET() {
  try {
    const configs = await db.approvalThresholdConfig.findMany({
      orderBy: { minAmount: 'asc' },
    })
    return NextResponse.json({ configs })
  } catch {
    return NextResponse.json({ error: '获取审批阈值配置失败' }, { status: 500 })
  }
}

// POST /api/config/approval-thresholds
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const config = await db.approvalThresholdConfig.create({
      data: {
        name: body.name,
        minAmount: body.minAmount || 0,
        maxAmount: body.maxAmount || null,
        requiredLevels: body.requiredLevels || ['LEVEL1'],
      },
    })
    return NextResponse.json({ config }, { status: 201 })
  } catch {
    return NextResponse.json({ error: '创建审批阈值配置失败' }, { status: 500 })
  }
}