'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

const EXCEPTION_TYPES = [
  { value: 'LOST', label: '丢件', category: '物流' },
  { value: 'DAMAGED', label: '破损', category: '物流' },
  { value: 'REJECTED_BY_CUSTOMER', label: '客户拒收', category: '物流' },
  { value: 'TIMEOUT_DELIVERY', label: '超时未签收', category: '物流' },
  { value: 'WRONG_ADDRESS', label: '收货地址错误', category: '物流' },
]

const SEVERITIES = [
  { value: 'LOW', label: '低' },
  { value: 'MEDIUM', label: '中' },
  { value: 'HIGH', label: '高' },
  { value: 'CRITICAL', label: '严重' },
]

export default function CreateTicketPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    waybillExternalCode: '',
    exceptionType: 'LOST',
    description: '',
    severity: 'MEDIUM',
    amount: '',
  })

  const handleSubmit = async () => {
    if (!form.waybillExternalCode) {
      toast.error('请输入运单号')
      return
    }
    if (!form.description.trim()) {
      toast.error('请描述异常情况')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          waybillExternalCode: form.waybillExternalCode,
          exceptionType: form.exceptionType,
          description: form.description,
          severity: form.severity,
          amount: form.amount ? parseFloat(form.amount) : undefined,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        toast.success('工单创建成功')
        router.push(`/tickets/${data.ticket.id}`)
      } else {
        toast.error(data.error || data.detail || '创建失败')
      }
    } catch {
      toast.error('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">手工上报异常</h2>
        <p className="text-sm text-muted-foreground mt-1">填写运单号和异常信息创建工单</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">运单号 *</label>
          <input
            type="text"
            value={form.waybillExternalCode}
            onChange={(e) => setForm({ ...form, waybillExternalCode: e.target.value })}
            placeholder="输入运单号，如 WB20260001"
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          <p className="text-xs text-muted-foreground mt-1">系统将通过 V2 接口实时校验运单是否存在</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">异常类型 *</label>
          <select
            value={form.exceptionType}
            onChange={(e) => setForm({ ...form, exceptionType: e.target.value })}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {EXCEPTION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label} ({t.category})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">严重程度</label>
          <select
            value={form.severity}
            onChange={(e) => setForm({ ...form, severity: e.target.value })}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {SEVERITIES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">金额 (¥)</label>
          <input
            type="number"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            placeholder="异常涉及金额"
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">异常描述 *</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="详细描述异常情况..."
            rows={4}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:opacity-90 disabled:opacity-50 transition-all"
        >
          {loading ? '提交中...' : '提交工单'}
        </button>
      </div>
    </div>
  )
}