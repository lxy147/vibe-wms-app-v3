'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

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

export default function UserMenu() {
  const router = useRouter()
  const [user, setUser] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    router.push('/login')
    router.refresh()
  }

  if (loading) {
    return <div className="px-3 py-2 text-xs text-sidebar-foreground/40">加载中...</div>
  }

  if (!user) {
    return (
      <button
        onClick={() => router.push('/login')}
        className="w-full px-3 py-2 rounded-lg text-sm font-medium text-sidebar-foreground bg-primary/15 hover:bg-primary/25 transition-all"
      >
        登录
      </button>
    )
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
          <span className="text-primary text-xs font-bold">{user.name[0]}</span>
        </div>
        <div>
          <p className="text-sm font-medium text-sidebar-foreground">{user.name}</p>
          <p className="text-xs text-sidebar-foreground/50">{roleLabels[user.role] || user.role}</p>
        </div>
      </div>
      <button
        onClick={handleLogout}
        className="text-xs text-sidebar-foreground/40 hover:text-sidebar-foreground/70 transition-colors"
      >
        退出
      </button>
    </div>
  )
}