import Link from 'next/link'
import { db } from '@/lib/db'
import { BATCH_STATUS_LABELS, BATCH_STATUS_COLORS } from '@/lib/state-machine'

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page || '1'))
  const pageSize = 20
  const batchStatus = params.batchStatus

  const where: Record<string, unknown> = {}
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

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">库存管理</h2>
        <p className="text-sm text-muted-foreground mt-1">共 {total} 条库存记录</p>
      </div>

      <form className="bg-card border border-border rounded-xl p-4 flex gap-3">
        <select name="batchStatus" defaultValue={batchStatus || ''} className="px-3 py-2 border border-border rounded-lg bg-background text-sm">
          <option value="">全部状态</option>
          <option value="AVAILABLE">可出库</option>
          <option value="LOCKED">品控暂扣</option>
          <option value="RELEASED">已解锁</option>
          <option value="VOIDED">已作废</option>
        </select>
        <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm">筛选</button>
      </form>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">SKU</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">名称</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">数量</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">运单号</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">批次状态</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">关联工单</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-border">
                <td className="px-5 py-3 text-sm font-mono">{item.skuCode}</td>
                <td className="px-5 py-3 text-sm">{item.skuName}</td>
                <td className="px-5 py-3 text-sm">{item.quantity}</td>
                <td className="px-5 py-3 text-sm text-muted-foreground">{item.waybillSnapshot.externalCode}</td>
                <td className="px-5 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${BATCH_STATUS_COLORS[item.batchStatus]}`}>
                    {BATCH_STATUS_LABELS[item.batchStatus]}
                  </span>
                </td>
                <td className="px-5 py-3">
                  {item.ticket ? (
                    <Link href={`/tickets/${item.ticket.id}`} className="text-primary hover:underline text-sm">
                      查看工单
                    </Link>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}