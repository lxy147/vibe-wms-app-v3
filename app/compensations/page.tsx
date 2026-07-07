import Link from 'next/link'
import { db } from '@/lib/db'
import { COMPENSATION_DIRECTION_LABELS } from '@/lib/state-machine'
import { formatCurrency, formatDateTime } from '@/lib/utils'

export default async function CompensationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page || '1'))
  const pageSize = 10
  const direction = params.direction

  const where: Record<string, unknown> = {}
  if (direction) where.direction = direction

  const [records, total] = await Promise.all([
    db.compensationRecord.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        ticket: { select: { id: true, exceptionType: true } },
        approvalRecord: { select: { approver: { select: { name: true } } } },
      },
    }),
    db.compensationRecord.count({ where }),
  ])

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">赔付记录</h2>
        <p className="text-sm text-muted-foreground mt-1">共 {total} 条赔付记录</p>
      </div>

      <form className="bg-card border border-border rounded-xl p-4 flex gap-3">
        <select name="direction" defaultValue={direction || ''} className="px-3 py-2 border border-border rounded-lg bg-background text-sm">
          <option value="">全部方向</option>
          <option value="TO_CUSTOMER">赔付客户</option>
          <option value="FROM_SUPPLIER">向供应商追偿</option>
        </select>
        <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm">筛选</button>
      </form>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">金额</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">赔付方向</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">状态</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">关联工单</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">审批人</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">备注</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">时间</th>
            </tr>
          </thead>
          <tbody>
            {records.map((rec) => (
              <tr key={rec.id} className="border-b border-border">
                <td className="px-5 py-3 text-sm font-medium">{formatCurrency(rec.amount)}</td>
                <td className="px-5 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    rec.direction === 'FROM_SUPPLIER' ? 'bg-teal-100 text-teal-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {COMPENSATION_DIRECTION_LABELS[rec.direction]}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    rec.status === 'EXECUTED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {rec.status === 'EXECUTED' ? '已执行' : '待执行'}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <Link href={`/tickets/${rec.ticketId}`} className="text-primary hover:underline text-sm">查看工单</Link>
                </td>
                <td className="px-5 py-3 text-sm">{rec.approvalRecord.approver.name}</td>
                <td className="px-5 py-3 text-sm text-muted-foreground">{rec.remark || '—'}</td>
                <td className="px-5 py-3 text-sm text-muted-foreground">{formatDateTime(rec.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-border flex items-center justify-between">
            <span className="text-sm text-muted-foreground">第 {page} / {totalPages} 页</span>
            <div className="flex gap-2">
              {page > 1 && (
                <a href={`/compensations?page=${page - 1}${direction ? `&direction=${direction}` : ''}`} className="px-3 py-1 border border-border rounded text-sm hover:bg-muted">上一页</a>
              )}
              {page < totalPages && (
                <a href={`/compensations?page=${page + 1}${direction ? `&direction=${direction}` : ''}`} className="px-3 py-1 border border-border rounded text-sm hover:bg-muted">下一页</a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}