'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  IconActivity,
  IconAlert,
  IconBan,
  IconCalendar,
  IconCheckCircle,
  IconClipboardList,
  IconClock,
  IconExcel,
  IconFilter,
  IconMoreHorizontal,
  IconPdf,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTruck,
} from '../components/icons'
import TablaEventos from './tabla-eventos'
import PanelDetalle from './panel-detalle'
import { calcularRango } from './eventos-helpers'
import { exportarEventosExcel } from './exportar-historial'

const ESTADOS_FILTRO = [
  { valor: 'todos', label: 'Todos' },
  { valor: 'PENDIENTE', label: 'Pendiente' },
  { valor: 'EN_PROCESO', label: 'En proceso' },
  { valor: 'TERMINADO', label: 'Surtido terminado' },
  { valor: 'CARGANDO', label: 'Cargando' },
  { valor: 'LISTO_SALIDA', label: 'Listo para salida' },
  { valor: 'DESPACHADO', label: 'Despachado' },
  { valor: 'CANCELADO', label: 'Cancelado' },
]

const TIPOS_FILTRO = [
  { valor: 'todos', label: 'Todos' },
  { valor: 'CREACION', label: 'Creación' },
  { valor: 'CAMBIO_ESTADO', label: 'Cambio de estado' },
  { valor: 'EDICION', label: 'Edición' },
  { valor: 'SURTIDO', label: 'Surtido' },
  { valor: 'CARGA', label: 'Carga' },
  { valor: 'DESPACHO', label: 'Despacho' },
  { valor: 'CANCELACION', label: 'Cancelación' },
  { valor: 'CAMBIO_DUENO', label: 'Cambio de dueño' },
  { valor: 'CAMBIO_CANTIDADES', label: 'Cambio de cantidades' },
  { valor: 'OTRO', label: 'Otro' },
]

const CATEGORIAS = [
  { valor: 'todos', label: 'Todos', Icono: IconClipboardList },
  { valor: 'cambios_estado', label: 'Cambios de estado', Icono: IconActivity },
  { valor: 'ediciones', label: 'Ediciones', Icono: IconPencil },
  { valor: 'despachos', label: 'Despachos', Icono: IconTruck },
  { valor: 'cancelaciones', label: 'Cancelaciones', Icono: IconBan },
  { valor: 'creaciones', label: 'Creaciones', Icono: IconPlus },
  { valor: 'otros', label: 'Otros', Icono: IconMoreHorizontal },
]

const RANGOS_RAPIDOS = [
  { valor: 'hoy', label: 'Hoy' },
  { valor: '7d', label: 'Últimos 7 días' },
  { valor: '30d', label: 'Últimos 30 días' },
  { valor: 'mes', label: 'Este mes' },
  { valor: 'mesAnterior', label: 'Mes anterior' },
  { valor: 'personalizado', label: 'Personalizado' },
]

const POR_PAGINA_OPCIONES = [8, 15, 25, 50, 100]

const ICONO_METRICA = {
  total: IconClipboardList,
  despachados: IconCheckCircle,
  terminados: IconActivity,
  cancelados: IconBan,
  tiempo: IconClock,
}

function TarjetaMetrica({ tipo, valor, titulo, desc }) {
  const Icono = ICONO_METRICA[tipo]
  return (
    <div className={`metrica-card metrica-${tipo}`}>
      <span className="metrica-icono"><Icono /></span>
      <div>
        <div className="metrica-valor">{valor}</div>
        <div className="metrica-titulo">{titulo}</div>
        <div className="metrica-desc">{desc}</div>
      </div>
    </div>
  )
}

export default function HistorialCliente({ rol }) {
  const [busqueda, setBusqueda] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('todos')
  const [tipoFiltro, setTipoFiltro] = useState('todos')
  const [usuarioFiltro, setUsuarioFiltro] = useState('todos')
  const [condicionFiltro, setCondicionFiltro] = useState('todos')
  const [categoria, setCategoria] = useState('todos')
  const [rangoActivo, setRangoActivo] = useState(null)
  const [masFiltrosAbierto, setMasFiltrosAbierto] = useState(false)
  const [pagina, setPagina] = useState(1)
  const [porPagina, setPorPagina] = useState(15)

  const [eventos, setEventos] = useState([])
  const [total, setTotal] = useState(0)
  const [cargandoEventos, setCargandoEventos] = useState(true)
  const [errorEventos, setErrorEventos] = useState('')

  const [metricas, setMetricas] = useState(null)
  const [opciones, setOpciones] = useState({ usuarios: [], condiciones: [] })

  const [pedidoSeleccionadoId, setPedidoSeleccionadoId] = useState(null)
  const [exportando, setExportando] = useState(false)

  const debounceRef = useRef(null)
  const abortRef = useRef(null)

  useEffect(() => {
    fetch('/api/eventos/metricas').then((r) => r.json()).then(setMetricas).catch(() => {})
    fetch('/api/eventos/opciones').then((r) => r.json()).then(setOpciones).catch(() => {})
  }, [])

  const cargarEventos = useCallback(() => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setCargandoEventos(true)
    setErrorEventos('')

    const params = new URLSearchParams({
      q: busqueda, desde, hasta, estado: estadoFiltro, tipo: tipoFiltro,
      usuario: usuarioFiltro, condicion: condicionFiltro, categoria,
      pagina: String(pagina), porPagina: String(porPagina),
    })

    fetch(`/api/eventos?${params}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error('No se pudo cargar el historial')
        return r.json()
      })
      .then((data) => {
        setEventos(data.eventos)
        setTotal(data.total)
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setErrorEventos(err.message)
      })
      .finally(() => setCargandoEventos(false))
  }, [busqueda, desde, hasta, estadoFiltro, tipoFiltro, usuarioFiltro, condicionFiltro, categoria, pagina, porPagina])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(cargarEventos, 350)
    return () => clearTimeout(debounceRef.current)
  }, [cargarEventos])

  function limpiarFiltros() {
    setBusqueda('')
    setDesde('')
    setHasta('')
    setEstadoFiltro('todos')
    setTipoFiltro('todos')
    setUsuarioFiltro('todos')
    setCondicionFiltro('todos')
    setCategoria('todos')
    setRangoActivo(null)
    setPagina(1)
  }

  function elegirRango(clave) {
    if (clave === 'personalizado') {
      setRangoActivo('personalizado')
      return
    }
    const { desde: d, hasta: h } = calcularRango(clave)
    setDesde(d)
    setHasta(h)
    setRangoActivo(clave)
    setPagina(1)
  }

  async function manejarExcel() {
    setExportando(true)
    try {
      await exportarEventosExcel({ busqueda, desde, hasta, estadoFiltro, tipoFiltro, usuarioFiltro, condicionFiltro, categoria })
    } catch (err) {
      setErrorEventos(err.message)
    } finally {
      setExportando(false)
    }
  }

  function manejarPdf() {
    const params = new URLSearchParams({
      q: busqueda, desde, hasta, estado: estadoFiltro, tipo: tipoFiltro,
      usuario: usuarioFiltro, condicion: condicionFiltro, categoria,
    })
    window.open(`/historial/exportar-pdf?${params}`, '_blank')
  }

  const totalPaginas = Math.max(1, Math.ceil(total / porPagina))

  return (
    <>
      <div className="historial-encabezado">
        <div>
          <h1>Historial de pedidos</h1>
          <p className="subtitle">Consulta movimientos, cambios y eventos de los pedidos</p>
        </div>
        <div className="historial-encabezado-acciones">
          <button type="button" className="btn btn-secondary" onClick={manejarExcel} disabled={exportando}>
            <IconExcel className="icono-verde" /> {exportando ? 'Exportando…' : 'Exportar Excel'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={manejarPdf}>
            <IconPdf className="icono-rojo" /> Descargar PDF
          </button>
          <button type="button" className="btn btn-secondary btn-icono-solo" title="Más opciones" aria-label="Más opciones">
            <IconMoreHorizontal />
          </button>
        </div>
      </div>

      <div className="metricas-grid">
        <TarjetaMetrica tipo="total" valor={metricas ? metricas.movimientosTotales : '—'} titulo="Movimientos totales" desc="Todos los eventos registrados" />
        <TarjetaMetrica tipo="despachados" valor={metricas ? metricas.pedidosDespachados : '—'} titulo="Pedidos despachados" desc="Completados y enviados" />
        <TarjetaMetrica tipo="terminados" valor={metricas ? metricas.pedidosTerminados : '—'} titulo="Pedidos terminados" desc="Surtido finalizado" />
        <TarjetaMetrica tipo="cancelados" valor={metricas ? metricas.pedidosCancelados : '—'} titulo="Pedidos cancelados" desc="Cancelaciones registradas" />
        <TarjetaMetrica
          tipo="tiempo"
          valor={metricas && metricas.tiempoPromedioHoras != null ? `${metricas.tiempoPromedioHoras.toFixed(1)} h` : 'Sin datos'}
          titulo="Tiempo promedio"
          desc="De creación a despacho"
        />
      </div>

      <div className="card historial-panel-filtros">
        <div className="historial-filtros-fila">
          <div className="search-box historial-buscador">
            <IconSearch className="icon-search" />
            <input
              type="text"
              placeholder="Buscar por número, nombre, SKU o usuario…"
              value={busqueda}
              onChange={(e) => { setBusqueda(e.target.value); setPagina(1) }}
            />
          </div>

          <div className="filtro-campo">
            <label>Desde</label>
            <input type="date" value={desde} onChange={(e) => { setDesde(e.target.value); setRangoActivo(null); setPagina(1) }} />
          </div>
          <div className="filtro-campo">
            <label>Hasta</label>
            <input type="date" value={hasta} onChange={(e) => { setHasta(e.target.value); setRangoActivo(null); setPagina(1) }} />
          </div>

          <div className="filtro-campo">
            <label>Estado</label>
            <select value={estadoFiltro} onChange={(e) => { setEstadoFiltro(e.target.value); setPagina(1) }}>
              {ESTADOS_FILTRO.map((o) => <option key={o.valor} value={o.valor}>{o.label}</option>)}
            </select>
          </div>

          <div className="filtro-campo">
            <label>Tipo de evento</label>
            <select value={tipoFiltro} onChange={(e) => { setTipoFiltro(e.target.value); setPagina(1) }}>
              {TIPOS_FILTRO.map((o) => <option key={o.valor} value={o.valor}>{o.label}</option>)}
            </select>
          </div>

          <div className="lista-toolbar-acciones">
            <button type="button" onClick={limpiarFiltros} className="btn btn-secondary">Limpiar</button>
            <button type="button" onClick={manejarExcel} disabled={exportando} className="btn btn-excel">
              <IconExcel /> Excel
            </button>
            <button
              type="button"
              className={`btn btn-secondary ${masFiltrosAbierto ? 'activo' : ''}`}
              onClick={() => setMasFiltrosAbierto((v) => !v)}
            >
              <IconFilter /> Más filtros
            </button>
          </div>
        </div>

        {masFiltrosAbierto && (
          <div className="historial-filtros-fila historial-filtros-extra">
            <div className="filtro-campo">
              <label>Usuario</label>
              <select value={usuarioFiltro} onChange={(e) => { setUsuarioFiltro(e.target.value); setPagina(1) }}>
                <option value="todos">Todos</option>
                {opciones.usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
              </select>
            </div>
            <div className="filtro-campo">
              <label>Condición</label>
              <select value={condicionFiltro} onChange={(e) => { setCondicionFiltro(e.target.value); setPagina(1) }}>
                <option value="todos">Todos</option>
                {opciones.condiciones.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        )}

        <div className="historial-rangos-rapidos">
          <span className="historial-rangos-titulo"><IconCalendar /> RANGOS RÁPIDOS</span>
          <div className="historial-rangos-botones">
            {RANGOS_RAPIDOS.map((r) => (
              <button
                key={r.valor}
                type="button"
                className={`chip-rango ${rangoActivo === r.valor ? 'activo' : ''}`}
                onClick={() => elegirRango(r.valor)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="historial-categorias">
        {CATEGORIAS.map((c) => (
          <button
            key={c.valor}
            type="button"
            className={`historial-categoria-tab ${categoria === c.valor ? 'activa' : ''}`}
            onClick={() => { setCategoria(c.valor); setPagina(1) }}
          >
            <c.Icono /> {c.label}
          </button>
        ))}
      </div>

      <div className="historial-content">
        <div className="historial-panel-tabla card">
          <TablaEventos
            eventos={eventos}
            cargando={cargandoEventos}
            error={errorEventos}
            onReintentar={cargarEventos}
            pedidoSeleccionadoId={pedidoSeleccionadoId}
            onSeleccionar={setPedidoSeleccionadoId}
          />

          {!cargandoEventos && !errorEventos && (
            <div className="paginacion">
              <span className="paginacion-info">
                Mostrando {total === 0 ? 0 : (pagina - 1) * porPagina + 1} a {Math.min(pagina * porPagina, total)} de {total.toLocaleString('es-MX')} registros
              </span>
              <div className="paginacion-botones">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPagina(1)} disabled={pagina <= 1}>«</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={pagina <= 1}>Anterior</button>
                <span className="paginacion-actual">Página {pagina} de {totalPaginas}</span>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} disabled={pagina >= totalPaginas}>Siguiente</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPagina(totalPaginas)} disabled={pagina >= totalPaginas}>»</button>
              </div>
              <select
                className="select-por-pagina"
                value={porPagina}
                onChange={(e) => { setPorPagina(Number(e.target.value)); setPagina(1) }}
              >
                {POR_PAGINA_OPCIONES.map((n) => <option key={n} value={n}>{n} por página</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="historial-panel-lateral card">
          <PanelDetalle pedidoId={pedidoSeleccionadoId} onCerrar={() => setPedidoSeleccionadoId(null)} />
        </div>
      </div>
    </>
  )
}
