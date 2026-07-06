import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// PUT /api/config/timeouts/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await request.json()
    const config = await db.timeoutConfig.update({
      where: { id },
      data: {
        timeoutMinutes: body.timeoutMinutes,
        action: body.action,
        isActive: body.isActive,
      },
    })
    return NextResponse.json({ config })
  } catch {
    return NextResponse.json({ error: '更新超时配置失败' }, { status: 500 })
  }
}