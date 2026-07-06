import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/config/timeouts
export async function GET() {
  try {
    const configs = await db.timeoutConfig.findMany()
    return NextResponse.json({ configs })
  } catch {
    return NextResponse.json({ error: '获取超时配置失败' }, { status: 500 })
  }
}