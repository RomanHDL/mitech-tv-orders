'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import * as XLSX from 'xlsx'
import {
  IconAlert,
  IconBox,
  IconExcel,
  IconPlus,
  IconPrinter,
  IconSearch,
  IconTrash,
} from '../components/icons'

// Excel limita los nombres de pestaña a 31 caracteres y no permite \ / ? * [ ]
function sanitizarNombrePestana(nombre, usados) {
  let base = String(nombre || 'Pedido').replace(/[\\/?*[\]:]/g, '-').trim()
  if (!base) base = 'Pedido'
  if (base.length > 31) base = base.slice(0, 31)
  let final = base
  let i = 2
  while (usados.has(final.toLowerCase())) {
    const sufijo = ` (${i})`
    final = base.slice(0, 31 - sufijo.length) + sufijo
    i++
  }
  usados.add(final.toLowerCase())
  return final
}

// fechaLimite viene como 'YYYY-MM-DD'. Calcula días hasta hoy (0 = hoy, negativo = vencido).
function diasHastaLimite(fechaLimite) {
  if (!fechaLimite) return null
  const [y, m, d] = fechaLimite.split('-').map(Number)
  if (!y || !m || !d) return null
  const limite = new Date(y, m - 1, d)
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const diff = limite.getTime() - hoy.getTime()
  return Math.round(diff / (1000 * 60 * 60 * 24))
}

function tiempoRestanteTexto(dias) {
  if (dias === null) return { texto: '—', clase: 'sin-fecha' }
  if (dias < 0) {
    const abs = Math.abs(dias)
    return { texto: `Vencido (${abs} ${abs === 1 ? 'día' : 'días'})`, clase: 'vencido' }
  }
  if (dias === 0) return { texto: 'Hoy', clase: 'urgente' }
  if (dias === 1) return { texto: 'Mañana', clase: 'urgente' }
  if (dias <= 3) return { texto: `${dias} días`, clase: 'urgente' }
  if (dias <= 7) return { texto: `${dias} días`, clase: 'cercano' }
  return { texto: `${dias} días`, clase: 'normal' }
}

function formatearFechaLimite(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const fecha = new Date(y, m - 1, d)
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(fecha)
}

function descargarPedidosXLSX(pedidos) {
  const wb = XLSX.utils.book_new()

  // --- Tab "Historial": resumen ordenado por fecha (más recientes primero) ---
  const historialEncabezados = [
    'Número de pedido',
    'Pedido',
    'Fecha creación',
    'Fecha límite',
    'Tiempo restante',
    'Dueño',
    'Condiciones',
    'Modelos',
    'Cantidad requerida',
    'Cantidad surtida',
    'Progreso',
    'Estado',
  ]
  const historialFilas = pedidos.map((p) => {
    const tvs = p.televisiones || []
    const sumaCantidades = tvs.reduce((s, tv) => s + (tv.cantidad || 0), 0)
    const requerido =
      typeof p.cantidadTotal === 'number' && p.cantidadTotal > 0
        ? p.cantidadTotal
        : sumaCantidades
    const surtido = tvs.reduce((s, tv) => {
      const sur = tv.cantidadSurtida || 0
      if (tv.sinLimite || (tv.cantidad || 0) === 0) return s + sur
      return s + Math.min(tv.cantidad || 0, sur)
    }, 0)
    const pct = requerido > 0 ? Math.round((surtido / requerido) * 100) : 0
    const estado = pct >= 100 ? 'Completado' : pct > 0 ? 'Parcial' : 'Pendiente'
    const dias = diasHastaLimite(p.fechaLimite)
    const tiempo = tiempoRestanteTexto(dias).texto
    return [
      p.numeroPedido || '',
      p.pedidoNombre,
      p.fechaFmt,
      p.fechaLimite,
      tiempo,
      p.creadoPorNombre,
      (p.condiciones || []).join(' / '),
      tvs.length,
      requerido,
      surtido,
      `${pct}%`,
      estado,
    ]
  })
  const wsHistorial = XLSX.utils.aoa_to_sheet([historialEncabezados, ...historialFilas])
  wsHistorial['!cols'] = [
    { wch: 14 }, { wch: 24 }, { wch: 18 }, { wch: 14 }, { wch: 16 },
    { wch: 18 }, { wch: 22 }, { wch: 8 }, { wch: 12 }, { wch: 12 },
    { wch: 10 }, { wch: 12 },
  ]
  XLSX.utils.book_append_sheet(wb, wsHistorial, 'Historial')

  // --- Una pestaña por pedido ---
  const nombresUsados = new Set(['historial'])
  for (const p of pedidos) {
    const tvs = p.televisiones || []
    const dias = diasHastaLimite(p.fechaLimite)
    const encabezadoInfo = [
      ['Número de pedido', p.numeroPedido || ''],
      ['Pedido', p.pedidoNombre],
      ['Fecha creación', p.fechaFmt],
      ['Fecha límite', p.fechaLimite || ''],
      ['Tiempo restante', tiempoRestanteTexto(dias).texto],
      ['Dueño', p.creadoPorNombre || ''],
      ['Condiciones', (p.condiciones || []).join(' / ')],
      [],
    ]
    const detalleEncabezados = [
      'Marca', 'Pulgadas', 'Modelo', 'Unidad',
      'Cantidad requerida', 'Cantidad surtida', 'Estado',
    ]
    const detalleFilas = tvs.map((tv) => {
      const surt = tv.sinLimite
        ? (tv.cantidadSurtida || 0)
        : Math.min(tv.cantidad || 0, tv.cantidadSurtida || 0)
      const cantidadLabel = tv.sinLimite ? 'Sin límite' : tv.cantidad
      const estado = tv.sinLimite
        ? (surt > 0 ? 'Parcial' : 'Pendiente')
        : (surt >= tv.cantidad
            ? 'Completo'
            : surt > 0 ? 'Parcial' : 'Pendiente')
      return [tv.marca, tv.pulgadas, tv.modelo, tv.unidad, cantidadLabel, surt, estado]
    })

    const ws = XLSX.utils.aoa_to_sheet([
      ...encabezadoInfo,
      detalleEncabezados,
      ...detalleFilas,
    ])
    ws['!cols'] = [
      { wch: 16 }, { wch: 10 }, { wch: 22 }, { wch: 10 },
      { wch: 18 }, { wch: 18 }, { wch: 12 },
    ]
    // Preferimos el número de pedido en la pestaña si existe, si no el nombre.
    const baseNombre = p.numeroPedido
      ? `${p.numeroPedido} - ${p.pedidoNombre}`
      : p.pedidoNombre
    const nombrePestana = sanitizarNombrePestana(baseNombre, nombresUsados)
    XLSX.utils.book_append_sheet(wb, ws, nombrePestana)
  }

  const hoy = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `pedidos-${hoy}.xlsx`)
}

function tagClass(c) {
  return `tag tag-${c.toLowerCase()}`
}

function badgeProgreso(pct) {
  if (pct >= 100) return { label: 'Completado', clase: 'completo' }
  if (pct > 0) return { label: `${pct}%`, clase: 'parcial' }
  return { label: 'Pendiente', clase: 'pendiente' }
}

const POR_PAGINA = 10

export default function ListaCliente({ pedidos, rol, usuarios = [] }) {
  const router = useRouter()
  const { t } = useTranslation()
  const [eliminandoId, setEliminandoId] = useState(null)
  const [asignandoId, setAsignandoId] = useState(null)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('todos')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [ordenarPor, setOrdenarPor] = useState('recientes')
  const [pagina, setPagina] = useState(1)
  const [, startTransition] = useTransition()

  const esAdmin = rol === 'admin'

  // Stats sobre el TOTAL de pedidos, no sobre los filtrados — igual que en
  // el MI Stack: el dashboard siempre resume "todo", los filtros son solo
  // para la tabla de abajo.
  const stats = useMemo(() => {
    let pendientes = 0, enProceso = 0, completados = 0
    for (const p of pedidos) {
      const badge = badgeProgreso(p.progresoPct)
      if (badge.clase === 'completo') completados++
      else if (badge.clase === 'parcial') enProceso++
      else pendientes++
    }
    return { total: pedidos.length, pendientes, enProceso, completados }
  }, [pedidos])

  const pedidosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()

    const filtrados = pedidos.filter((p) => {
      if (q) {
        const coincide =
          p.pedidoNombre.toLowerCase().includes(q) ||
          (p.numeroPedido || '').toLowerCase().includes(q) ||
          p.condiciones.some((c) => c.toLowerCase().includes(q)) ||
          (p.televisiones || []).some((tv) => (tv.modelo || '').toLowerCase().includes(q))
        if (!coincide) return false
      }
      if (estadoFiltro !== 'todos' && badgeProgreso(p.progresoPct).clase !== estadoFiltro) return false
      if (fechaDesde && p.fecha && new Date(p.fecha) < new Date(fechaDesde)) return false
      if (fechaHasta && p.fecha) {
        const hasta = new Date(fechaHasta)
        hasta.setHours(23, 59, 59, 999)
        if (new Date(p.fecha) > hasta) return false
      }
      return true
    })

    return [...filtrados].sort((a, b) => {
      switch (ordenarPor) {
        case 'antiguos':
          return new Date(a.fecha || 0).getTime() - new Date(b.fecha || 0).getTime()
        case 'fechaLimite':
          return (a.fechaLimite || '').localeCompare(b.fechaLimite || '')
        case 'nombre':
          return a.pedidoNombre.localeCompare(b.pedidoNombre)
        case 'cantidad':
          return b.totalTvs - a.totalTvs
        case 'recientes':
        default:
          return new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime()
      }
    })
  }, [pedidos, busqueda, estadoFiltro, fechaDesde, fechaHasta, ordenarPor])

  const totalPaginas = Math.max(1, Math.ceil(pedidosFiltrados.length / POR_PAGINA))
  const paginaSegura = Math.min(pagina, totalPaginas)
  const pedidosPagina = pedidosFiltrados.slice((paginaSegura - 1) * POR_PAGINA, paginaSegura * POR_PAGINA)

  function limpiarFiltros() {
    setBusqueda('')
    setEstadoFiltro('todos')
    setFechaDesde('')
    setFechaHasta('')
    setOrdenarPor('recientes')
    setPagina(1)
  }

  const cambiarDueno = async (pedidoId, userId) => {
    setError('')
    setAsignandoId(pedidoId)
    try {
      const res = await fetch(`/api/admin/pedidos/${pedidoId}/dueno`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId || null }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'No se pudo asignar dueño')
      }
      startTransition(() => router.refresh())
    } catch (err) {
      setError(err.message)
    } finally {
      setAsignandoId(null)
    }
  }

  const eliminar = async (id, nombre) => {
    if (!confirm(`¿Eliminar el pedido "${nombre}"? Esta acción no se puede deshacer.`)) return

    setError('')
    setEliminandoId(id)
    try {
      const res = await fetch(`/api/pedidos/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'No se pudo eliminar')
      }
      startTransition(() => router.refresh())
    } catch (err) {
      setError(err.message)
    } finally {
      setEliminandoId(null)
    }
  }

  return (
    <>
      <div className="pedidos-stats">
        <div className="stat-card">
          <div className="stat-numero">{stats.total}</div>
          <div className="stat-label">{t('pedidos.total')}</div>
        </div>
        <div className="stat-card stat-pendiente">
          <div className="stat-numero">{stats.pendientes}</div>
          <div className="stat-label">{t('pedidos.pendientes')}</div>
        </div>
        <div className="stat-card stat-parcial">
          <div className="stat-numero">{stats.enProceso}</div>
          <div className="stat-label">{t('pedidos.enProceso')}</div>
        </div>
        <div className="stat-card stat-completo">
          <div className="stat-numero">{stats.completados}</div>
          <div className="stat-label">{t('pedidos.completados')}</div>
        </div>
      </div>

      <div className="card">
      <div className="lista-toolbar lista-toolbar-filtros">
        <div className="search-box">
          <IconSearch className="icon-search" />
          <input
            type="text"
            placeholder={t('pedidos.buscarPlaceholder')}
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setPagina(1) }}
          />
        </div>

        <div className="filtro-campo">
          <label>{t('pedidos.estado')}</label>
          <select
            value={estadoFiltro}
            onChange={(e) => { setEstadoFiltro(e.target.value); setPagina(1) }}
          >
            <option value="todos">{t('pedidos.todos')}</option>
            <option value="pendiente">{t('pedidos.pendientes')}</option>
            <option value="parcial">{t('pedidos.enProceso')}</option>
            <option value="completo">{t('pedidos.completados')}</option>
          </select>
        </div>

        <div className="filtro-campo">
          <label>{t('pedidos.desde')}</label>
          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => { setFechaDesde(e.target.value); setPagina(1) }}
          />
        </div>

        <div className="filtro-campo">
          <label>{t('pedidos.hasta')}</label>
          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => { setFechaHasta(e.target.value); setPagina(1) }}
          />
        </div>

        <div className="filtro-campo">
          <label>{t('pedidos.ordenar')}</label>
          <select
            value={ordenarPor}
            onChange={(e) => { setOrdenarPor(e.target.value); setPagina(1) }}
          >
            <option value="recientes">{t('pedidos.masRecientes')}</option>
            <option value="antiguos">{t('pedidos.masAntiguos')}</option>
            <option value="fechaLimite">{t('pedidos.porFechaLimite')}</option>
            <option value="nombre">{t('pedidos.porNombre')}</option>
            <option value="cantidad">{t('pedidos.porCantidad')}</option>
          </select>
        </div>

        <div className="lista-toolbar-acciones">
          <button
            type="button"
            onClick={limpiarFiltros}
            className="btn btn-secondary"
            title={t('pedidos.limpiar')}
          >
            {t('pedidos.limpiar')}
          </button>
          <button
            type="button"
            onClick={() => descargarPedidosXLSX(pedidosFiltrados)}
            disabled={pedidosFiltrados.length === 0}
            className="btn btn-excel"
            title="Descargar pedidos en Excel"
          >
            <IconExcel />
            Excel
          </button>
          <Link href="/" className="btn btn-primary">
            <IconPlus />
            {t('nav.nuevoPedido')}
          </Link>
        </div>
      </div>

      {error && (
        <div className="alerta alerta-error">
          <IconAlert />
          <span>{error}</span>
        </div>
      )}

      {pedidosFiltrados.length === 0 ? (
        <div className="empty">
          <p>No se encontraron pedidos con los filtros actuales.</p>
          <button type="button" onClick={limpiarFiltros} className="btn btn-secondary btn-sm">
            Limpiar filtros
          </button>
        </div>
      ) : (
        <>
        <div className="tabla-wrap">
        <table className="tabla-pedidos">
          <thead>
            <tr>
              <th>N° Pedido</th>
              <th>Pedido</th>
              <th>Fecha creación</th>
              <th>Fecha límite</th>
              <th>Tiempo restante</th>
              {esAdmin && <th>Dueño</th>}
              <th>Condiciones</th>
              <th>Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pedidosPagina.map((p) => {
              const badge = badgeProgreso(p.progresoPct)
              const dias = diasHastaLimite(p.fechaLimite)
              const tiempo = tiempoRestanteTexto(dias)
              return (
                <tr key={p.id}>
                  <td data-label="N° Pedido">
                    <span className="numero-pedido">{p.numeroPedido || '—'}</span>
                  </td>
                  <td data-label="Pedido">
                    <div className="pedido-nombre">
                      {p.pedidoNombre}
                      <span className={`badge-progreso ${badge.clase}`}>{badge.label}</span>
                      {p.tienePallets && (
                        <span className="badge-pallet" title="Incluye pallets">
                          <IconBox /> Pallets
                        </span>
                      )}
                    </div>
                  </td>
                  <td data-label="Fecha creación">
                    <div className="pedido-fecha">{p.fechaFmt}</div>
                  </td>
                  <td data-label="Fecha límite">
                    <div className="pedido-fecha">{formatearFechaLimite(p.fechaLimite)}</div>
                  </td>
                  <td data-label="Tiempo restante">
                    <span className={`tiempo-restante tr-${tiempo.clase}`}>
                      {tiempo.texto}
                    </span>
                  </td>
                  {esAdmin && (
                    <td data-label="Dueño">
                      <select
                        className="select-dueno"
                        value={p.creadoPor || ''}
                        disabled={asignandoId === p.id}
                        onChange={(e) => cambiarDueno(p.id, e.target.value)}
                      >
                        <option value="">— sin dueño —</option>
                        {usuarios.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.nombre} ({u.rol})
                          </option>
                        ))}
                      </select>
                    </td>
                  )}
                  <td data-label="Condiciones">
                    <div className="tags-celda">
                      {p.condiciones.length > 0
                        ? p.condiciones.map((c) => <span key={c} className={tagClass(c)}>{c}</span>)
                        : <span className="tag-empty">—</span>}
                    </div>
                  </td>
                  <td data-label="Total">
                    <span className="numero-grande">
                      {p.totalSurtido}/{p.totalTvs}
                    </span>
                  </td>
                  <td>
                    <div className="acciones">
                      <Link href={`/pedidos/${p.id}/imprimir`} className="btn btn-primary btn-sm">
                        <IconPrinter />
                        Imprimir
                      </Link>
                      {esAdmin && (
                        <>
                          <Link href={`/pedidos/${p.id}/editar`} className="btn btn-secondary btn-sm">
                            Editar
                          </Link>
                          <button
                            onClick={() => eliminar(p.id, p.pedidoNombre)}
                            disabled={eliminandoId === p.id}
                            className="btn btn-danger btn-sm"
                          >
                            <IconTrash />
                            {eliminandoId === p.id ? '…' : 'Eliminar'}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>

        <div className="paginacion">
          <span className="paginacion-info">
            {(paginaSegura - 1) * POR_PAGINA + 1}–{Math.min(paginaSegura * POR_PAGINA, pedidosFiltrados.length)} de {pedidosFiltrados.length}
          </span>
          <div className="paginacion-botones">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              disabled={paginaSegura <= 1}
            >
              {t('pedidos.anterior')}
            </button>
            <span className="paginacion-actual">{t('pedidos.pagina', { actual: paginaSegura, total: totalPaginas })}</span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
              disabled={paginaSegura >= totalPaginas}
            >
              {t('pedidos.siguiente')}
            </button>
          </div>
        </div>
        </>
      )}
    </div>
    </>
  )
}
