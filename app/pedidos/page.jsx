import Link from 'next/link'
import { getDb } from '@/lib/mongodb'
import { getRol } from '@/lib/auth'
import { calcularTotales, normalizeOrderStatus } from '@/lib/estado-pedido'
import { getServerT } from '@/lib/i18n-server'
import ListaCliente from './lista-cliente'
import { IconDocument, IconPlus } from '../components/icons'

export const dynamic = 'force-dynamic'

async function obtenerUsuariosAsignables(t) {
  const db = await getDb()
  const usuarios = await db.collection('usuarios')
    .find({ rol: { $in: ['admin', 'capturista'] } })
    .sort({ nombre: 1 })
    .toArray()
  return usuarios.map((u) => ({
    id: u._id.toString(),
    nombre: u.nombre || u.email || t('usuarios.sinNombre'),
    rol: u.rol,
  }))
}

async function obtenerPedidos() {
  const db = await getDb()
  const pedidos = await db.collection('pedidos')
    .find({})
    .sort({ fecha: -1 })
    .limit(100)
    .toArray()

  const fmt = new Intl.DateTimeFormat('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Mexico_City',
  })

  return pedidos.map((p) => {
    const tvs = p.televisiones || []
    const { totalRequerido, totalSurtido, progresoPct, pendiente } = calcularTotales(p)
    const tienePallets = tvs.some((tv) => tv.unidad === 'pallet')
    const estadoOperativo = p.estadoOperativo || null
    const estado = normalizeOrderStatus({ progresoPct, estadoOperativo })
    return {
      id: p._id.toString(),
      numeroPedido: p.numeroPedido || '',
      pedidoNombre: p.pedidoNombre,
      condiciones: p.condiciones || [],
      fecha: p.fecha ? p.fecha.toISOString() : null,
      fechaFmt: p.fecha ? fmt.format(p.fecha) : '',
      fechaLimite: p.fechaLimite || '',
      cantidadTotal:
        typeof p.cantidadTotal === 'number' && p.cantidadTotal > 0 ? p.cantidadTotal : null,
      metasGrupo: p.metasGrupo || {},
      totalTvs: totalRequerido,
      pendiente,
      cantidadModelos: tvs.length,
      totalSurtido,
      progresoPct,
      estadoOperativo,
      estado,
      historialEstados: p.historialEstados || [],
      tienePallets,
      creadoPor: p.creadoPor || '',
      creadoPorNombre: p.creadoPorNombre || '',
      televisiones: tvs.map((tv) => ({
        marca: tv.marca || '',
        pulgadas: tv.pulgadas || 0,
        condiciones: Array.isArray(tv.condiciones) ? tv.condiciones : (tv.condicion ? [tv.condicion] : []),
        modelo: tv.modelo || '',
        modelosAlternativos: Array.isArray(tv.modelosAlternativos) ? tv.modelosAlternativos : [],
        unidad: tv.unidad || 'pieza',
        cantidad: tv.cantidad || 0,
        sinLimite: !!tv.sinLimite,
        cantidadSurtida: tv.cantidadSurtida || 0,
      })),
    }
  })
}

export default async function ListaPage() {
  const t = await getServerT()
  const [pedidos, rol, usuarios] = await Promise.all([
    obtenerPedidos(),
    getRol(),
    obtenerUsuariosAsignables(t),
  ])

  return (
    <main className="page-wide">
      <div className="page-header">
        <h1>{t('pedidos.titulo')}</h1>
        <p className="subtitle">
          {pedidos.length === 0
            ? t('pedidos.sinPedidosGuardados')
            : t('pedidos.totalConteo', { count: pedidos.length })}
        </p>
      </div>

      {pedidos.length === 0 ? (
        <div className="card">
          <div className="empty">
            <IconDocument />
            <h3>{t('pedidos.emptyTitulo')}</h3>
            <p>{t('pedidos.emptyTexto')}</p>
            <Link href="/" className="btn btn-primary">
              <IconPlus />
              {t('nav.nuevoPedido')}
            </Link>
          </div>
        </div>
      ) : (
        <ListaCliente pedidos={pedidos} rol={rol} usuarios={usuarios} />
      )}
    </main>
  )
}
