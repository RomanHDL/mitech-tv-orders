'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import {
  IconBox,
  IconCheck,
  IconChevronDown,
  IconPrinter,
  IconSearch,
} from '../components/icons'
import { ESTADO_LABEL } from '@/lib/catalogos'
import { cumplimientoTexto } from '@/lib/estado-pedido'

function formatearFechaLimite(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const fecha = new Date(y, m - 1, d)
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(fecha)
}

function badgeProgreso(pct) {
  if (pct >= 100) return { label: 'Completado', clase: 'completo' }
  if (pct > 0) return { label: `${pct}%`, clase: 'parcial' }
  return { label: 'Pendiente', clase: 'pendiente' }
}

export default function HistorialCliente({ grupos }) {
  const { t } = useTranslation()
  const [busqueda, setBusqueda] = useState('')
  const [expandido, setExpandido] = useState(() => new Set())

  const gruposFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return grupos
    return grupos.filter((g) => {
      if (g.nombre.toLowerCase().includes(q)) return true
      return g.pedidos.some(
        (p) =>
          (p.numeroPedido || '').toLowerCase().includes(q) ||
          p.condiciones.some((c) => c.toLowerCase().includes(q))
      )
    })
  }, [grupos, busqueda])

  const toggle = (nombre) => {
    setExpandido((prev) => {
      const next = new Set(prev)
      if (next.has(nombre)) next.delete(nombre)
      else next.add(nombre)
      return next
    })
  }

  const todoAbierto = expandido.size === gruposFiltrados.length && gruposFiltrados.length > 0

  const toggleTodos = () => {
    if (todoAbierto) {
      setExpandido(new Set())
    } else {
      setExpandido(new Set(gruposFiltrados.map((g) => g.nombre)))
    }
  }

  if (grupos.length === 0) {
    return (
      <div className="card">
        <div className="empty">
          <p>{t('historial.sinPedidos')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="lista-toolbar">
        <div className="search-box">
          <IconSearch className="icon-search" />
          <input
            type="text"
            placeholder={t('historial.buscarPlaceholder')}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <div className="lista-toolbar-acciones">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={toggleTodos}
            disabled={gruposFiltrados.length === 0}
          >
            {todoAbierto ? t('historial.colapsarTodo') : t('historial.expandirTodo')}
          </button>
        </div>
      </div>

      {gruposFiltrados.length === 0 ? (
        <div className="empty">
          <p>No se encontró nada con "{busqueda}".</p>
        </div>
      ) : (
        <div className="historial-grupos">
          {gruposFiltrados.map((g) => {
            const abierto = expandido.has(g.nombre)
            const badge = badgeProgreso(g.progresoPct)
            return (
              <div key={g.nombre} className={`historial-grupo ${abierto ? 'abierto' : ''}`}>
                <button
                  type="button"
                  className="historial-grupo-header"
                  onClick={() => toggle(g.nombre)}
                  aria-expanded={abierto}
                >
                  <span className={`historial-chevron ${abierto ? 'abierto' : ''}`}>
                    <IconChevronDown />
                  </span>
                  <div className="historial-grupo-titulo">
                    <h3>{g.nombre}</h3>
                    <span className="historial-grupo-meta">
                      {g.cantidad} {g.cantidad === 1 ? 'pedido' : 'pedidos'}
                      {g.completados > 0 && ` · ${g.completados} completado${g.completados === 1 ? '' : 's'}`}
                      {g.ultimaFechaFmt && ` · último ${g.ultimaFechaFmt}`}
                    </span>
                  </div>
                  <div className="historial-grupo-stats">
                    <span className="numero-grande">
                      {g.totalSurtido}/{g.totalRequerido}
                    </span>
                    <span className={`badge-progreso ${badge.clase}`}>{badge.label}</span>
                  </div>
                </button>

                {abierto && (
                  <div className="historial-grupo-detalle">
                    <div className="tabla-wrap">
                    <table className="tabla-pedidos tabla-historial">
                      <thead>
                        <tr>
                          <th>N° Pedido</th>
                          <th>Fecha creación</th>
                          <th>Fecha límite</th>
                          <th>Tiempo restante</th>
                          <th>Dueño</th>
                          <th>Condiciones</th>
                          <th>Modelos</th>
                          <th>Total</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.pedidos.map((p) => {
                          const estado = p.estado || 'PENDIENTE'
                          const tiempo = cumplimientoTexto(p)
                          return (
                            <tr key={p.id}>
                              <td data-label="N° Pedido">
                                <span className="numero-pedido">{p.numeroPedido || '—'}</span>
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
                              <td data-label="Dueño">
                                <div className="pedido-fecha">{p.creadoPorNombre || '—'}</div>
                              </td>
                              <td data-label="Condiciones">
                                <div className="tags-celda">
                                  {p.condiciones.length > 0
                                    ? p.condiciones.map((c) => (
                                        <span key={c} className={`tag tag-${c.toLowerCase()}`}>
                                          {c}
                                        </span>
                                      ))
                                    : <span className="tag-empty">—</span>}
                                </div>
                              </td>
                              <td data-label="Modelos">
                                {p.cantidadModelos}
                                {p.totalPallets > 0 && (
                                  <span className="badge-pallet" style={{ marginLeft: '0.4rem' }}>
                                    <IconBox /> {p.totalPallets}
                                  </span>
                                )}
                              </td>
                              <td data-label="Total">
                                <span className="numero-grande">
                                  {p.totalSurtido}/{p.totalRequerido}
                                </span>
                                <span
                                  className={`badge-estado-op estado-${estado.toLowerCase().replace('_', '-')}`}
                                  style={{ marginLeft: '0.4rem' }}
                                >
                                  {p.completado ? <IconCheck width={10} height={10} /> : null}
                                  {ESTADO_LABEL[estado]}
                                </span>
                              </td>
                              <td>
                                <div className="acciones">
                                  <Link href={`/pedidos/${p.id}/imprimir`} className="btn btn-primary btn-sm">
                                    <IconPrinter />
                                    {t('common.imprimir')}
                                  </Link>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
