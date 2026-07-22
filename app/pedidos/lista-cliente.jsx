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
import { estadoLabel, ESTADOS_OPERATIVOS } from '@/lib/catalogos'
import { cumplimientoTexto, estaVencido } from '@/lib/estado-pedido'
import { localeDe, formatearNumero } from '@/lib/intl-format'
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

function formatearFechaLimite(iso, lang) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const fecha = new Date(y, m - 1, d)
  return new Intl.DateTimeFormat(localeDe(lang), { day: '2-digit', month: 'short', year: 'numeric' }).format(fecha)
}

// Fecha de despacho, si el historial de estados registra esa transición
// (nunca se inventa: si no hay entrada DESPACHADO, se deja vacío).
function fechaDespacho(p, lang) {
  const historial = p.historialEstados || []
  const entrada = [...historial].reverse().find((h) => h.estadoNuevo === 'DESPACHADO')
  if (!entrada?.fecha) return ''
  try {
    return new Intl.DateTimeFormat(localeDe(lang), {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
      timeZone: 'America/Mexico_City',
    }).format(new Date(entrada.fecha))
  } catch {
    return ''
  }
}

function descargarPedidosXLSX(pedidos, t, lang) {
  const wb = XLSX.utils.book_new()

  // --- Tab "Historial": resumen ordenado por fecha (más recientes primero) ---
  const historialEncabezados = [
    t('pedidos.colNumeroPedido'),
    t('historial.colPedido'),
    t('pedidos.colFechaCreacion'),
    t('pedidoForm.fechaLimite'),
    t('pedidos.colCumplimiento'),
    t('historial.dueno'),
    t('pedidoForm.condiciones'),
    t('pedidoForm.modelos'),
    t('common.solicitado'),
    t('common.surtido'),
    t('common.pendiente'),
    t('pedidos.colPorcentajeSurtido'),
    t('pedidos.colEstadoOperativo'),
    t('pedidos.colVencido'),
    t('pedidos.colFechaDespacho'),
  ]
  const historialFilas = pedidos.map((p) => {
    const tvs = p.televisiones || []
    // Nunca exportamos "Vencido" para un pedido ya terminado/cargando/listo/
    // despachado — cumplimientoTexto ya aplica esa prioridad.
    const cumplimiento = cumplimientoTexto(t, p).texto
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
      estadoLabel(t, p.estado),
      estaVencido(p) ? t('common.si') : t('common.no'),
      fechaDespacho(p, lang),
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
      [t('pedidos.colNumeroPedido'), p.numeroPedido || ''],
      [t('historial.colPedido'), p.pedidoNombre],
      [t('pedidos.colFechaCreacion'), p.fechaFmt],
      [t('pedidoForm.fechaLimite'), p.fechaLimite || ''],
      [t('pedidos.colCumplimiento'), cumplimientoTexto(t, p).texto],
      [t('pedidos.colEstadoOperativo'), estadoLabel(t, p.estado)],
      [t('historial.dueno'), p.creadoPorNombre || ''],
      [t('pedidoForm.condiciones'), (p.condiciones || []).join(' / ')],
      [],
    ]
    const detalleEncabezados = [
      t('common.marca'), t('common.pulgadas'), t('pedidoDetalle.colSku'), t('historial.colUnidad'),
      t('pedidos.colCantidadRequerida'), t('pedidos.colCantidadSurtida'), t('pedidoDetalle.colEstado'),
    ]
    const detalleFilas = tvs.map((tv) => {
      const surt = tv.sinLimite
        ? (tv.cantidadSurtida || 0)
        : Math.min(tv.cantidad || 0, tv.cantidadSurtida || 0)
      const cantidadLabel = tv.sinLimite ? t('pedidoForm.sinLimite') : tv.cantidad
      const estadoCodigo = tv.sinLimite
        ? (surt > 0 ? 'parcial' : 'pendiente')
        : (surt >= tv.cantidad
            ? 'completo'
            : surt > 0 ? 'parcial' : 'pendiente')
      return [tv.marca, tv.pulgadas, tv.modelo, tv.unidad, cantidadLabel, surt, t(`common.${estadoCodigo}`)]
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
  const { t, i18n } = useTranslation()
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
        throw new Error(data.error || t('pedidos.errorAsignarDueno'))
      }
      startTransition(() => router.refresh())
    } catch (err) {
      setError(err.message)
    } finally {
      setAsignandoId(null)
    }
  }

  const eliminar = async (id, nombre) => {
    if (!confirm(t('pedidos.confirmarEliminarPedido', { nombre }))) return

    setError('')
    setEliminandoId(id)
    try {
      const res = await fetch(`/api/pedidos/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || t('pedidos.errorEliminar'))
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
            {ESTADOS_OPERATIVOS.map((v) => <option key={v} value={v}>{estadoLabel(t, v)}</option>)}
            <option value="VENCIDOS">{t('pedidos.vencidos')}</option>
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
            onClick={() => descargarPedidosXLSX(pedidosFiltrados, t, i18n.language)}
            disabled={pedidosFiltrados.length === 0}
            className="btn btn-excel"
            title={t('pedidos.descargarExcelTitle')}
          >
            <IconExcel />
            {t('historial.excel')}
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
          {t('pedidos.filtrosAplicados', { n: appliedFiltersCount })}
        </span>
        <span className="registros-info">
          {t('pedidos.registros', { count: pedidosFiltrados.length })}
        </span>
      </div>

      {pedidosFiltrados.length === 0 ? (
        <div className="empty">
          <p>{t('pedidos.sinPedidosFiltro')}</p>
          <button type="button" onClick={limpiarFiltros} className="btn btn-secondary btn-sm">
            {t('pedidos.limpiarFiltros')}
          </button>
        </div>
      ) : (
        <>
        <div className="tabla-wrap">
        <table className="tabla-pedidos tabla-pedidos-densa">
          <thead>
            <tr>
              <th className="th-icono"></th>
              <th>{t('pedidos.colNumeroPedido')}</th>
              <th>{t('historial.colPedido')}</th>
              <th>{t('pedidos.colFechaCreacion')}</th>
              <th>{t('pedidoForm.fechaLimite')}</th>
              <th>{t('pedidos.colCumplimiento')}</th>
              {esAdmin && <th>{t('historial.dueno')}</th>}
              <th>{t('pedidoForm.condiciones')}</th>
              <th>{t('historial.estado')}</th>
              <th>{t('common.solicitado')}</th>
              <th>{t('common.surtido')}</th>
              <th>{t('common.pendiente')}</th>
              <th>{t('pedidos.colPorcentajeSurtido')}</th>
              <th>{t('pedidos.colEtapaLogistica')}</th>
              <th>{t('historial.colAcciones')}</th>
            </tr>
          </thead>
          <tbody>
            {pedidosPagina.map((p) => {
              const cumplimiento = cumplimientoTexto(t, p)
              const indiceGlobal = pedidosFiltrados.indexOf(p)
              const IconoEtapa = ESTADO_ICONO[p.estado] || IconClock
              const completo = p.estado === 'DESPACHADO' || (p.estado === 'TERMINADO' && p.progresoPct >= 100)
              return (
                <tr key={p.id} className={completo ? 'fila-completa' : p.estado === 'CANCELADO' ? 'fila-cancelada' : ''}>
                  <td className="td-icono">
                    <Link
                      href={`/pedidos/${p.id}/imprimir`}
                      className="btn-icono"
                      title={t('common.imprimir')}
                      aria-label={t('common.imprimir')}
                    >
                      <IconPrinter />
                    </Link>
                  </td>
                  <td data-label={t('pedidos.colNumeroPedido')}>
                    <button
                      type="button"
                      className="numero-pedido numero-pedido-link"
                      onClick={() => setDetalleIndex(indiceGlobal)}
                    >
                      {p.numeroPedido || '—'}
                    </button>
                  </td>
                  <td data-label={t('historial.colPedido')}>
                    <div className="pedido-nombre">
                      {p.pedidoNombre}
                      {p.tienePallets && (
                        <span className="badge-pallet" title={t('pedidos.incluyePallets')}>
                          <IconBox /> {t('pedidoForm.pallets')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td data-label={t('pedidos.colFechaCreacion')}>
                    <div className="pedido-fecha">{p.fechaFmt}</div>
                  </td>
                  <td data-label={t('pedidoForm.fechaLimite')}>
                    <div className="pedido-fecha">{formatearFechaLimite(p.fechaLimite, i18n.language)}</div>
                  </td>
                  <td data-label={t('pedidos.colCumplimiento')}>
                    <span className={`tiempo-restante tr-${cumplimiento.clase}`}>
                      {cumplimiento.texto}
                    </span>
                  </td>
                  {esAdmin && (
                    <td data-label={t('historial.dueno')}>
                      <select
                        className="select-dueno"
                        value={p.creadoPor || ''}
                        disabled={asignandoId === p.id}
                        onChange={(e) => cambiarDueno(p.id, e.target.value)}
                      >
                        <option value="">{t('pedidos.sinDueno')}</option>
                        {usuarios.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.nombre} ({u.rol})
                          </option>
                        ))}
                      </select>
                    </td>
                  )}
                  <td data-label={t('pedidoForm.condiciones')}>
                    <div className="tags-celda">
                      {p.condiciones.length > 0
                        ? p.condiciones.map((c) => <span key={c} className={tagClass(c)}>{c}</span>)
                        : <span className="tag-empty">—</span>}
                    </div>
                  </td>
                  <td data-label={t('historial.estado')}>
                    <span className={`badge-estado-op estado-${p.estado.toLowerCase().replace('_', '-')}`}>
                      {estadoLabel(t, p.estado)}
                    </span>
                  </td>
                  <td data-label={t('common.solicitado')}>
                    <span className="numero-grande">{p.totalTvs}</span>
                  </td>
                  <td data-label={t('common.surtido')}>
                    <span className="numero-grande">{p.totalSurtido}</span>
                  </td>
                  <td data-label={t('common.pendiente')}>
                    {p.pendiente > 0
                      ? <span className="pill pill-pendiente">{p.pendiente}</span>
                      : <span className="pill pill-completo">{t('common.completo')}</span>}
                  </td>
                  <td data-label={t('pedidos.colPorcentajeSurtido')}>
                    <BarraProgreso pct={p.progresoPct} />
                  </td>
                  <td data-label={t('pedidos.colEtapaLogistica')}>
                    <span className={`etapa-chip estado-${p.estado.toLowerCase().replace('_', '-')}`}>
                      <IconoEtapa />
                      {estadoLabel(t, p.estado)}
                    </span>
                  </td>
                  <td data-label={t('historial.colAcciones')}>
                    <div className="acciones">
                      {esAdmin && (
                        <>
                          <Link href={`/pedidos/${p.id}/editar`} className="btn btn-secondary btn-sm">
                            {t('common.editar')}
                          </Link>
                          <button
                            onClick={() => eliminar(p.id, p.pedidoNombre)}
                            disabled={eliminandoId === p.id}
                            className="btn btn-danger btn-sm"
                          >
                            <IconTrash />
                            {eliminandoId === p.id ? '…' : t('common.eliminar')}
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
            {t('pedidos.rangoPaginacion', {
              desde: (paginaSegura - 1) * POR_PAGINA + 1,
              hasta: Math.min(paginaSegura * POR_PAGINA, pedidosFiltrados.length),
              total: pedidosFiltrados.length,
            })}
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
