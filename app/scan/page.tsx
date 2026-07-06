'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface ScanResult {
  passed?: boolean
  warning?: string
  error?: string
  detail?: string
  matchedRules?: Array<{
    ruleId: string
    ruleName: string
    reason: string
    severity: string
  }>
  ticket?: { id: string }
  scanRecord?: { id: string }
}

export default function ScanPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    waybillExternalCode: '',
    skuCode: '',
    actualQuantity: '',
    damageLevel: '',
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)

  const handleScan = async () => {
    if (!form.waybillExternalCode || !form.skuCode) {
      toast.error('请输入运单号和 SKU 编码')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          waybillExternalCode: form.waybillExternalCode,
          skuCode: form.skuCode,
          operatorId: 'operator_a', // 模拟当前用户
          actualQuantity: form.actualQuantity ? parseFloat(form.actualQuantity) : undefined,
          damageLevel: form.damageLevel ? parseInt(form.damageLevel) : undefined,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setResult(data)
        if (data.passed) {
          toast.success('品控通过 ✓')
        } else if (data.warning) {
          toast.warning(data.warning)
        } else {
          toast.error(`品控异常 — ${data.matchedRules?.[0]?.ruleName || '未知规则'}`)
        }
      } else {
        toast.error(data.error || data.detail || '扫描失败')
        setResult(data)
      }
    } catch {
      toast.error('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleScan()
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">扫描品控</h2>
        <p className="text-sm text-muted-foreground mt-1">输入运单号和 SKU 编码进行品控检测</p>
      </div>

      {/* 扫描表单 */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-foreground mb-1.5">运单号 *</label>
            <input
              type="text"
              value={form.waybillExternalCode}
              onChange={(e) => setForm({ ...form, waybillExternalCode: e.target.value })}
              onKeyDown={handleKeyDown}
              placeholder="输入运单号，如 WB20260001"
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">SKU 编码 *</label>
            <input
              type="text"
              value={form.skuCode}
              onChange={(e) => setForm({ ...form, skuCode: e.target.value })}
              onKeyDown={handleKeyDown}
              placeholder="如 SKU-001-A"
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">实际数量</label>
            <input
              type="number"
              value={form.actualQuantity}
              onChange={(e) => setForm({ ...form, actualQuantity: e.target.value })}
              onKeyDown={handleKeyDown}
              placeholder="留空则使用预期数量"
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">破损等级 (1-4)</label>
            <input
              type="number"
              min="0"
              max="4"
              value={form.damageLevel}
              onChange={(e) => setForm({ ...form, damageLevel: e.target.value })}
              onKeyDown={handleKeyDown}
              placeholder="留空表示无破损"
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>

        <button
          onClick={handleScan}
          disabled={loading}
          className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:opacity-90 disabled:opacity-50 transition-all"
        >
          {loading ? '检测中...' : '执行扫描检测'}
        </button>
      </div>

      {/* 扫描结果 */}
      {result && (
        <div className={`bg-card border rounded-xl p-6 space-y-3 ${
          result.passed ? 'border-success/30' : result.warning ? 'border-warning/30' : 'border-destructive/30'
        }`}>
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              result.passed ? 'bg-success/10 text-success' : result.warning ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'
            }`}>
              {result.passed ? '✓' : result.warning ? '⚠' : '✗'}
            </div>
            <h3 className="font-semibold text-foreground">
              {result.passed ? '品控通过' : result.warning ? '重复扫描' : '品控异常'}
            </h3>
          </div>

          {result.matchedRules && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">命中规则：</p>
              {result.matchedRules.map((rule, i) => (
                <div key={i} className="bg-muted/50 rounded-lg p-3 text-sm">
                  <p className="font-medium">{rule.ruleName}</p>
                  <p className="text-muted-foreground text-xs mt-1">{rule.reason}</p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs mt-2 ${
                    rule.severity === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                    rule.severity === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {rule.severity}
                  </span>
                </div>
              ))}
            </div>
          )}

          {result.ticket && (
            <button
              onClick={() => router.push(`/tickets/${result.ticket!.id}`)}
              className="text-sm text-primary hover:underline"
            >
              查看工单详情 →
            </button>
          )}

          {result.warning && (
            <p className="text-sm text-muted-foreground">{result.warning}</p>
          )}

          {result.error && (
            <p className="text-sm text-destructive">{result.error as string}</p>
          )}
        </div>
      )}
    </div>
  )
}