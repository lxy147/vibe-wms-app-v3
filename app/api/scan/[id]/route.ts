import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isQCSupervisor, getCurrentUser } from '@/lib/auth'

// POST /api/scan/[id]/fast-release — 品控主管快速放行
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const user = await getCurrentUser()

    if (!isQCSupervisor(user)) {
      return NextResponse.json({ error: '仅品控主管可执行快速放行操作' }, { status: 403 })
    }

    const body = await request.json()
    const { reason } = body

    if (!reason || reason.trim().length === 0) {
      return NextResponse.json({ error: '必须填写复核原因' }, { status: 400 })
    }

    const scanRecord = await db.scanRecord.findUnique({
      where: { id },
      include: { ticket: true },
    })

    if (!scanRecord) {
      return NextResponse.json({ error: '扫描记录不存在' }, { status: 404 })
    }

    if (scanRecord.scanResult !== 'QC_HOLD') {
      return NextResponse.json({ error: '该扫描记录未处于品控暂扣状态' }, { status: 400 })
    }

    const result = await db.$transaction(async (tx) => {
      // 解锁扫描记录
      await tx.scanRecord.update({
        where: { id },
        data: {
          batchStatus: 'RELEASED',
          resultDetail: JSON.stringify({
            original: scanRecord.resultDetail,
            fastRelease: {
              releasedBy: user!.id,
              releasedByName: user!.name,
              reason,
              releasedAt: new Date().toISOString(),
            },
          }),
        },
      })

      // 如果有工单，关闭工单
      if (scanRecord.ticketId) {
        await tx.exceptionTicket.update({
          where: { id: scanRecord.ticketId },
          data: {
            currentStatus: 'CLOSED',
            version: { increment: 1 },
          },
        })

        // 创建审批记录（快速放行留痕）
        await tx.approvalRecord.create({
          data: {
            ticketId: scanRecord.ticketId,
            approverId: user!.id,
            level: 'LEVEL1',
            result: 'APPROVED',
            comment: `品控主管误判快速放行 — ${reason}`,
          },
        })
      }

      // 解锁关联库存
      await tx.inventory.updateMany({
        where: {
          waybillSnapshotId: scanRecord.waybillSnapshotId,
          skuCode: scanRecord.skuCode,
          batchStatus: 'LOCKED',
        },
        data: { batchStatus: 'RELEASED', ticketId: null },
      })
    })

    return NextResponse.json({ success: true, message: '快速放行成功' })
  } catch {
    return NextResponse.json({ error: '快速放行操作失败' }, { status: 500 })
  }
}