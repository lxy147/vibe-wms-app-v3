import Link from 'next/link'
import { db } from '@/lib/db'

export default async function DashboardPage() {
  const [totalTickets, pendingTickets, todayScans, openApprovals, recentTickets] =
    await Promise.all([
      db.exceptionTicket.count(),
      db.exceptionTicket.count({
        where: {
          currentStatus: { in: ['PENDING_APPROVAL', 'LEVEL1_APPROVING', 'LEVEL2_APPROVING'] },
        },
      }),
      db.scanRecord.count({
        where: {
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      db.exceptionTicket.count({
        where: { currentStatus: { in: ['LEVEL1_APPROVING', 'LEVEL2_APPROVING'] } },
      }),
      db.exceptionTicket.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          waybillSnapshot: { select: { externalCode: true, storeName: true } },
          reportedBy: { select: { name: true } },
        },
      }),
    ])

  const stats = [
    { label: '工单总数', value: totalTickets, href: '/tickets', color: 'text-primary' },
    { label: '待处理工单', value: pendingTickets, href: '/tickets?status=PENDING_APPROVAL', color: 'text-warning' },
    { label: '今日扫描', value: todayScans, href: '/scan/records', color: 'text-success' },
    { label: '待审批', value: openApprovals, href: '/approval', color: 'text-destructive' },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* 页面标题 */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">工作台</h2>
        <p className="text-sm text-muted-foreground mt-1">运单全流程管理概览</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-all duration-200"
          >
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className={`text-3xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
          </Link>
        ))}
      </div>

      {/* 快捷操作 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickAction
          href="/scan"
          icon="Scan"
          title="扫描品控"
          desc="扫描运单 SKU，自动品控检测"
        />
        <QuickAction
          href="/tickets/create"
          icon="AlertTriangle"
          title="异常上报"
          desc="手工上报物流异常工单"
        />
        <QuickAction
          href="/approval"
          icon="CheckCircle"
          title="待审批"
          desc="查看待审批工单列表"
        />
        <QuickAction
          href="/sync"
          icon="Activity"
          title="接口监控"
          desc="查看 V2 接口同步状态"
        />
      </div>

      {/* 最近工单 */}
      <div className="bg-card border border-border rounded-xl">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground">最近工单</h3>
          <Link href="/tickets" className="text-sm text-primary hover:underline">
            查看全部
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">运单号</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">门店</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">上报人</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">状态</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">时间</th>
              </tr>
            </thead>
            <tbody>
              {recentTickets.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                    暂无工单数据
                  </td>
                </tr>
              ) : (
                recentTickets.map((ticket) => (
                  <tr key={ticket.id} className="border-b border-border hover:bg-muted/30">
                    <td className="px-5 py-3">
                      <Link href={`/tickets/${ticket.id}`} className="text-primary hover:underline font-medium text-sm">
                        {ticket.waybillSnapshot.externalCode || '—'}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">
                      {ticket.waybillSnapshot.storeName || '—'}
                    </td>
                    <td className="px-5 py-3 text-sm">{ticket.reportedBy.name}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={ticket.currentStatus} />
                    </td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">
                      {new Date(ticket.createdAt).toLocaleDateString('zh-CN')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function QuickAction({ href, title, desc, icon }: { href: string; title: string; desc: string; icon: string }) {
  return (
    <Link
      href={href}
      className="bg-card border border-border rounded-xl p-5 hover:shadow-md hover:border-primary/30 transition-all duration-200"
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <QuickActionIcon name={icon} />
        </div>
        <h4 className="font-semibold text-sm text-foreground">{title}</h4>
      </div>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </Link>
  )
}

function QuickActionIcon({ name }: { name: string }) {
  const cls = 'w-[18px] h-[18px] text-primary'
  if (name === 'Scan') return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /><line x1="7" x2="17" y1="12" y2="12" />
    </svg>
  )
  if (name === 'AlertTriangle') return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" x2="12" y1="9" y2="13" /><line x1="12" x2="12.01" y1="17" y2="17" />
    </svg>
  )
  if (name === 'CheckCircle') return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PENDING_APPROVAL: 'bg-yellow-100 text-yellow-800',
    LEVEL1_APPROVING: 'bg-blue-100 text-blue-800',
    LEVEL2_APPROVING: 'bg-purple-100 text-purple-800',
    EXECUTING: 'bg-teal-100 text-teal-800',
    COMPLETED: 'bg-green-100 text-green-800',
    CLOSED: 'bg-gray-100 text-gray-800',
  }
  const labels: Record<string, string> = {
    PENDING_APPROVAL: '待审批',
    LEVEL1_APPROVING: '一级审批',
    LEVEL2_APPROVING: '二级审批',
    EXECUTING: '执行中',
    COMPLETED: '已完成',
    CLOSED: '已关闭',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
      {labels[status] || status}
    </span>
  )
}