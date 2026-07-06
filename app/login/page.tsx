'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export default function LoginPage() {
  const router = useRouter()
  const [form, setForm] = useState({ username: '', password: '' })
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!form.username || !form.password) {
      toast.error('请输入用户名和密码')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`欢迎，${data.user.name}`)
        router.push('/')
        router.refresh()
      } else {
        toast.error(data.error || '登录失败')
      }
    } catch {
      toast.error('网络错误')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mx-auto mb-3 shadow-md">
            <span className="text-primary-foreground font-bold text-lg">W3</span>
          </div>
          <h1 className="text-xl font-bold text-foreground">运单全流程管理</h1>
          <p className="text-sm text-muted-foreground mt-1">登录系统</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">用户名</label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              placeholder="输入用户名"
              autoFocus
              className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">密码</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              placeholder="输入密码"
              className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </div>

        <div className="mt-6 p-4 bg-card border border-border rounded-xl">
          <p className="text-xs font-medium text-muted-foreground mb-2">测试账号</p>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>管理员：admin / 123456</p>
            <p>一级审批：approver1_a / 123456</p>
            <p>二级审批：approver2_a / 123456</p>
            <p>品控主管：qc_supervisor / 123456</p>
            <p>操作员：operator_a / 123456</p>
          </div>
        </div>
      </div>
    </div>
  )
}