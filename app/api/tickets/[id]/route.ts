import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/tickets/[id] — 工单详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const ticket = await db.exceptionTicket.findUnique({
      where: { id },
      include: {
        waybillSnapshot: true,
        reportedBy: { select: { id: true, username: true, name: true, role: true } },
        currentApprover: { select: { id: true, username: true, name: true, role: true } },
        approvalRecords: {
          orderBy: { createdAt: 'asc' },
          include: {
            approver: { select: { id: true, name: true, role: true } },
          },
        },
        compensationRecords: {
          orderBy: { createdAt: 'desc' },
        },
        scanRecords: {
          orderBy: { createdAt: 'desc' },
          include: {
            operator: { select: { name: true } },
            qcRule: { select: { name: true } },
          },
        },
        inventory: {
          select: { id: true, skuCode: true, skuName: true, quantity: true, batchStatus: true },
        },
      },
    })

    if (!ticket) {
      return NextResponse.json({ error: '工单不存在' }, { status: 404 })
    }

    return NextResponse.json({ ticket })
  } catch {
    return NextResponse.json({ error: '获取工单详情失败' }, { status: 500 })
  }
}