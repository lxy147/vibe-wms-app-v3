import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/qc-rules — 品控规则列表
export async function GET() {
  try {
    const rules = await db.qCRule.findMany({
      orderBy: { updatedAt: 'desc' },
    })
    return NextResponse.json({ rules })
  } catch {
    return NextResponse.json({ error: '获取品控规则失败' }, { status: 500 })
  }
}

// POST /api/qc-rules — 创建品控规则
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, exceptionSubType, triggerCondition, severity, autoCreateTicket, defaultApprovalLevel } = body

    if (!name || !exceptionSubType || !triggerCondition) {
      return NextResponse.json({ error: '缺少必填字段' }, { status: 400 })
    }

    const rule = await db.qCRule.create({
      data: {
        name,
        exceptionSubType,
        triggerCondition,
        severity: severity || 'MEDIUM',
        autoCreateTicket: autoCreateTicket !== undefined ? autoCreateTicket : true,
        defaultApprovalLevel: defaultApprovalLevel || 'LEVEL1',
      },
    })

    return NextResponse.json({ rule }, { status: 201 })
  } catch {
    return NextResponse.json({ error: '创建品控规则失败' }, { status: 500 })
  }
}