'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import * as XLSX from 'xlsx'
import {
  IconActivity,
  IconAlert,
  IconBan,
  IconBox,
  IconCheckCircle,
  IconClipboardList,
  IconClock,
  IconExcel,
  IconForklift,
  IconPlus,
  IconPrinter,
  IconSearch,
  IconTrash,
  IconTruck,
  IconTruckCheck,
} from '../components/icons'
import { ESTADO_LABEL } from '@/lib/catalogos'
import { cumplimientoTexto, estaVencido } from '@/lib/estado-pedido'
import PedidoDetalleModal from './pedido-detalle-modal'

const ESTADO_ICONO = {
  PENDIENTE: IconClock,
  EN_PROCESO: IconActivity,
  TERMINADO: IconCheckCircle,
  CARGANDO: IconForklift,
  LISTO_SALIDA: IconTruckCheck,
  DESPACHADO: IconTruck,
  CANCELADO: IconBan,
}

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

function formatearFechaLimite(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const fecha = new Date(y, m - 1, d)
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(fecha)
}

// Fecha de despacho, si el historial de estados registra esa transición
// (nunca se inventa: si no hay entrada DESPACHADO, se deja vacío).
function fechaDespacho(p) {
  const historial = p.historialEstados || []
  const entrada = [...historial].reverse().find((h) => h.estadoNuevo === 'DESPACHADO')
  if (!entrada?.fecha) return ''
  try {
    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
      timeZone: 'America/Mexico_City',
    }).format(new Date(entrada.fecha))
  } catch {
    return ''
  }
}

function descargarPedidosXLSX(pedidos) {
  const wb = XLSX.utils.book_new()

  // --- Tab "Historial": resumen ordenado por fecha (más recientes primero) ---
  const historialEncabezados = [
    'Número de pedido',
    'Pedido',
    'Fecha creación',
    'Fecha límite',
    'Cumplimiento',
    'Dueño',
    'Condiciones',
    'Modelos',
    'Solicitado',
    'Surtido',
    'Pendiente',
    '% Surtido',
    'Estado operativo',
    'Vencido',
    'Fecha despacho',
  ]
  const historialFilas = pedidos.map((p) => {
    const tvs = p.televisiones || []
    // Nunca exportamos "Vencido" para un pedido ya terminado/cargando/listo/
    // despachado — cumplimientoTexto ya aplica esa prioridad.
    const cumplimiento = cumplimientoTexto(p).texto
    return [
      p.numeroPedido || '',
      p.pedidoNombre,
      p.fechaFmt,
      p.fechaLimite,
      cumplimiento,
      p.creadoPorNombre,
      (p.condiciones || []).join(' / '),
      tvs.length,
      p.totalTvs,
      p.totalSurtido,
      p.pendiente,
      `${p.progresoPct}%`,
      ESTADO_LABEL[p.estado] || p.estado,
      estaVencido(p) ? 'Sí' : 'No',
      fechaDespacho(p),
    ]
  })
  const wsHistorial = XLSX.utils.aoa_to_sheet([historialEncabezados, ...historialFilas])
  wsHistorial['!cols'] = [
    { wch: 14 }, { wch: 24 }, { wch: 18 }, { wch: 14 }, { wch: 18 },
    { wch: 18 }, { wch: 22 }, { wch: 8 }, { wch: 12 }, { wch: 10 },
    { wch: 10 }, { wch: 10 }, { wch: 18 }, { wch: 9 }, { wch: 18 },
  ]
  XLSX.utils.book_append_sheet(wb, wsHistorial, 'Historial')

  // --- Una pestaña por pedido ---
  const nombresUsados = new Set(['historial'])
  for (const p of pedidos) {
    const tvs = p.televisiones || []
    const encabezadoInfo = [
      ['Número de pedido', p.numeroPedido || ''],
      ['Pedido', p.pedidoNombre],
      ['Fecha creación', p.fechaFmt],
      ['Fecha límite', p.fechaLimite || ''],
      ['Cumplimiento', cumplimientoTexto(p).texto],
      ['Estado operativo', ESTADO_LABEL[p.estado] || p.estado],
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

// Clasificación de progreso puramente numérica (0/parcial/100%) — se usa
// SOLO para las 4 tarjetas de resumen, que deben seguir mostrando las
// mismas cifras de siempre sin verse afectadas por el estado operativo.
function progresoClase(pct) {
  if (pct >= 100) return 'completo'
  if (pct > 0) return 'parcial'
  return 'pendiente'
}

// Barra compacta de % surtido: verde a 100%, azul si avanza, gris en 0%.
function BarraProgreso({ pct }) {
  const clase = pct >= 100 ? 'completa' : pct > 0 ? 'avanzando' : 'vacia'
  return (
    <div className="barra-progreso-celda">
      <div className="barra-progreso-track">
        <div className={`barra-progreso-fill ${clase}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="barra-progreso-texto">{pct}%</span>
    </div>
  )
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
  const [detalleIndex, setDetalleIndex] = useState(null)
  const [, startTransition] = useTransition()

  const esAdmin = rol === 'admin'

  // Stats sobre el TOTAL de pedidos, no sobre los filtrados — igual que en
  // el MI Stack: el dashboard siempre resume "todo", los filtros son solo
  // para la tabla de abajo. Cifras sin cambios: siguen siendo puramente de
  // progreso de surtido (0/parcial/100%), no del estado operativo nuevo.
  const stats = useMemo(() => {
    let pendientes = 0, enProceso = 0, completados = 0
    for (const p of pedidos) {
      const clase = progresoClase(p.progresoPct)
      if (clase === 'completo') completados++
      else if (clase === 'parcial') enProceso++
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
      if (estadoFiltro === 'VENCIDOS') {
        if (!estaVencido(p)) return false
      } else if (estadoFiltro !== 'todos' && p.estado !== estadoFiltro) {
        return false
      }
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

  // Contador real de filtros activos (no cuenta el orden, que no filtra nada).
  const appliedFiltersCount =
    (busqueda.trim() ? 1 : 0) +
    (estadoFiltro !== 'todos' ? 1 : 0) +
    (fechaDesde ? 1 : 0) +
    (fechaHasta ? 1 : 0)

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
          <IconClipboardList className="stat-icono" />
          <div className="stat-numero">{stats.total}</div>
          <div className="stat-label">{t('pedidos.total')}</div>
        </div>
        <div className="stat-card stat-pendiente">
          <IconClock className="stat-icono" />
          <div className="stat-numero">{stats.pendientes}</div>
          <div className="stat-label">{t('pedidos.pendientes')}</div>
        </div>
        <div className="stat-card stat-parcial">
          <IconActivity className="stat-icono" />
          <div className="stat-numero">{stats.enProceso}</div>
          <div className="stat-label">{t('pedidos.enProceso')}</div>
        </div>
        <div className="stat-card stat-completo">
          <IconCheckCircle className="stat-icono" />
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
            <option value="PENDIENTE">Pendiente</option>
            <option value="EN_PROCESO">En proceso</option>
            <option value="TERMINADO">Surtido terminado</option>
            <option value="CARGANDO">Cargando</option>
            <option value="LISTO_SALIDA">Listo para salida</option>
            <option value="DESPACHADO">Despachado</option>
            <option value="CANCELADO">Cancelado</option>
            <option value="VENCIDOS">Vencidos</option>
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

      <div className="lista-resumen-filtros">
        <span className={`filtros-aplicados ${appliedFiltersCount > 0 ? 'activo' : ''}`}>
          Filtros aplicados ({appliedFiltersCount})
        </span>
        <span className="registros-info">
          {pedidosFiltrados.length} {pedidosFiltrados.length === 1 ? 'registro' : 'registros'}
        </span>
      </div>

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
        <table className="tabla-pedidos tabla-pedidos-densa">
          <thead>
            <tr>
              <th className="th-icono"></th>
              <th>N° Pedido</th>
              <th>Pedido</th>
              <th>Fecha creación</th>
              <th>Fecha límite</th>
              <th>Cumplimiento</th>
              {esAdmin && <th>Dueño</th>}
              <th>Condiciones</th>
              <th>Estado</th>
              <th>Solicitado</th>
              <th>Surtido</th>
              <th>Pendiente</th>
              <th>% Surtido</th>
              <th>Etapa logística</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {pedidosPagina.map((p) => {
              const cumplimiento = cumplimientoTexto(p)
              const indiceGlobal = pedidosFiltrados.indexOf(p)
              const IconoEtapa = ESTADO_ICONO[p.estado] || IconClock
              const completo = p.estado === 'DESPACHADO' || (p.estado === 'TERMINADO' && p.progresoPct >= 100)
              return (
                <tr key={p.id} className={completo ? 'fila-completa' : p.estado === 'CANCELADO' ? 'fila-cancelada' : ''}>
                  <td className="td-icono">
                    <Link
                      href={`/pedidos/${p.id}/imprimir`}
                      className="btn-icono"
                      title="Imprimir"
                      aria-label="Imprimir"
                    >
                      <IconPrinter />
                    </Link>
                  </td>
                  <td data-label="N° Pedido">
                    <button
                      type="button"
                      className="numero-pedido numero-pedido-link"
                      onClick={() => setDetalleIndex(indiceGlobal)}
                    >
                      {p.numeroPedido || '—'}
                    </button>
                  </td>
                  <td data-label="Pedido">
                    <div className="pedido-nombre">
                      {p.pedidoNombre}
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
                  <td data-label="Cumplimiento">
                    <span className={`tiempo-restante tr-${cumplimiento.clase}`}>
                      {cumplimiento.texto}
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
                  <td data-label="Estado">
                    <span className={`badge-estado-op estado-${p.estado.toLowerCase().replace('_', '-')}`}>
                      {ESTADO_LABEL[p.estado]}
                    </span>
                  </td>
                  <td data-label="Solicitado">
                    <span className="numero-grande">{p.totalTvs}</span>
                  </td>
                  <td data-label="Surtido">
                    <span className="numero-grande">{p.totalSurtido}</span>
                  </td>
                  <td data-label="Pendiente">
                    {p.pendiente > 0
                      ? <span className="pill pill-pendiente">{p.pendiente}</span>
                      : <span className="pill pill-completo">Completo</span>}
                  </td>
                  <td data-label="% Surtido">
                    <BarraProgreso pct={p.progresoPct} />
                  </td>
                  <td data-label="Etapa logística">
                    <span className={`etapa-chip estado-${p.estado.toLowerCase().replace('_', '-')}`}>
                      <IconoEtapa />
                      {ESTADO_LABEL[p.estado]}
                    </span>
                  </td>
                  <td data-label="Acciones">
                    <div className="acciones">
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

    {detalleIndex !== null && pedidosFiltrados[detalleIndex] && (
      <PedidoDetalleModal
        resumen={pedidosFiltrados[detalleIndex]}
        posicion={detalleIndex + 1}
        total={pedidosFiltrados.length}
        rol={rol}
        onClose={() => setDetalleIndex(null)}
        onAnterior={() => setDetalleIndex((i) => Math.max(0, i - 1))}
        onSiguiente={() => setDetalleIndex((i) => Math.min(pedidosFiltrados.length - 1, i + 1))}
        onCambiado={() => startTransition(() => router.refresh())}
      />
    )}
    </>
  )
}
