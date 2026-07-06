import type { Metadata } from 'next'
import { Toaster } from 'sonner'
import Sidebar from '@/components/layout/sidebar'
import './globals.css'

export const metadata: Metadata = {
  title: '运单全流程管理 V3',
  description: '录单 → 扫描品控 → 异常上报 → 分级审批 → 执行联动 —— 运单全生命周期管理',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: 'var(--card)',
              color: 'var(--card-foreground)',
              border: '1px solid var(--border)',
            },
          }}
        />
      </body>
    </html>
  )
}