'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

function formatoFecha(iso) {
  const d = new Date(iso)
  return d.toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function ListaCliente({ pedidos }) {
  const router = useRouter()
  const [eliminandoId, setEliminandoId] = useState(null)
  const [error, setError] = useState('')
  const [, startTransition] = useTransition()

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
      {error && <p className="error">{error}</p>}
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
          {pedidos.map((p) => (
            <tr key={p.id}>
              <td><strong>{p.pedidoNombre}</strong></td>
              <td>{formatoFecha(p.fecha)}</td>
              <td>{p.condiciones.length > 0 ? p.condiciones.join(' / ') : '—'}</td>
              <td>{p.cantidadModelos}</td>
              <td>{p.totalTvs}</td>
              <td className="acciones">
                <Link href={`/pedidos/${p.id}/imprimir`} className="btn-imprimir-link">
                  Imprimir
                </Link>
                <button
                  onClick={() => eliminar(p.id, p.pedidoNombre)}
                  disabled={eliminandoId === p.id}
                  className="btn-eliminar"
                >
                  {eliminandoId === p.id ? 'Eliminando…' : 'Eliminar'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
