import { NextResponse } from 'next/server'
import { rolDePin } from '@/lib/auth'

export async function POST(req) {
  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { pin } = body
  if (typeof pin !== 'string' || !pin.trim()) {
    return NextResponse.json({ error: 'PIN requerido' }, { status: 400 })
  }

  const rol = rolDePin(pin)
  if (!rol) {
    return NextResponse.json({ error: 'PIN incorrecto' }, { status: 401 })
  }

  const response = NextResponse.json({ rol })
  response.cookies.set('rol', rol, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 días
    path: '/',
  })
  return response
}
