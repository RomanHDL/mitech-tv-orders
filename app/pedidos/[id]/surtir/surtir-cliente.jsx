'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { unidadLabel } from '@/lib/catalogos'
import {
  IconAlert,
  IconArrowLeft,
  IconBox,
  IconCheck,
  IconPlus,
  IconPrinter,
  IconRefresh,
} from '../../../components/icons'

function agruparPorMarca(televisiones) {
  const grupos = {}
  televisiones.forEach((tv, _idx) => {
    if (!grupos[tv.marca]) grupos[tv.marca] = []
    grupos[tv.marca].push({ ...tv, _idx })
  })
  return Object.keys(grupos).sort().map((marca) => ({
    marca,
    items: grupos[marca].sort((a, b) => a.pulgadas - b.pulgadas),
  }))
}

export default function SurtirCliente({ pedido }) {
  const [tvs, setTvs] = useState(pedido.televisiones)
  const [error, setError] = useState('')

  const grupos = useMemo(() => agruparPorMarca(tvs), [tvs])

  const totalRequerido = tvs.reduce((s, tv) => s + tv.cantidad, 0)
  const totalSurtido = tvs.reduce(
    (s, tv) => s + Math.min(tv.cantidad, tv.cantidadSurtida || 0),
    0
  )
  const progreso = totalRequerido > 0 ? Math.round((totalSurtido / totalRequerido) * 100) : 0
  const completado = totalRequerido > 0 && totalSurtido >= totalRequerido

  const actualizar = async (idx, valorBruto) => {
    const tv = tvs[idx]
    const valor = Math.max(0, Math.min(tv.cantidad, Number(valorBruto) || 0))

    setTvs((prev) => prev.map((t, i) => (i === idx ? { ...t, cantidadSurtida: valor } : t)))

    try {
      const res = await fetch(`/api/pedidos/${pedido.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tvIndex: idx, cantidadSurtida: valor }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'No se pudo guardar')
      }
      setError('')
    } catch (err) {
      // Rollback al valor original guardado en el servidor
      setTvs((prev) =>
        prev.map((t, i) =>
          i === idx
            ? { ...t, cantidadSurtida: pedido.televisiones[idx].cantidadSurtida }
            : t
        )
      )
      setError(err.message)
    }
  }

  return (
    <main className="surtir">
      <header className="surtir-header">
        <div className="surtir-nav">
          <Link href="/pedidos" className="btn btn-secondary btn-sm">
            <IconArrowLeft />
            Volver
          </Link>
          <Link href={`/pedidos/${pedido.id}/imprimir`} className="btn btn-secondary btn-sm">
            <IconPrinter />
            Imprimir
          </Link>
        </div>

        <h1 className="surtir-titulo">{pedido.pedidoNombre}</h1>

        {pedido.condiciones.length > 0 && (
          <div className="tags-celda surtir-tags">
            {pedido.condiciones.map((c) => (
              <span key={c} className={`tag tag-${c.toLowerCase()}`}>{c}</span>
            ))}
          </div>
        )}

        <div className={`progreso-resumen ${completado ? 'completado' : ''}`}>
          <div className="progreso-info">
            <span className="progreso-numero">
              {totalSurtido} <span className="progreso-de">de</span> {totalRequerido} surtidas
            </span>
            <span className="progreso-pct">{progreso}%</span>
          </div>
          <div className="progreso-track">
            <div className="progreso-fill" style={{ width: `${progreso}%` }} />
          </div>
          {completado && (
            <div className="progreso-completado">
              <IconCheck /> Pedido completo
            </div>
          )}
        </div>
      </header>

      {error && (
        <div className="alerta alerta-error">
          <IconAlert />
          <span>{error}</span>
        </div>
      )}

      <div className="surtir-lista">
        {grupos.map(({ marca, items }) => (
          <section key={marca} className="surtir-marca">
            <h2 className="surtir-marca-titulo">{marca.toUpperCase()}</h2>

            {items.map((tv) => {
              const idx = tv._idx
              const surtida = Math.min(tv.cantidad, tv.cantidadSurtida || 0)
              const completo = surtida >= tv.cantidad
              const enProgreso = surtida > 0 && !completo
              const estado = completo ? 'completo' : enProgreso ? 'parcial' : 'pendiente'
              const esPallet = tv.unidad === 'pallet'

              return (
                <div key={idx} className={`surtir-item estado-${estado}`}>
                  <div className="surtir-item-info">
                    <div className="surtir-item-titulo">
                      <span className="surtir-pulgadas">{tv.pulgadas}"</span>
                      {esPallet && (
                        <span className="surtir-pallet-tag">
                          <IconBox /> Pallet
                        </span>
                      )}
                      {tv.modelo && <span className="surtir-modelo">{tv.modelo}</span>}
                    </div>
                    <div className="surtir-item-cantidad">
                      <strong>{tv.cantidad}</strong> {unidadLabel(tv.cantidad, tv.unidad)}
                    </div>
                  </div>

                  <div className="surtir-item-controles">
                    <div className="surtir-counter">
                      <input
                        type="number"
                        min="0"
                        max={tv.cantidad}
                        value={surtida}
                        onChange={(e) => actualizar(idx, e.target.value)}
                        aria-label="Cantidad surtida"
                      />
                      <span className="surtir-counter-total">/ {tv.cantidad}</span>
                    </div>

                    <div className="surtir-acciones">
                      <button
                        type="button"
                        onClick={() => actualizar(idx, surtida + 1)}
                        disabled={completo}
                        className="btn-mini-action"
                        aria-label="Sumar uno"
                        title="Sumar uno"
                      >
                        <IconPlus />
                      </button>
                      <button
                        type="button"
                        onClick={() => actualizar(idx, tv.cantidad)}
                        disabled={completo}
                        className="btn-mini-action btn-listo"
                        aria-label="Marcar todas"
                        title="Marcar todas"
                      >
                        <IconCheck />
                      </button>
                      <button
                        type="button"
                        onClick={() => actualizar(idx, 0)}
                        disabled={surtida === 0}
                        className="btn-mini-action btn-reset"
                        aria-label="Reiniciar"
                        title="Reiniciar a 0"
                      >
                        <IconRefresh />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </section>
        ))}
      </div>
    </main>
  )
}
