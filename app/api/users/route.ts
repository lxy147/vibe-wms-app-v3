import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'

// GET /api/users — 获取用户列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role')
    const isActive = searchParams.get('isActive')

    const where: Record<string, unknown> = {}
    if (role) where.role = role
    if (isActive !== null) where.isActive = isActive === 'true'

    const users = await db.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ users })
  } catch {
    return NextResponse.json({ error: '获取用户列表失败' }, { status: 500 })
  }
}

// POST /api/users — 创建用户
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password, name, role } = body

    if (!username || !password || !name || !role) {
      return NextResponse.json({ error: '缺少必填字段' }, { status: 400 })
    }

    const existing = await db.user.findUnique({ where: { username } })
    if (existing) {
      return NextResponse.json({ error: '用户名已存在' }, { status: 409 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const user = await db.user.create({
      data: { username, password: hashedPassword, name, role },
      select: { id: true, username: true, name: true, role: true, isActive: true, createdAt: true },
    })

    return NextResponse.json({ user }, { status: 201 })
  } catch {
    return NextResponse.json({ error: '创建用户失败' }, { status: 500 })
  }
}