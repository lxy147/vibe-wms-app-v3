'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface ApprovalActionsProps {
  ticketId: string
  currentStatus: string
  version: number
  reportedById: string
  exceptionType: string
  source: string
  amount: number
  approverId: string
}

export default function ApprovalActions({
  ticketId,
  currentStatus,
  version,
  exceptionType,
  source,
  amount,
  approverId,
}: ApprovalActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [comment, setComment] = useState('')
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; role: string } | null>(null)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => setCurrentUser(data.user))
      .catch(() => {})
  }, [])

  const canApprove = currentStatus === 'LEVEL1_APPROVING' || currentStatus === 'LEVEL2_APPROVING'
  const canExecute = currentStatus === 'EXECUTING'

  const requiredRole = currentStatus === 'LEVEL1_APPROVING' ? 'LEVEL1_APPROVER' : 'LEVEL2_APPROVER'
  const hasRole = currentUser && (currentUser.role === requiredRole || currentUser.role === 'ADMIN')

  if (!canApprove && !canExecute) return null

  if (!currentUser) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <p className="text-sm text-muted-foreground text-center">
          请先<a href="/login" className="text-primary hover:underline">登录</a>后再进行审批
        </p>
      </div>
    )
  }

  if (canApprove && !hasRole) {
    return (
      <div className="bg-card border border-warning/30 rounded-xl p-6">
        <div className="flex items-center gap-3">
          <span className="text-warning text-lg font-bold">!</span>
          <div>
            <p className="text-sm font-medium text-foreground">无审批权限</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              当前账号 {currentUser.name}（{currentUser.role}），需要 {requiredRole} 角色
            </p>
          </div>
        </div>
      </div>
    )
  }

  const handleApprove = async (result: 'APPROVED' | 'REJECTED') => {
    setLoading(true)
    try {
      const res = await fetch(`/api/tickets/${ticketId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result, comment, version }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(result === 'APPROVED' ? '审批通过' : '已拒绝')
        router.refresh()
        setComment('')
      } else if (res.status === 409) {
        toast.error('该工单已被他人处理，请刷新页面')
      } else {
        toast.error(data.error || '操作失败')
      }
    } catch {
      toast.error('网络错误')
    } finally {
      setLoading(false)
    }
  }

  const handleExecute = async () => {
    setLoading(true)
    try {
      const isQC = source === 'SCAN_TRIGGERED' || exceptionType.startsWith('QC_')
      const res = await fetch(`/api/tickets/${ticketId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionType: isQC ? '退回供应商' : '理赔处理',
          compensationAmount: isQC ? amount * 0.3 : amount * 0.5,
          remark: comment,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('执行完成')
        router.refresh()
      } else {
        toast.error(data.error || '执行失败')
      }
    } catch {
      toast.error('网络错误')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-card border border-primary/20 rounded-xl p-6">
      {canApprove && (
        <div className="space-y-3">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="审批意见（选填）"
            rows={2}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
          />

          <div className="flex gap-3">
            <button
              onClick={() => handleApprove('APPROVED')}
              disabled={loading}
              className="flex-1 py-2.5 bg-success text-white rounded-lg font-medium text-sm hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {loading ? '...' : '同意'}
            </button>
            <button
              onClick={() => handleApprove('REJECTED')}
              disabled={loading}
              className="flex-1 py-2.5 bg-destructive text-white rounded-lg font-medium text-sm hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {loading ? '...' : '拒绝'}
            </button>
          </div>
        </div>
      )}

      {canExecute && (
        <div className="space-y-4">
          <h3 className="font-semibold text-foreground">执行操作</h3>
          <div className="p-3 bg-muted rounded-lg text-sm">
            <p className="text-muted-foreground">
              异常类型：<span className="text-foreground font-medium">{exceptionType}</span>
              &nbsp;·&nbsp; 赔付方向：
              <span className="text-foreground font-medium">
                {source === 'SCAN_TRIGGERED' || exceptionType.startsWith('QC_') ? '向供应商追偿' : '赔付客户'}
              </span>
            </p>
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="执行备注"
            rows={2}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
          />
          <button
            onClick={handleExecute}
            disabled={loading}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {loading ? '执行中...' : '确认执行'}
          </button>
        </div>
      )}
    </div>
  )
}