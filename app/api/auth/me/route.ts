import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('v3_user_id')?.value
    if (!userId) {
      return NextResponse.json({ user: null })
    }
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, name: true, role: true, isActive: true },
    })
    if (!user || !user.isActive) {
      return NextResponse.json({ user: null })
    }
    return NextResponse.json({ user })
  } catch {
    return NextResponse.json({ user: null })
  }
}