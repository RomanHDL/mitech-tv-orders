import { NextResponse } from 'next/server'

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete('rol')
  response.cookies.delete('userId')
  response.cookies.delete('email')
  response.cookies.delete('nombre')
  return response
}
