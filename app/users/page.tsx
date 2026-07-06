import Link from 'next/link'
import { db } from '@/lib/db'

export default async function UsersPage() {
  const users = await db.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  })

  const roleLabels: Record<string, string> = {
    ADMIN: '管理员',
    QC_SUPERVISOR: '品控主管',
    LEVEL1_APPROVER: '一级审批人',
    LEVEL2_APPROVER: '二级审批人',
    OPERATOR: '操作员',
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">用户管理</h2>
        <p className="text-sm text-muted-foreground mt-1">系统用户与角色权限</p>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">用户名</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">姓名</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">角色</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">状态</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase">创建时间</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-border hover:bg-muted/30">
                <td className="px-5 py-3 text-sm font-medium">{user.username}</td>
                <td className="px-5 py-3 text-sm">{user.name}</td>
                <td className="px-5 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    user.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' :
                    user.role === 'QC_SUPERVISOR' ? 'bg-teal-100 text-teal-800' :
                    user.role === 'LEVEL2_APPROVER' ? 'bg-orange-100 text-orange-800' :
                    user.role === 'LEVEL1_APPROVER' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {roleLabels[user.role] || user.role}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {user.isActive ? '活跃' : '禁用'}
                  </span>
                </td>
                <td className="px-5 py-3 text-sm text-muted-foreground">
                  {new Date(user.createdAt).toLocaleDateString('zh-CN')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}