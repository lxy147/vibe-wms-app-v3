import Link from 'next/link'
import { db } from '@/lib/db'
import { BATCH_STATUS_LABELS, BATCH_STATUS_COLORS } from '@/lib/state-machine'
import { formatDateTime } from '@/lib/utils'

export default async function ScanRecordsPage() {
  const records = await db.scanRecord.findMany({
    take: 50,
    orderBy: { createdAt: 'desc' },
    include: {
      waybillSnapshot: { select: { externalCode: true, storeName: true } },
      operator: { select: { name: true } },
      ticket: { select: { id: true, currentStatus: true } },
      qcRule: { select: { name: true } },
    },
  })

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">扫描记录</h2>
        <p className="text-sm text-muted-foreground mt-1">共 {records.length} 条扫描记录</p>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">运单号</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">SKU</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">品控结果</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">批次状态</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">命中规则</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">操作人</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">工单</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">时间</th>
            </tr>
          </thead>
          <tbody>
            {records.map((rec) => (
              <tr key={rec.id} className="border-b border-border">
                <td className="px-5 py-3 text-sm text-muted-foreground">{rec.waybillSnapshot.externalCode}</td>
                <td className="px-5 py-3 text-sm font-mono">{rec.skuCode}</td>
                <td className="px-5 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    rec.scanResult === 'PASSED' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                  }`}>
                    {rec.scanResult === 'PASSED' ? '通过' : '暂扣'}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${BATCH_STATUS_COLORS[rec.batchStatus]}`}>
                    {BATCH_STATUS_LABELS[rec.batchStatus]}
                  </span>
                </td>
                <td className="px-5 py-3 text-sm text-muted-foreground">{rec.qcRule?.name || '—'}</td>
                <td className="px-5 py-3 text-sm">{rec.operator.name}</td>
                <td className="px-5 py-3">
                  {rec.ticket ? (
                    <Link href={`/tickets/${rec.ticket.id}`} className="text-primary hover:underline text-sm">查看</Link>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-5 py-3 text-sm text-muted-foreground">{formatDateTime(rec.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}