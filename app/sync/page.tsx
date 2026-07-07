import Link from 'next/link'
import { db } from '@/lib/db'
import { getCircuitBreakerStatus } from '@/lib/v2-client'
import { formatDateTime } from '@/lib/utils'

export default async function SyncPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page || '1'))
  const pageSize = 10

  const where: Record<string, unknown> = {}
  if (params.success) where.success = params.success === 'true'

  const [logs, total, lastSuccess, successRate, circuitBreaker] = await Promise.all([
    db.syncLog.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    db.syncLog.count({ where }),
    db.syncLog.findFirst({
      where: { success: true },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
    (async () => {
      const total24h = await db.syncLog.count({
        where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      })
      const success24h = await db.syncLog.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          success: true,
        },
      })
      return total24h > 0 ? Math.round((success24h / total24h) * 100) : 100
    })(),
    getCircuitBreakerStatus(),
  ])

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">接口监控</h2>
        <p className="text-sm text-muted-foreground mt-1">V2 接口同步状态与日志</p>
      </div>

      {/* 状态卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-sm text-muted-foreground">最近同步</p>
          <p className="text-xl font-bold mt-1">{lastSuccess ? formatDateTime(lastSuccess.createdAt) : '无'}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-sm text-muted-foreground">24h 成功率</p>
          <p className={`text-xl font-bold mt-1 ${successRate >= 90 ? 'text-success' : successRate >= 70 ? 'text-warning' : 'text-destructive'}`}>
            {successRate}%
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-sm text-muted-foreground">熔断器状态</p>
          <p className={`text-xl font-bold mt-1 ${circuitBreaker.open ? 'text-destructive' : 'text-success'}`}>
            {circuitBreaker.open ? '已熔断' : '正常'}
          </p>
          <p className="text-xs text-muted-foreground">连续失败: {circuitBreaker.failureCount}</p>
        </div>
      </div>

      {/* 同步日志 */}
      <div className="bg-card border border-border rounded-xl">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground">调用日志（共 {total} 条）</h3>
          <form className="flex gap-2">
            <select name="success" defaultValue={params.success || ''} className="px-3 py-1.5 border border-border rounded-lg bg-background text-sm">
              <option value="">全部</option>
              <option value="true">成功</option>
              <option value="false">失败</option>
            </select>
            <button type="submit" className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm">筛选</button>
          </form>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Request ID</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">接口</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">状态码</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">结果</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">耗时</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">时间</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-border">
                  <td className="px-5 py-3 text-xs font-mono">{log.requestId.slice(0, 12)}...</td>
                  <td className="px-5 py-3 text-sm">{log.endpoint}</td>
                  <td className="px-5 py-3 text-sm">{log.responseStatus || '—'}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${log.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {log.success ? '成功' : '失败'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{log.durationMs}ms</td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{formatDateTime(log.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-border flex items-center justify-between">
            <span className="text-sm text-muted-foreground">第 {page} / {totalPages} 页</span>
            <div className="flex gap-2">
              {page > 1 && (
                <a href={`/sync?page=${page - 1}${params.success ? `&success=${params.success}` : ''}`} className="px-3 py-1 border border-border rounded text-sm hover:bg-muted">上一页</a>
              )}
              {page < totalPages && (
                <a href={`/sync?page=${page + 1}${params.success ? `&success=${params.success}` : ''}`} className="px-3 py-1 border border-border rounded text-sm hover:bg-muted">下一页</a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}