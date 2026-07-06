import { cookies } from 'next/headers'
import { db } from './db'

export type AuthUser = {
  id: string
  username: string
  name: string
  role: string
}

const COOKIE_NAME = 'v3_user_id'

// 获取当前登录用户
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get(COOKIE_NAME)?.value
    if (!userId) return null

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, name: true, role: true, isActive: true },
    })

    if (!user || !user.isActive) return null
    return { id: user.id, username: user.username, name: user.name, role: user.role }
  } catch {
    return null
  }
}

// 检查用户角色权限
export function hasRole(user: AuthUser | null, ...roles: string[]): boolean {
  if (!user) return false
  return roles.includes(user.role)
}

// 检查是否为品控主管
export function isQCSupervisor(user: AuthUser | null): boolean {
  return hasRole(user, 'QC_SUPERVISOR', 'ADMIN')
}

// 检查是否为一级审批人
export function isLevel1Approver(user: AuthUser | null): boolean {
  return hasRole(user, 'LEVEL1_APPROVER', 'ADMIN')
}

// 检查是否为二级审批人
export function isLevel2Approver(user: AuthUser | null): boolean {
  return hasRole(user, 'LEVEL2_APPROVER', 'ADMIN')
}

// 检查是否为管理员
export function isAdmin(user: AuthUser | null): boolean {
  return hasRole(user, 'ADMIN')
}

// 生成认证 Token（简化版，使用 cookie）
export function setAuthCookie(userId: string): { name: string; value: string; httpOnly: boolean; path: string; maxAge: number } {
  return {
    name: COOKIE_NAME,
    value: userId,
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 天
  }
}