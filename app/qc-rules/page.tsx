import Link from 'next/link'
import { db } from '@/lib/db'

export default async function QCRulesPage() {
  const rules = await db.qCRule.findMany({
    orderBy: { updatedAt: 'desc' },
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">品控规则</h2>
          <p className="text-sm text-muted-foreground mt-1">可配置的品控触发规则引擎</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">规则名称</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">异常子类型</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">触发条件</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">严重度</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">自动创建工单</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">审批级别</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">状态</th>
              </tr>
            </thead>
            <tbody>
              {rules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-muted-foreground">暂无品控规则</td>
                </tr>
              ) : (
                rules.map((rule) => {
                  const condition = rule.triggerCondition as Record<string, unknown>
                  let conditionText = ''
                  if (condition.type === 'quantity_diff') {
                    conditionText = `数量差异 > ${(condition.threshold as number) * 100}%`
                  } else if (condition.type === 'damage_level') {
                    conditionText = `破损等级 >= ${condition.minLevel}`
                  } else if (condition.type === 'spec_mismatch') {
                    conditionText = `规格不匹配`
                  } else if (condition.type === 'label_error') {
                    conditionText = `标签字段缺失`
                  } else if (condition.type === 'batch_abnormal') {
                    conditionText = `批次异常`
                  }
                  return (
                    <tr key={rule.id} className="border-b border-border hover:bg-muted/30">
                      <td className="px-5 py-3 text-sm font-medium">{rule.name}</td>
                      <td className="px-5 py-3 text-sm">{rule.exceptionSubType}</td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">{conditionText}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          rule.severity === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                          rule.severity === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                          rule.severity === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {rule.severity}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm">{rule.autoCreateTicket ? '是' : '否'}</td>
                      <td className="px-5 py-3 text-sm">{rule.defaultApprovalLevel === 'LEVEL1' ? '一级审批' : '二级审批'}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${rule.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {rule.isActive ? '启用' : '禁用'}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}