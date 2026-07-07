'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'

interface UserInfo {
  id: string
  name: string
  role: string
}

const roleLabels: Record<string, string> = {
  ADMIN: '管理员',
  QC_SUPERVISOR: '品控主管',
  LEVEL1_APPROVER: '一级审批人',
  LEVEL2_APPROVER: '二级审批人',
  OPERATOR: '操作员',
}

export default function Header() {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<UserInfo | null>(null)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user)
        else setUser(null)
      })
      .catch(() => {})
  }, [pathname])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-sm">W3</span>
        </div>
        <h1 className="text-sm font-semibold text-foreground">运单全流程管理</h1>
      </div>

      <div className="flex items-center gap-4">
        {user ? (
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">{user.name}</p>
              <p className="text-xs text-muted-foreground">{roleLabels[user.role] || user.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              退出
            </button>
          </div>
        ) : (
          <button
            onClick={() => router.push('/login')}
            className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-all"
          >
            登录
          </button>
        )}
      </div>
    </header>
  )
}