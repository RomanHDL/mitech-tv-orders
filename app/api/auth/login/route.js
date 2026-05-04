import { NextResponse } from 'next/server'
import { buscarUsuario, emailValido, pinValido } from '@/lib/auth'

export async function POST(req) {
  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const pin = typeof body.pin === 'string' ? body.pin.trim() : ''

  if (!pinValido(pin)) {
    return NextResponse.json(
      { error: 'El PIN debe ser mínimo 6 dígitos numéricos' },
      { status: 400 }
    )
  }
  if (email && !emailValido(email)) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
  }

  const user = await buscarUsuario(email, pin)
  if (!user) {
    return NextResponse.json({ error: 'Email o PIN incorrecto' }, { status: 401 })
  }

  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 días
    path: '/',
  }

  const response = NextResponse.json({ rol: user.rol, email: user.email })
  response.cookies.set('rol', user.rol, cookieOpts)
  response.cookies.set('userId', user._id.toString(), cookieOpts)
  response.cookies.set('email', user.email, cookieOpts)
  if (user.nombre) {
    response.cookies.set('nombre', user.nombre, cookieOpts)
  }
  return response
}
