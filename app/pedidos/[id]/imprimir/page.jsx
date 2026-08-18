import { notFound } from 'next/navigation'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { getUsuario, ROL_LABEL } from '@/lib/auth'
import { calcularTotales, diasHastaLimite, normalizeOrderStatus } from '@/lib/estado-pedido'
import { estadoLabel } from '@/lib/catalogos'
import { getServerT, getServerLang } from '@/lib/i18n-server'
import { localeDe } from '@/lib/intl-format'
import { groupProductsByBrandAndSize } from '@/lib/surtido-grupos'
import PrintViewSwitcher from './print-view-switcher'

async function obtenerPedido(id) {
  if (!ObjectId.isValid(id)) return null
  const db = await getDb()
  return db.collection('pedidos').findOne({ _id: new ObjectId(id) })
}

function formatearFechaLimite(iso, lang) {
  if (!iso) return null
  const [y, m, d] = String(iso).split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString(localeDe(lang), {
    day: '2-digit', month: 'long', year: 'numeric',
  })
}

// Igual que en la lista/historial: los estados finales (Cargando, Listo para
// salida, Despachado, Cancelado, Surtido terminado) nunca deben mostrar
// "Vencido" — el pedido ya avanzó, la fecha límite dejó de importar.
function tiempoRestante(t, estado, dias, pendiente) {
  if (estado === 'DESPACHADO') return { texto: estadoLabel(t, 'DESPACHADO').toUpperCase(), tono: 'verde' }
  if (estado === 'LISTO_SALIDA') return { texto: estadoLabel(t, 'LISTO_SALIDA').toUpperCase(), tono: 'verde' }
  if (estado === 'CARGANDO') return { texto: estadoLabel(t, 'CARGANDO').toUpperCase(), tono: 'amarillo' }
  if (estado === 'TERMINADO') return { texto: estadoLabel(t, 'TERMINADO').toUpperCase(), tono: 'verde' }
  if (estado === 'CANCELADO') return { texto: estadoLabel(t, 'CANCELADO').toUpperCase(), tono: 'rojo' }

  if (dias === null) return null
  if (dias < 0 && pendiente > 0) return { texto: t('imprimir.vencidoHace', { count: Math.abs(dias) }), tono: 'rojo' }
  if (dias < 0) return null
  if (dias === 0) return { texto: t('imprimir.entregaHoy'), tono: 'rojo' }
  if (dias === 1) return { texto: t('imprimir.entregaManana'), tono: 'amarillo' }
  if (dias <= 3) return { texto: t('imprimir.diasFaltantes', { count: dias }), tono: 'amarillo' }
  return { texto: t('imprimir.diasFaltantes', { count: dias }), tono: 'verde' }
}

export default async function ImprimirPage({ params }) {
  const { id } = await params
  const pedido = await obtenerPedido(id)
  if (!pedido) notFound()
  const t = await getServerT()
  const lang = await getServerLang()
  const usuario = await getUsuario()

  const televisiones = (pedido.televisiones || []).map((tvRaw) => ({
    ...tvRaw,
    condiciones: Array.isArray(tvRaw.condiciones) ? tvRaw.condiciones : (tvRaw.condicion ? [tvRaw.condicion] : []),
  }))

  // Mismo agrupamiento/orden "canónico" que ya usan Surtir/Nuevo/Editar
  // (marca por primera aparición, pulgadas ascendente, SKUs en su orden
  // original dentro del grupo) — ver lib/surtido-grupos.js. Reemplaza el
  // viejo ordenarPorMarcaYPulgadas + cálculo por SKU aislado: ahora la meta
  // de cada renglón se resuelve vía el grupo (marca+pulgadas), igual que en
  // el resto de la app.
  const brandSections = groupProductsByBrandAndSize(televisiones, pedido.metasGrupo)

  const { totalRequerido, totalSurtido, progresoPct, pendiente } = calcularTotales(pedido)

  const fechaFmt = new Date(pedido.fecha).toLocaleDateString(localeDe(lang), {
    day: '2-digit', month: 'long', year: 'numeric',
  })
  const fechaLimiteFmt = formatearFechaLimite(pedido.fechaLimite, lang)
  const estado = normalizeOrderStatus({ progresoPct, estadoOperativo: pedido.estadoOperativo || null })
  const dias = diasHastaLimite(pedido.fechaLimite)
  const tiempo = tiempoRestante(t, estado, dias, pendiente)
  const generadoFmt = new Date().toLocaleString(localeDe(lang), {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
  const generadoPorNombre = usuario?.nombre
    ? `${usuario.nombre}${usuario.rol ? ` (${ROL_LABEL[usuario.rol] || usuario.rol})` : ''}`
    : (pedido.creadoPorNombre || '—')
  const pedidoRef = String(pedido._id).slice(-6).toUpperCase()

  return (
    <PrintViewSwitcher
      pedido={pedido}
      brandSections={brandSections}
      televisiones={televisiones}
      pedidoRef={pedidoRef}
      fechaFmt={fechaFmt}
      fechaLimiteFmt={fechaLimiteFmt}
      tiempo={tiempo}
      generadoFmt={generadoFmt}
      generadoPorNombre={generadoPorNombre}
      totalRequerido={totalRequerido}
      totalSurtido={totalSurtido}
      progresoPct={progresoPct}
      pendiente={pendiente}
    />
  )
}

