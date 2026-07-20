'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { IconBox, IconCheck, IconClipboard } from '../components/icons'

function estadoCard(p) {
  if (p.completado) return 'completo'
  if (p.pct > 0) return 'parcial'
  return 'pendiente'
}

function formatearFechaLimite(iso) {
  if (!iso) return ''
  // iso es 'YYYY-MM-DD' — parseamos manual para evitar timezone offsets
  const [y, m, d] = iso.split('-').map(Number)
  const fecha = new Date(y, m - 1, d)
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(fecha)
}

export default function SurtirListaCliente({ pedidos }) {
  const { t } = useTranslation()
  const [verCompletados, setVerCompletados] = useState(false)

  const { pendientes, completados } = useMemo(() => {
    const pend = []
    const comp = []
    for (const p of pedidos) {
      if (p.completado) comp.push(p)
      else pend.push(p)
    }
    return { pendientes: pend, completados: comp }
  }, [pedidos])

  const lista = verCompletados ? [...pendientes, ...completados] : pendientes

  return (
    <main className="surtir-lista-page">
      <div className="page-header">
        <h1>{t('surtir.titulo')}</h1>
        <p className="subtitle">
          {pendientes.length === 0
            ? t('surtir.sinPendientes')
            : `${pendientes.length} ${pendientes.length === 1 ? 'pedido pendiente' : 'pedidos pendientes'}`}
        </p>
      </div>

      {completados.length > 0 && (
        <div className="surtir-lista-toolbar">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setVerCompletados((v) => !v)}
          >
            {verCompletados
              ? t('surtir.ocultarCompletados', { n: completados.length })
              : t('surtir.mostrarCompletados', { n: completados.length })}
          </button>
        </div>
      )}

      {lista.length === 0 ? (
        <div className="card">
          <div className="empty">
            <IconClipboard width={48} height={48} />
            <h3>No hay pedidos pendientes</h3>
            <p>Todos los pedidos ya fueron surtidos.</p>
          </div>
        </div>
      ) : (
        <div className="surtir-cards">
          {lista.map((p) => (
            <Link
              key={p.id}
              href={`/surtir/${p.id}`}
              className={`surtir-card estado-${estadoCard(p)}`}
            >
              <div className="surtir-card-header">
                <h2>
                  {p.numeroPedido && <span className="surtir-card-numero-pedido">#{p.numeroPedido}</span>}
                  {p.pedidoNombre}
                </h2>
                <div className="surtir-card-tags">
                  {p.condiciones.map((c) => (
                    <span key={c} className={`tag tag-${c.toLowerCase()}`}>{c}</span>
                  ))}
                </div>
              </div>

              <div className="surtir-card-progreso">
                <div className="progreso-track">
                  <div className="progreso-fill" style={{ width: `${p.pct}%` }} />
                </div>
                <div className="surtir-card-numero">
                  <span>
                    <strong>{p.totalSurtido}</strong> de <strong>{p.totalRequerido}</strong> surtidas
                  </span>
                  {p.completado ? (
                    <span className="check"><IconCheck /> {t('surtir.listo')}</span>
                  ) : (
                    <span className="pct">{p.pct}%</span>
                  )}
                </div>
              </div>

              <div className="surtir-card-meta">
                <span>{p.cantidadMarcas} {p.cantidadMarcas === 1 ? 'marca' : 'marcas'}</span>
                {p.totalPallets > 0 && (
                  <span className="surtir-card-pallet">
                    <IconBox /> {p.totalPallets} {p.totalPallets === 1 ? 'pallet' : 'pallets'}
                  </span>
                )}
                {p.totalPiezas > 0 && (
                  <span>{p.totalPiezas} {p.totalPiezas === 1 ? 'pieza' : 'piezas'}</span>
                )}
                {p.fechaLimite && (
                  <span className="surtir-card-fecha-limite">
                    {t('surtir.limite')}: {formatearFechaLimite(p.fechaLimite)}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
