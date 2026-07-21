// Catálogo de módulos de la aplicación — usado por el formulario de
// Usuarios, el nav dinámico, el middleware y los guardas de las APIs.
// Identificadores INTERNOS estables (no cambian aunque el texto visible se
// traduzca) — nunca guardar el label, siempre el id.
//
// Este archivo no importa nada del servidor (getDb, cookies, etc.) a
// propósito: se usa tanto en Server Components / route handlers como en
// Client Components (formulario, nav), igual que lib/catalogos.js.

// Orden canónico = orden real del menú. El nav y la cuadrícula de permisos
// del formulario usan este mismo orden para que "lo que ves en el menú" y
// "lo que marcas en Usuarios" sean consistentes.
export const MODULOS = [
  { id: 'new-order', labelKey: 'modulos.nuevo', href: '/' },
  { id: 'orders', labelKey: 'modulos.pedidos', href: '/pedidos' },
  { id: 'live-orders', labelKey: 'modulos.pedidosLive', href: '/pedidos-live' },
  { id: 'history', labelKey: 'modulos.historial', href: '/historial' },
  { id: 'picking', labelKey: 'modulos.surtir', href: '/surtir' },
  { id: 'onn-catalog', labelKey: 'modulos.catalogoOnn', href: '/admin/catalogo-onn' },
  { id: 'users', labelKey: 'modulos.usuarios', href: '/admin/usuarios' },
  { id: 'manual', labelKey: 'modulos.manual', href: '/manual' },
  { id: 'manual-editor', labelKey: 'modulos.editarManual', href: '/admin/manual' },
  { id: 'changelog', labelKey: 'modulos.changelog', href: '/changelog' },
]

export const MODULO_IDS = MODULOS.map((m) => m.id)

// Permisos predeterminados por rol — se aplican al crear un usuario y
// cuando se pulsa "Según rol". No son restricciones permanentes: el admin
// puede modificarlos a mano después, tanto al crear como al editar.
export const DEFAULT_MODULOS_POR_ROL = {
  admin: [...MODULO_IDS],
  capturista: ['new-order', 'orders', 'live-orders', 'history', 'onn-catalog', 'manual', 'changelog'],
  surtidor: ['orders', 'live-orders', 'history', 'picking', 'manual', 'changelog'],
}

// Whitelist real: descarta cualquier id que no exista en el catálogo (por
// si llega algo manual desde Postman/consola) y quita duplicados.
export function sanearModulos(lista) {
  if (!Array.isArray(lista)) return []
  return [...new Set(lista.filter((id) => typeof id === 'string' && MODULO_IDS.includes(id)))]
}

// Módulos efectivos de un usuario: si tiene allowedModules guardado (no
// vacío) se respeta tal cual; si no, se usa el default de su rol. Nunca
// sobrescribe permisos personalizados ya existentes — esto es solo para
// decidir qué mostrar/permitir cuando el campo todavía no existe.
export function modulosEfectivos(usuario) {
  if (Array.isArray(usuario?.allowedModules) && usuario.allowedModules.length > 0) {
    return sanearModulos(usuario.allowedModules)
  }
  return DEFAULT_MODULOS_POR_ROL[usuario?.rol] || []
}

// Primer módulo permitido, en el orden canónico del menú — a dónde
// redirigir tras login o cuando se bloquea un acceso no permitido.
export function primerModuloPermitido(allowedModules) {
  const modulo = MODULOS.find((m) => allowedModules?.includes(m.id))
  return modulo?.href || null
}

// Dado un pathname de página, ¿a qué módulo pertenece? null = no gateado
// por módulo (rutas públicas, imprimir, login, etc. — esas ya las filtra
// el middleware con sus propias reglas antes de llegar aquí).
export function moduloDePagina(pathname) {
  // La vista de impresión es universal para cualquier rol logueado (no
  // pertenece a un módulo) — igual que ya la trata middleware.js aparte.
  if (/^\/pedidos\/[^/]+\/imprimir$/.test(pathname)) return null
  if (pathname === '/') return 'new-order'
  if (pathname === '/pedidos' || pathname.startsWith('/pedidos/')) return 'orders'
  if (pathname === '/pedidos-live' || pathname.startsWith('/pedidos-live/')) return 'live-orders'
  if (pathname === '/historial' || pathname.startsWith('/historial/')) return 'history'
  if (pathname === '/surtir' || pathname.startsWith('/surtir/')) return 'picking'
  if (pathname === '/admin/catalogo-onn') return 'onn-catalog'
  if (pathname === '/admin/usuarios') return 'users'
  if (pathname === '/manual' || pathname.startsWith('/manual/')) return 'manual'
  if (pathname === '/admin/manual') return 'manual-editor'
  if (pathname === '/changelog' || pathname === '/admin/changelog') return 'changelog'
  return null
}
