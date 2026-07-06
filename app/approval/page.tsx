import Link from 'next/link'
import { db } from '@/lib/db'
import { STATUS_LABELS, STATUS_COLORS, EXCEPTION_TYPE_LABELS } from '@/lib/state-machine'
import { formatDateTime, formatCurrency } from '@/lib/utils'

export default async function ApprovalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page || '1'))
  const pageSize = 20
  const status = params.status
  const exceptionType = params.exceptionType
  const search = params.search
  const sortBy = params.sortBy || 'createdAt'
  const sortOrder = params.sortOrder || 'desc'

  const where: Record<string, unknown> = {
    currentStatus: { in: ['LEVEL1_APPROVING', 'LEVEL2_APPROVING'] },
  }
  if (status) where.currentStatus = status
  if (exceptionType) where.exceptionType = exceptionType
  if (search) {
    where.OR = [
      { waybillSnapshot: { externalCode: { contains: search } } },
      { waybillSnapshot: { storeName: { contains: search } } },
    ]
  }

  const orderBy: Record<string, string> = { [sortBy]: sortOrder }

  const [tickets, total] = await Promise.all([
    db.exceptionTicket.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy,
      include: {
        waybillSnapshot: { select: { externalCode: true, storeName: true } },
        reportedBy: { select: { id: true, name: true } },
        currentApprover: { select: { id: true, name: true } },
      },
    }),
    db.exceptionTicket.count({ where }),
  ])

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">待审批</h2>
        <p className="text-sm text-muted-foreground mt-1">共 {total} 条待审批工单</p>
      </div>

      {/* 筛选栏 */}
      <form className="bg-card border border-border rounded-xl p-4 flex flex-wrap gap-3 items-center">
        <input
          name="search"
          defaultValue={search || ''}
          placeholder="搜索运单号/门店..."
          className="px-3 py-2 border border-border rounded-lg bg-background text-sm w-48 focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <select name="status" defaultValue={status || ''} className="px-3 py-2 border border-border rounded-lg bg-background text-sm">
          <option value="">全部状态</option>
          <option value="LEVEL1_APPROVING">一级审批中</option>
          <option value="LEVEL2_APPROVING">二级审批中</option>
        </select>
        <select name="exceptionType" defaultValue={exceptionType || ''} className="px-3 py-2 border border-border rounded-lg bg-background text-sm">
          <option value="">全部类型</option>
          <option value="LOST">丢件</option>
          <option value="DAMAGED">破损</option>
          <option value="REJECTED_BY_CUSTOMER">客户拒收</option>
          <option value="TIMEOUT_DELIVERY">超时未签收</option>
          <option value="WRONG_ADDRESS">地址错误</option>
          <option value="QC_QUANTITY_MISMATCH">QC数量不符</option>
          <option value="QC_APPEARANCE_DAMAGE">QC外观破损</option>
          <option value="QC_SPEC_MISMATCH">QC规格不符</option>
          <option value="QC_LABEL_ERROR">QC标签错误</option>
          <option value="QC_BATCH_ABNORMAL">QC批次异常</option>
        </select>
        <select name="sortBy" defaultValue={sortBy} className="px-3 py-2 border border-border rounded-lg bg-background text-sm">
          <option value="createdAt">按创建时间</option>
          <option value="amount">按金额</option>
          <option value="updatedAt">按更新时间</option>
        </select>
        <select name="sortOrder" defaultValue={sortOrder} className="px-3 py-2 border border-border rounded-lg bg-background text-sm">
          <option value="desc">降序</option>
          <option value="asc">升序</option>
        </select>
        <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
          筛选
        </button>
        <a href="/approval" className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted transition-all inline-flex items-center">
          重置
        </a>
      </form>

      {/* 工单列表 */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">运单号</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">金额</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">异常类型</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">状态</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">上报人</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">审批人</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">时间</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">操作</th>
              </tr>
            </thead>
            <tbody>
              {tickets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-muted-foreground">暂无待审批工单</td>
                </tr>
              ) : (
                tickets.map((ticket) => (
                  <tr key={ticket.id} className="border-b border-border hover:bg-muted/30">
                    <td className="px-5 py-3">
                      <Link href={`/tickets/${ticket.id}`} className="text-primary hover:underline font-medium text-sm">
                        {ticket.waybillSnapshot.externalCode || '—'}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-sm font-medium">{formatCurrency(ticket.amount)}</td>
                    <td className="px-5 py-3 text-sm">{EXCEPTION_TYPE_LABELS[ticket.exceptionType]}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[ticket.currentStatus]}`}>
                        {STATUS_LABELS[ticket.currentStatus]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm">{ticket.reportedBy.name}</td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">{ticket.currentApprover?.name || '—'}</td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">{formatDateTime(ticket.createdAt)}</td>
                    <td className="px-5 py-3">
                      <Link href={`/tickets/${ticket.id}`} className="text-primary hover:underline text-sm font-medium">
                        审批 →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-border flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              第 {page} / {totalPages} 页，共 {total} 条
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <a
                  href={`/approval?page=${page - 1}${status ? `&status=${status}` : ''}${exceptionType ? `&exceptionType=${exceptionType}` : ''}${search ? `&search=${search}` : ''}${sortBy !== 'createdAt' ? `&sortBy=${sortBy}` : ''}${sortOrder !== 'desc' ? `&sortOrder=${sortOrder}` : ''}`}
                  className="px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-muted transition-all"
                >
                  上一页
                </a>
              )}
              {page < totalPages && (
                <a
                  href={`/approval?page=${page + 1}${status ? `&status=${status}` : ''}${exceptionType ? `&exceptionType=${exceptionType}` : ''}${search ? `&search=${search}` : ''}${sortBy !== 'createdAt' ? `&sortBy=${sortBy}` : ''}${sortOrder !== 'desc' ? `&sortOrder=${sortOrder}` : ''}`}
                  className="px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-muted transition-all"
                >
                  下一页
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}