import Link from 'next/link'
import { db } from '@/lib/db'

export default async function SettingsPage() {
  const [thresholds, timeouts] = await Promise.all([
    db.approvalThresholdConfig.findMany({ orderBy: { minAmount: 'asc' } }),
    db.timeoutConfig.findMany(),
  ])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">系统配置</h2>
        <p className="text-sm text-muted-foreground mt-1">审批阈值与超时配置</p>
      </div>

      {/* 审批阈值 */}
      <div className="bg-card border border-border rounded-xl">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground">审批金额阈值</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">名称</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">最低金额</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">最高金额</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">审批层级</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">状态</th>
            </tr>
          </thead>
          <tbody>
            {thresholds.map((t) => {
              const levels = t.requiredLevels as string[]
              return (
                <tr key={t.id} className="border-b border-border">
                  <td className="px-5 py-3 text-sm font-medium">{t.name}</td>
                  <td className="px-5 py-3 text-sm">¥{t.minAmount}</td>
                  <td className="px-5 py-3 text-sm">{t.maxAmount ? `¥${t.maxAmount}` : '无上限'}</td>
                  <td className="px-5 py-3 text-sm">{levels.join(' + ')}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${t.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {t.isActive ? '启用' : '禁用'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 超时配置 */}
      <div className="bg-card border border-border rounded-xl">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground">超时配置</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">配置项</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">超时时间</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">超时动作</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">状态</th>
            </tr>
          </thead>
          <tbody>
            {timeouts.map((t) => {
              const action = t.action as { type: string; target: string }
              const labels: Record<string, string> = {
                'PENDING_APPROVAL': '待审批超时',
                'LEVEL1_APPROVAL': '一级审批超时',
                'LEVEL2_APPROVAL': '二级审批超时',
                'QC_HOLD': '品控暂扣超时',
              }
              const hours = Math.floor(t.timeoutMinutes / 60)
              const mins = t.timeoutMinutes % 60
              const timeStr = hours > 0 ? `${hours} 小时${mins > 0 ? ` ${mins} 分钟` : ''}` : `${mins} 分钟`
              return (
                <tr key={t.id} className="border-b border-border">
                  <td className="px-5 py-3 text-sm font-medium">{labels[t.configKey] || t.configKey}</td>
                  <td className="px-5 py-3 text-sm">{timeStr}</td>
                  <td className="px-5 py-3 text-sm">
                    {action.type === 'escalate' ? `升级到 ${action.target}` : action.type === 'auto_reject' ? '自动驳回' : action.type}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${t.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {t.isActive ? '启用' : '禁用'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}