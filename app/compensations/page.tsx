import Link from 'next/link'
import { db } from '@/lib/db'
import { COMPENSATION_DIRECTION_LABELS } from '@/lib/state-machine'
import { formatCurrency, formatDateTime } from '@/lib/utils'

export default async function CompensationsPage() {
  const records = await db.compensationRecord.findMany({
    take: 50,
    orderBy: { createdAt: 'desc' },
    include: {
      ticket: { select: { id: true, exceptionType: true } },
      approvalRecord: { select: { approver: { select: { name: true } } } },
    },
  })

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">赔付记录</h2>
        <p className="text-sm text-muted-foreground mt-1">共 {records.length} 条赔付记录</p>
      </div>

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
      </div>
    </div>
  )
}