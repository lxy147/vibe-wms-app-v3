import { NextResponse } from 'next/server'

export async function POST() {
  const response = NextResponse.json({ success: true })
  response.cookies.set('v3_user_id', '', {
    httpOnly: true,
    path: '/',
    maxAge: 0,
  })
  return response
}