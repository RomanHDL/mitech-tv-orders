'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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

function descargarPedidosXLSX(pedidos) {
  const wb = XLSX.utils.book_new()

  // --- Tab "Historial": resumen ordenado por fecha (más recientes primero) ---
  const historialEncabezados = [
    'Pedido',
    'Fecha creación',
    'Fecha límite',
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
    const requerido = tvs.reduce((s, tv) => s + (tv.cantidad || 0), 0)
    const surtido = tvs.reduce(
      (s, tv) => s + Math.min(tv.cantidad || 0, tv.cantidadSurtida || 0),
      0
    )
    const pct = requerido > 0 ? Math.round((surtido / requerido) * 100) : 0
    const estado = pct >= 100 ? 'Completado' : pct > 0 ? 'Parcial' : 'Pendiente'
    return [
      p.pedidoNombre,
      p.fechaFmt,
      p.fechaLimite,
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
    { wch: 24 }, { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 22 },
    { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
  ]
  XLSX.utils.book_append_sheet(wb, wsHistorial, 'Historial')

  // --- Una pestaña por pedido ---
  const nombresUsados = new Set(['historial'])
  for (const p of pedidos) {
    const tvs = p.televisiones || []
    const encabezadoInfo = [
      ['Pedido', p.pedidoNombre],
      ['Fecha creación', p.fechaFmt],
      ['Fecha límite', p.fechaLimite || ''],
      ['Dueño', p.creadoPorNombre || ''],
      ['Condiciones', (p.condiciones || []).join(' / ')],
      [],
    ]
    const detalleEncabezados = [
      'Marca', 'Pulgadas', 'Modelo', 'Unidad',
      'Cantidad requerida', 'Cantidad surtida', 'Estado',
    ]
    const detalleFilas = tvs.map((tv) => {
      const surt = Math.min(tv.cantidad, tv.cantidadSurtida || 0)
      const estado = surt >= tv.cantidad
        ? 'Completo'
        : surt > 0 ? 'Parcial' : 'Pendiente'
      return [tv.marca, tv.pulgadas, tv.modelo, tv.unidad, tv.cantidad, surt, estado]
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
    const nombrePestana = sanitizarNombrePestana(p.pedidoNombre, nombresUsados)
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

export default function ListaCliente({ pedidos, rol, usuarios = [] }) {
  const router = useRouter()
  const [eliminandoId, setEliminandoId] = useState(null)
  const [asignandoId, setAsignandoId] = useState(null)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [, startTransition] = useTransition()

  const esAdmin = rol === 'admin'

  const pedidosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return pedidos
    return pedidos.filter((p) =>
      p.pedidoNombre.toLowerCase().includes(q) ||
      p.condiciones.some((c) => c.toLowerCase().includes(q))
    )
  }, [pedidos, busqueda])

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
    <div className="card">
      <div className="lista-toolbar">
        <div className="search-box">
          <IconSearch className="icon-search" />
          <input
            type="text"
            placeholder="Buscar por nombre o condición…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <div className="lista-toolbar-acciones">
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
            Nuevo pedido
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
          <p>No se encontraron pedidos con "{busqueda}".</p>
        </div>
      ) : (
        <table className="tabla-pedidos">
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Fecha</th>
              {esAdmin && <th>Dueño</th>}
              <th>Condiciones</th>
              <th>Modelos</th>
              <th>Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pedidosFiltrados.map((p) => {
              const badge = badgeProgreso(p.progresoPct)
              return (
                <tr key={p.id}>
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
                  <td data-label="Fecha">
                    <div className="pedido-fecha">{p.fechaFmt}</div>
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
                  <td data-label="Modelos">{p.cantidadModelos}</td>
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
      )}
    </div>
  )
}
