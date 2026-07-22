'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  IconActivity,
  IconAlert,
  IconBan,
  IconBox,
  IconCalendar,
  IconCheckCircle,
  IconClipboardList,
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
import { estadoLabel, tipoEventoLabel, ESTADOS_OPERATIVOS, TIPOS_EVENTO } from '@/lib/catalogos'
import { formatearNumero } from '@/lib/intl-format'

function getEstadosFiltro(t) {
  return [
    { valor: 'todos', label: t('historial.todos') },
    ...ESTADOS_OPERATIVOS.map((v) => ({ valor: v, label: estadoLabel(t, v) })),
  ]
}

function getTiposFiltro(t) {
  return [
    { valor: 'todos', label: t('historial.todos') },
    ...TIPOS_EVENTO.map((v) => ({ valor: v, label: tipoEventoLabel(t, v) })),
  ]
}

function getCategorias(t) {
  return [
    { valor: 'todos', label: t('historial.categoriaTodos'), Icono: IconClipboardList },
    { valor: 'cambios_estado', label: t('historial.categoriaCambiosEstado'), Icono: IconActivity },
    { valor: 'ediciones', label: t('historial.categoriaEdiciones'), Icono: IconPencil },
    { valor: 'despachos', label: t('historial.categoriaDespachos'), Icono: IconTruck },
    { valor: 'cancelaciones', label: t('historial.categoriaCancelaciones'), Icono: IconBan },
    { valor: 'creaciones', label: t('historial.categoriaCreaciones'), Icono: IconPlus },
    { valor: 'otros', label: t('historial.categoriaOtros'), Icono: IconMoreHorizontal },
  ]
}

function getRangosRapidos(t) {
  return [
    { valor: 'hoy', label: t('historial.rangoHoy') },
    { valor: '7d', label: t('historial.rango7d') },
    { valor: '30d', label: t('historial.rango30d') },
    { valor: 'mes', label: t('historial.rangoEsteMes') },
    { valor: 'mesAnterior', label: t('historial.rangoMesAnterior') },
    { valor: 'personalizado', label: t('historial.rangoPersonalizado') },
  ]
}

const POR_PAGINA_OPCIONES = [8, 15, 25, 50, 100]

const ICONO_METRICA = {
  total: IconClipboardList,
  despachados: IconCheckCircle,
  terminados: IconActivity,
  cancelados: IconBan,
  enSurtido: IconBox,
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
  const { t, i18n } = useTranslation()
  const ESTADOS_FILTRO = getEstadosFiltro(t)
  const TIPOS_FILTRO = getTiposFiltro(t)
  const CATEGORIAS = getCategorias(t)
  const RANGOS_RAPIDOS = getRangosRapidos(t)
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
        if (!r.ok) throw new Error(t('historial.errorCarga'))
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
      await exportarEventosExcel({ busqueda, desde, hasta, estadoFiltro, tipoFiltro, usuarioFiltro, condicionFiltro, categoria }, t, i18n.language)
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
          <h1>{t('historial.titulo')}</h1>
          <p className="subtitle">{t('historial.subtitulo')}</p>
        </div>
        <div className="historial-encabezado-acciones">
          <button type="button" className="btn btn-secondary" onClick={manejarExcel} disabled={exportando}>
            <IconExcel className="icono-verde" /> {exportando ? t('historial.exportando') : t('historial.exportarExcel')}
          </button>
          <button type="button" className="btn btn-secondary" onClick={manejarPdf}>
            <IconPdf className="icono-rojo" /> {t('historial.descargarPdf')}
          </button>
          <button type="button" className="btn btn-secondary btn-icono-solo" title={t('historial.masOpciones')} aria-label={t('historial.masOpciones')}>
            <IconMoreHorizontal />
          </button>
        </div>
      </div>

      <div className="metricas-grid">
        <TarjetaMetrica tipo="total" valor={metricas ? metricas.movimientosTotales : '—'} titulo={t('historial.statMovimientosTitulo')} desc={t('historial.statMovimientosDesc')} />
        <TarjetaMetrica tipo="despachados" valor={metricas ? metricas.pedidosDespachados : '—'} titulo={t('historial.statDespachadosTitulo')} desc={t('historial.statDespachadosDesc')} />
        <TarjetaMetrica tipo="terminados" valor={metricas ? metricas.pedidosTerminados : '—'} titulo={t('historial.statTerminadosTitulo')} desc={t('historial.statTerminadosDesc')} />
        <TarjetaMetrica tipo="cancelados" valor={metricas ? metricas.pedidosCancelados : '—'} titulo={t('historial.statCanceladosTitulo')} desc={t('historial.statCanceladosDesc')} />
        <TarjetaMetrica
          tipo="enSurtido"
          valor={metricas ? metricas.pedidosEnSurtido : '—'}
          titulo={t('historial.statEnSurtidoTitulo')}
          desc={t('historial.statEnSurtidoDesc')}
        />
      </div>

      <div className="card historial-panel-filtros">
        <div className="historial-filtros-fila">
          <div className="search-box historial-buscador">
            <IconSearch className="icon-search" />
            <input
              type="text"
              placeholder={t('historial.buscarPlaceholder')}
              value={busqueda}
              onChange={(e) => { setBusqueda(e.target.value); setPagina(1) }}
            />
          </div>

          <div className="filtro-campo">
            <label>{t('historial.desde')}</label>
            <input type="date" value={desde} onChange={(e) => { setDesde(e.target.value); setRangoActivo(null); setPagina(1) }} />
          </div>
          <div className="filtro-campo">
            <label>{t('historial.hasta')}</label>
            <input type="date" value={hasta} onChange={(e) => { setHasta(e.target.value); setRangoActivo(null); setPagina(1) }} />
          </div>

          <div className="filtro-campo">
            <label>{t('historial.estado')}</label>
            <select value={estadoFiltro} onChange={(e) => { setEstadoFiltro(e.target.value); setPagina(1) }}>
              {ESTADOS_FILTRO.map((o) => <option key={o.valor} value={o.valor}>{o.label}</option>)}
            </select>
          </div>

          <div className="filtro-campo">
            <label>{t('historial.tipoEvento')}</label>
            <select value={tipoFiltro} onChange={(e) => { setTipoFiltro(e.target.value); setPagina(1) }}>
              {TIPOS_FILTRO.map((o) => <option key={o.valor} value={o.valor}>{o.label}</option>)}
            </select>
          </div>

          <div className="lista-toolbar-acciones">
            <button type="button" onClick={limpiarFiltros} className="btn btn-secondary">{t('historial.limpiar')}</button>
            <button type="button" onClick={manejarExcel} disabled={exportando} className="btn btn-excel">
              <IconExcel /> {t('historial.excel')}
            </button>
            <button
              type="button"
              className={`btn btn-secondary ${masFiltrosAbierto ? 'activo' : ''}`}
              onClick={() => setMasFiltrosAbierto((v) => !v)}
            >
              <IconFilter /> {t('historial.masFiltros')}
            </button>
          </div>
        </div>

        {masFiltrosAbierto && (
          <div className="historial-filtros-fila historial-filtros-extra">
            <div className="filtro-campo">
              <label>{t('historial.usuario')}</label>
              <select value={usuarioFiltro} onChange={(e) => { setUsuarioFiltro(e.target.value); setPagina(1) }}>
                <option value="todos">{t('historial.todos')}</option>
                {opciones.usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
              </select>
            </div>
            <div className="filtro-campo">
              <label>{t('historial.condicion')}</label>
              <select value={condicionFiltro} onChange={(e) => { setCondicionFiltro(e.target.value); setPagina(1) }}>
                <option value="todos">{t('historial.todos')}</option>
                {opciones.condiciones.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        )}

        <div className="historial-rangos-rapidos">
          <span className="historial-rangos-titulo"><IconCalendar /> {t('historial.rangosRapidos').toUpperCase()}</span>
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
                {t('historial.mostrandoRegistros', {
                  desde: total === 0 ? 0 : (pagina - 1) * porPagina + 1,
                  hasta: Math.min(pagina * porPagina, total),
                  total: formatearNumero(total, i18n.language),
                })}
              </span>
              <div className="paginacion-botones">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPagina(1)} disabled={pagina <= 1}>«</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={pagina <= 1}>{t('pedidos.anterior')}</button>
                <span className="paginacion-actual">{t('pedidos.pagina', { actual: pagina, total: totalPaginas })}</span>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} disabled={pagina >= totalPaginas}>{t('pedidos.siguiente')}</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPagina(totalPaginas)} disabled={pagina >= totalPaginas}>»</button>
              </div>
              <select
                className="select-por-pagina"
                value={porPagina}
                onChange={(e) => { setPorPagina(Number(e.target.value)); setPagina(1) }}
              >
                {POR_PAGINA_OPCIONES.map((n) => <option key={n} value={n}>{t('historial.porPagina', { n })}</option>)}
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
