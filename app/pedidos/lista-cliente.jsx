'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { colorDeCondicion } from '@/lib/catalogos'
import { IconAlert, IconPlus, IconPrinter, IconSearch, IconTrash } from '../components/icons'

function formatoFecha(iso) {
  const d = new Date(iso)
  return d.toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function tagClass(c) {
  return `tag tag-${colorDeCondicion(c)}`
}

export default function ListaCliente({ pedidos }) {
  const router = useRouter()
  const [eliminandoId, setEliminandoId] = useState(null)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [, startTransition] = useTransition()

  const pedidosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return pedidos
    return pedidos.filter((p) =>
      p.pedidoNombre.toLowerCase().includes(q) ||
      p.condiciones.some((c) => c.toLowerCase().includes(q))
    )
  }, [pedidos, busqueda])

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
        <Link href="/" className="btn btn-primary">
          <IconPlus />
          Nuevo pedido
        </Link>
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
              <th>Condiciones</th>
              <th>Modelos</th>
              <th>Total TVs</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pedidosFiltrados.map((p) => (
              <tr key={p.id}>
                <td data-label="Pedido">
                  <div className="pedido-nombre">{p.pedidoNombre}</div>
                </td>
                <td data-label="Fecha">
                  <div className="pedido-fecha">{formatoFecha(p.fecha)}</div>
                </td>
                <td data-label="Condiciones">
                  <div className="tags-celda">
                    {p.condiciones.length > 0
                      ? p.condiciones.map((c) => <span key={c} className={tagClass(c)}>{c}</span>)
                      : <span className="tag-empty">—</span>}
                  </div>
                </td>
                <td data-label="Modelos">{p.cantidadModelos}</td>
                <td data-label="Total TVs"><span className="numero-grande">{p.totalTvs}</span></td>
                <td>
                  <div className="acciones">
                    <Link href={`/pedidos/${p.id}/imprimir`} className="btn btn-primary btn-sm">
                      <IconPrinter />
                      Imprimir
                    </Link>
                    <button
                      onClick={() => eliminar(p.id, p.pedidoNombre)}
                      disabled={eliminandoId === p.id}
                      className="btn btn-danger btn-sm"
                    >
                      <IconTrash />
                      {eliminandoId === p.id ? 'Eliminando…' : 'Eliminar'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
