import { NextResponse } from 'next/server'

export function middleware(request) {
  const { pathname } = request.nextUrl
  const method = request.method

  // Rutas públicas: login, endpoints de auth y descubrimiento del stack
  if (
    pathname === '/login' ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    pathname === '/stack' ||
    pathname === '/stack.json' ||
    pathname === '/stack.md' ||
    pathname === '/llms.txt' ||
    pathname === '/sitemap.xml' ||
    pathname === '/robots.txt' ||
    pathname === '/api/public/stack' ||
    pathname === '/api/public/health'
  ) {
    return NextResponse.next()
  }

  const rol = request.cookies.get('rol')?.value
  const isApi = pathname.startsWith('/api/')

  if (!rol) {
    if (isApi) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (!verificarAcceso(pathname, method, rol)) {
    if (isApi) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    // Redirigir a la home del rol
    const url = request.nextUrl.clone()
    url.pathname = homeDelRol(rol)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

function homeDelRol(rol) {
  if (rol === 'surtidor') return '/surtir'
  if (rol === 'capturista') return '/'
  return '/pedidos' // admin
}

function verificarAcceso(pathname, method, rol) {
  // Imprimir HTML: cualquier rol logueado puede ver e imprimir
  if (/^\/pedidos\/[^/]+\/imprimir$/.test(pathname)) return true

  // Changelog: la página HTML y el "descartar" son para cualquier rol logueado
  if (pathname === '/changelog') return true
  if (method === 'POST' && /^\/api\/changelog\/[^/]+\/dismiss$/.test(pathname)) return true

  // Manual de usuario: lectura para cualquier rol logueado (GET de su API ya
  // queda cubierto por la regla general de abajo)
  if (pathname === '/manual' || pathname.startsWith('/manual/')) return true

  // Developer Manual (documentación técnica del esquema): cualquier rol logueado
  if (pathname === '/developer-manual.md') return true

  // GET de cualquier API: cualquier rol logueado
  if (method === 'GET' && pathname.startsWith('/api/')) return true

  // Admin: acceso total
  if (rol === 'admin') return true

  if (rol === 'capturista') {
    // HTML: '/' (form), '/pedidos' (listar), '/historial' (solo lo suyo,
    // filtrado en el propio endpoint/página) y validación de sus pedidos.
    // Nota: nav.jsx ya mostraba el link a Historial para capturista; esta
    // regla estaba faltando, así que hoy ese link redirigía a su home sin
    // avisar — se corrige aquí.
    if (pathname === '/' || pathname === '/pedidos') return true
    if (pathname === '/historial' || pathname.startsWith('/historial/')) return true
    if (pathname === '/surtir' || pathname.startsWith('/surtir/')) return true
    // API: crear pedidos y tracking de validación (la validación de ownership
    // se hace en el handler para devolver 403 cuando no es su pedido)
    if (method === 'POST' && pathname === '/api/pedidos') return true
    if (method === 'PATCH' && /^\/api\/pedidos\/[^/]+$/.test(pathname)) return true
    return false
  }

  if (rol === 'surtidor') {
    // HTML: módulo de surtido
    if (pathname === '/surtir' || pathname.startsWith('/surtir/')) return true
    // API: PATCH para tracking de surtido y cambio de etapa logística
    // (carga/salida/despacho — el piso es quien mueve el pedido físicamente)
    if (method === 'PATCH' && /^\/api\/pedidos\/[^/]+$/.test(pathname)) return true
    if (method === 'PATCH' && /^\/api\/pedidos\/[^/]+\/estado$/.test(pathname)) return true
    return false
  }

  return false
}

export const config = {
  matcher: [
    // Match all routes except static files
    '/((?!_next/static|_next/image|favicon.ico|mitech-icon.png).*)',
  ],
}
