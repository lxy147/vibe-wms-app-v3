import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// PUT /api/qc-rules/[id] — 更新品控规则
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await request.json()
    const rule = await db.qCRule.update({
      where: { id },
      data: body,
    })
    return NextResponse.json({ rule })
  } catch {
    return NextResponse.json({ error: '更新品控规则失败' }, { status: 500 })
  }
}

// DELETE /api/qc-rules/[id] — 软删除品控规则
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    await db.qCRule.update({
      where: { id },
      data: { isActive: false },
    })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: '删除品控规则失败' }, { status: 500 })
  }
}