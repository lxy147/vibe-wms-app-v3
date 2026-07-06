import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// PUT /api/users/[id] — 更新用户
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, role, isActive } = body

    const user = await db.user.update({
      where: { id },
      data: { ...(name && { name }), ...(role && { role }), ...(isActive !== undefined && { isActive }) },
      select: { id: true, username: true, name: true, role: true, isActive: true },
    })

    return NextResponse.json({ user })
  } catch {
    return NextResponse.json({ error: '更新用户失败' }, { status: 500 })
  }
}

// POST /api/users/[id]/toggle-status — 切换用户激活状态（含审批人兜底）
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const user = await db.user.findUnique({ where: { id }, select: { isActive: true, role: true } })
    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    const newStatus = !user.isActive

    // 如果禁用用户，进行审批人兜底
    if (!newStatus) {
      await db.$transaction(async (tx) => {
        // 找到该用户所有待审批的工单
        const tickets = await tx.exceptionTicket.findMany({
          where: {
            currentApproverId: id,
            currentStatus: { in: ['LEVEL1_APPROVING', 'LEVEL2_APPROVING'] },
          },
        })

        if (tickets.length > 0) {
          // 找到同角色的活跃用户
          const fallback = await tx.user.findFirst({
            where: {
              role: user.role,
              isActive: true,
              id: { not: id },
            },
          })

          if (fallback) {
            // 转交工单
            await tx.exceptionTicket.updateMany({
              where: {
                currentApproverId: id,
                currentStatus: { in: ['LEVEL1_APPROVING', 'LEVEL2_APPROVING'] },
              },
              data: { currentApproverId: fallback.id },
            })
          }
        }

        // 更新用户状态
        await tx.user.update({
          where: { id },
          data: { isActive: newStatus },
        })
      })
    } else {
      await db.user.update({ where: { id }, data: { isActive: newStatus } })
    }

    return NextResponse.json({ success: true, isActive: newStatus })
  } catch {
    return NextResponse.json({ error: '操作失败' }, { status: 500 })
  }
}