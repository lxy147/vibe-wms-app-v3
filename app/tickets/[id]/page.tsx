import Link from 'next/link'
import { db } from '@/lib/db'
import { STATUS_LABELS, STATUS_COLORS, EXCEPTION_TYPE_LABELS, EXCEPTION_SOURCE_LABELS, COMPENSATION_DIRECTION_LABELS, BATCH_STATUS_LABELS, BATCH_STATUS_COLORS } from '@/lib/state-machine'
import { formatDateTime, formatCurrency } from '@/lib/utils'
import ApprovalActions from '@/components/tickets/approval-actions'

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const ticket = await db.exceptionTicket.findUnique({
    where: { id },
    include: {
      waybillSnapshot: true,
      reportedBy: { select: { id: true, username: true, name: true, role: true } },
      currentApprover: { select: { id: true, username: true, name: true, role: true } },
      approvalRecords: {
        orderBy: { createdAt: 'asc' },
        include: { approver: { select: { id: true, name: true, role: true } } },
      },
      compensationRecords: { orderBy: { createdAt: 'desc' } },
      scanRecords: {
        orderBy: { createdAt: 'desc' },
        include: { operator: { select: { name: true } }, qcRule: { select: { name: true } } },
      },
      inventory: { select: { id: true, skuCode: true, skuName: true, quantity: true, batchStatus: true } },
    },
  })

  if (!ticket) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-bold text-foreground">工单不存在</h2>
        <Link href="/tickets" className="text-primary hover:underline mt-2 inline-block">返回列表</Link>
      </div>
    )
  }

  const isFromCache = Date.now() - ticket.waybillSnapshot.lastSyncedAt.getTime() > 5 * 60 * 1000

  return (
    <div className="p-6 space-y-6">
      {/* 面包屑 */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/tickets" className="hover:text-foreground">工单列表</Link>
        <span>/</span>
        <span className="text-foreground">{ticket.waybillSnapshot.externalCode}</span>
      </div>

      {/* 工单头 */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-foreground">{ticket.waybillSnapshot.externalCode || '—'}</h2>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[ticket.currentStatus]}`}>
                {STATUS_LABELS[ticket.currentStatus]}
              </span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                ticket.source === 'SCAN_TRIGGERED' ? 'bg-teal-100 text-teal-800' : 'bg-blue-100 text-blue-800'
              }`}>
                {EXCEPTION_SOURCE_LABELS[ticket.source]}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {EXCEPTION_TYPE_LABELS[ticket.exceptionType]} · 上报人：{ticket.reportedBy.name} · {formatDateTime(ticket.createdAt)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-foreground">{formatCurrency(ticket.amount)}</p>
            <p className="text-xs text-muted-foreground">涉及金额</p>
          </div>
        </div>
      </div>

      {/* 审批操作 */}
      {(ticket.currentStatus === 'LEVEL1_APPROVING' || ticket.currentStatus === 'LEVEL2_APPROVING') && (
        <div className="bg-card border border-primary/20 rounded-xl p-6">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-foreground">
              {ticket.currentStatus === 'LEVEL1_APPROVING' ? '一级审批中' : '二级审批中'}
            </h3>
          </div>
          <ApprovalActions
            ticketId={ticket.id}
            currentStatus={ticket.currentStatus}
            version={ticket.version}
            reportedById={ticket.reportedById}
            exceptionType={ticket.exceptionType}
            source={ticket.source}
            amount={ticket.amount}
            approverId={ticket.currentApprover?.id || ''}
          />
        </div>
      )}

      {ticket.currentStatus === 'EXECUTING' && (
        <ApprovalActions
          ticketId={ticket.id}
          currentStatus={ticket.currentStatus}
          version={ticket.version}
          reportedById={ticket.reportedById}
          exceptionType={ticket.exceptionType}
          source={ticket.source}
          amount={ticket.amount}
          approverId={ticket.currentApprover?.id || ''}
        />
      )}

      {/* 运单信息 */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">运单信息</h3>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
            isFromCache ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isFromCache ? 'bg-yellow-500' : 'bg-green-500'}`} />
            {isFromCache
              ? `本地缓存，同步于 ${formatDateTime(ticket.waybillSnapshot.lastSyncedAt)}`
              : '实时获取自 V2'}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div><span className="text-muted-foreground">门店：</span>{ticket.waybillSnapshot.storeName || '—'}</div>
          <div><span className="text-muted-foreground">收件人：</span>{ticket.waybillSnapshot.recipientName || '—'}</div>
          <div><span className="text-muted-foreground">电话：</span>{ticket.waybillSnapshot.recipientPhone || '—'}</div>
          <div className="col-span-2 md:col-span-3"><span className="text-muted-foreground">地址：</span>{ticket.waybillSnapshot.recipientAddress || '—'}</div>
        </div>
      </div>

      {/* 异常描述 */}
      {ticket.description && (
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold text-foreground mb-2">异常描述</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{ticket.description}</p>
        </div>
      )}

      {/* 审批时间线 */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="font-semibold text-foreground mb-4">审批记录</h3>
        {ticket.approvalRecords.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无审批记录</p>
        ) : (
          <div className="space-y-0">
            {ticket.approvalRecords.map((record, idx) => (
              <div key={record.id} className="flex gap-4 pb-4 relative">
                {idx < ticket.approvalRecords.length - 1 && (
                  <div className="absolute left-[11px] top-8 bottom-0 w-0.5 bg-border" />
                )}
                <div className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-xs mt-1 ${
                  record.result === 'APPROVED' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                }`}>
                  {record.result === 'APPROVED' ? '✓' : '✗'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{record.approver.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {record.level === 'LEVEL1' ? '一级审批' : '二级审批'}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      record.result === 'APPROVED' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                    }`}>
                      {record.result === 'APPROVED' ? '通过' : '拒绝'}
                    </span>
                  </div>
                  {record.comment && <p className="text-sm text-muted-foreground mt-1">{record.comment}</p>}
                  <p className="text-xs text-muted-foreground mt-1">{formatDateTime(record.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 扫描记录 */}
      {ticket.scanRecords.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold text-foreground mb-4">扫描记录</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 text-xs text-muted-foreground">SKU</th>
                <th className="text-left py-2 text-xs text-muted-foreground">结果</th>
                <th className="text-left py-2 text-xs text-muted-foreground">批次状态</th>
                <th className="text-left py-2 text-xs text-muted-foreground">操作人</th>
                <th className="text-left py-2 text-xs text-muted-foreground">时间</th>
              </tr>
            </thead>
            <tbody>
              {ticket.scanRecords.map((scan) => (
                <tr key={scan.id} className="border-b border-border">
                  <td className="py-2">{scan.skuCode} ({scan.skuName})</td>
                  <td className="py-2">
                    <span className={`px-1.5 py-0.5 rounded text-xs ${scan.scanResult === 'PASSED' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                      {scan.scanResult === 'PASSED' ? '通过' : '暂扣'}
                    </span>
                  </td>
                  <td className="py-2">
                    <span className={`px-1.5 py-0.5 rounded text-xs ${BATCH_STATUS_COLORS[scan.batchStatus]}`}>
                      {BATCH_STATUS_LABELS[scan.batchStatus]}
                    </span>
                  </td>
                  <td className="py-2">{scan.operator.name}</td>
                  <td className="py-2 text-muted-foreground">{formatDateTime(scan.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 赔付记录 */}
      {ticket.compensationRecords.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold text-foreground mb-4">赔付记录</h3>
          {ticket.compensationRecords.map((comp) => (
            <div key={comp.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
              <div>
                <p className="text-sm font-medium">{formatCurrency(comp.amount)}</p>
                <p className="text-xs text-muted-foreground">
                  {COMPENSATION_DIRECTION_LABELS[comp.direction]} · {comp.remark || ''}
                </p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                comp.status === 'EXECUTED' ? 'bg-green-100 text-green-800' : comp.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {comp.status === 'EXECUTED' ? '已执行' : comp.status === 'PENDING' ? '待执行' : '已取消'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 库存状态 */}
      {ticket.inventory.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold text-foreground mb-4">关联库存</h3>
          {ticket.inventory.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div>
                <p className="text-sm font-medium">{inv.skuCode} — {inv.skuName}</p>
                <p className="text-xs text-muted-foreground">数量: {inv.quantity}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${BATCH_STATUS_COLORS[inv.batchStatus]}`}>
                {BATCH_STATUS_LABELS[inv.batchStatus]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}