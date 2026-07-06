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
  const [showApprove, setShowApprove] = useState(false)
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => setCurrentUser(data.user))
      .catch(() => {})
  }, [])

  const canApprove = currentStatus === 'LEVEL1_APPROVING' || currentStatus === 'LEVEL2_APPROVING'
  const canExecute = currentStatus === 'EXECUTING'
  const isApprover = currentUser?.id === approverId

  if (!canApprove && !canExecute) return null

  if (canApprove && !isApprover) {
    return (
      <div className="bg-card border border-warning/30 rounded-xl p-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-warning/10 flex items-center justify-center text-warning text-sm font-bold">!</div>
          <div>
            <p className="text-sm font-medium text-foreground">非当前指派的审批人</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              当前登录账号：{currentUser?.name || '未登录'}。该工单指派给了其他审批人，请使用对应账号登录后审批
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (canApprove && !currentUser) {
    return (
      <div className="bg-card border border-warning/30 rounded-xl p-6">
        <p className="text-sm text-muted-foreground">
          请先<a href="/login" className="text-primary hover:underline">登录</a>后再进行审批操作
        </p>
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
        setShowApprove(false)
        setComment('')
      } else if (res.status === 401) {
        toast.error('请先登录')
        router.push('/login')
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
    if (!comment.trim()) {
      toast.error('请填写执行备注')
      return
    }
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
        <>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">审批操作</h3>
            {!showApprove && (
              <button
                onClick={() => setShowApprove(true)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
              >
                开始审批
              </button>
            )}
          </div>

          {showApprove && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">审批意见</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="请填写审批意见..."
                  rows={3}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => handleApprove('APPROVED')}
                  disabled={loading}
                  className="flex-1 py-2.5 bg-success text-success-foreground rounded-lg font-medium text-sm hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? '处理中...' : '✓ 审批通过'}
                </button>
                <button
                  onClick={() => handleApprove('REJECTED')}
                  disabled={loading}
                  className="flex-1 py-2.5 bg-destructive text-destructive-foreground rounded-lg font-medium text-sm hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? '处理中...' : '✗ 拒绝'}
                </button>
                <button
                  onClick={() => setShowApprove(false)}
                  disabled={loading}
                  className="px-4 py-2.5 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted"
                >
                  取消
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {canExecute && (
        <>
          <h3 className="font-semibold text-foreground mb-4">执行操作</h3>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg text-sm">
              <p className="text-muted-foreground">
                异常类型：<span className="text-foreground font-medium">{exceptionType}</span>
                &nbsp;·&nbsp; 赔付方向：
                <span className="text-foreground font-medium">
                  {source === 'SCAN_TRIGGERED' || exceptionType.startsWith('QC_') ? '向供应商追偿' : '赔付客户'}
                </span>
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">执行备注 *</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="请填写执行备注..."
                rows={2}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              />
            </div>
            <button
              onClick={handleExecute}
              disabled={loading}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:opacity-90 disabled:opacity-50"
            >
              {loading ? '执行中...' : '确认执行'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}