import { NextResponse } from 'next/server'
import { buscarUsuario, emailValido, pinValido } from '@/lib/auth'
import { sanearModulos } from '@/lib/modulos'
import { getServerT } from '@/lib/i18n-server'

export async function POST(req) {
  const t = await getServerT()
  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: t('apiComun.jsonInvalido') }, { status: 400 })
  }

  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const pin = typeof body.pin === 'string' ? body.pin.trim() : ''
  const nfcUid = typeof body.nfcUid === 'string' ? body.nfcUid.trim() : ''

  let user

  if (nfcUid) {
    // Login por UID del tag NFC (no requiere PIN)
    user = await buscarUsuario({ nfcUid })
    if (!user) {
      return NextResponse.json({ error: t('apiAuth.tagNfcNoRegistrado') }, { status: 401 })
    }
  } else {
    // Login manual con email + PIN (o solo PIN único)
    if (!pinValido(pin)) {
      return NextResponse.json(
        { error: t('login.errorPinCorto') },
        { status: 400 }
      )
    }
    if (email && !emailValido(email)) {
      return NextResponse.json({ error: t('login.errorEmailInvalido') }, { status: 400 })
    }
    user = await buscarUsuario({ email, pin })
    if (!user) {
      return NextResponse.json({ error: t('apiAuth.emailOPinIncorrecto') }, { status: 401 })
    }
  }

  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 días
    path: '/',
  }

  // buscarUsuario() ya garantiza allowedModules (lo rellena con el default
  // del rol si el usuario es de antes de que existiera este campo).
  const allowedModules = sanearModulos(user.allowedModules)

  const response = NextResponse.json({ rol: user.rol, email: user.email || null, allowedModules })
  response.cookies.set('rol', user.rol, cookieOpts)
  response.cookies.set('userId', user._id.toString(), cookieOpts)
  response.cookies.set('allowedModules', JSON.stringify(allowedModules), cookieOpts)
  if (user.email) {
    response.cookies.set('email', user.email, cookieOpts)
  }
  if (user.nombre) {
    response.cookies.set('nombre', user.nombre, cookieOpts)
  }
  return response
}
