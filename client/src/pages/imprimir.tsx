// Puerto de app/pedidos/[id]/imprimir/page.jsx — vista de impresión agrupada
// por marca, ordenada por pulgadas, auto-ajustada a una hoja carta.
import { useParams } from 'wouter'
import { useQuery } from '@tanstack/react-query'
import PrintButton from '@/components/print-button'
import { useFitToPage } from '@/hooks/use-fit-to-page'
import { unidadLabel, type PedidoConTvs, type TelevisionRow, type EstadoOperativo } from '@shared/schema'
import { diasHastaLimite, normalizeOrderStatus, totalRequerido, totalSurtido } from '@/lib/pedido-stats'
import './imprimir.css'

function agruparPorMarca(televisiones: TelevisionRow[]) {
  const grupos: Record<string, TelevisionRow[]> = {}
  for (const tv of televisiones) {
    if (!grupos[tv.marca]) grupos[tv.marca] = []
    grupos[tv.marca].push(tv)
  }
  return Object.keys(grupos)
    .sort()
    .map((marca) => {
      const items = [...grupos[marca]].sort((a, b) => a.pulgadas - b.pulgadas)
      const pallets = items.reduce((s, tv) => s + (tv.unidad === 'pallet' ? tv.cantidad : 0), 0)
      const piezas = items.reduce((s, tv) => s + (tv.unidad !== 'pallet' ? tv.cantidad : 0), 0)
      return { marca, items, pallets, piezas }
    })
}

function formatearSubtotal(pallets: number, piezas: number) {
  const partes: string[] = []
  if (pallets > 0) partes.push(`${pallets} ${pallets === 1 ? 'PALLET' : 'PALLETS'}`)
  if (piezas > 0) partes.push(`${piezas} ${piezas === 1 ? 'PIEZA' : 'PIEZAS'}`)
  return partes.join(' · ')
}

function estimarMultiplicador(lineas: number) {
  if (lineas > 90) return 0.4
  if (lineas > 60) return 0.55
  if (lineas > 35) return 0.7
  if (lineas > 18) return 0.85
  return 1
}

function decidirColumnas(lineas: number) {
  if (lineas > 60) return 'cols-3'
  if (lineas > 10) return 'cols-2'
  return 'cols-1'
}

function formatearFechaLimiteLarga(iso: string | null) {
  if (!iso) return null
  const [y, m, d] = String(iso).split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
}

// Igual que en la tabla/historial: los estados finales (Cargando, Listo
// para salida, Despachado, Cancelado, Surtido terminado) nunca deben
// mostrar "Vencido" — el pedido ya avanzó, la fecha límite dejó de importar.
function tiempoRestante(estado: EstadoOperativo, dias: number | null, pendiente: number) {
  if (estado === 'DESPACHADO') return { texto: 'DESPACHADO', tono: 'verde' }
  if (estado === 'LISTO_SALIDA') return { texto: 'LISTO PARA SALIDA', tono: 'verde' }
  if (estado === 'CARGANDO') return { texto: 'CARGANDO', tono: 'amarillo' }
  if (estado === 'TERMINADO') return { texto: 'SURTIDO TERMINADO', tono: 'verde' }
  if (estado === 'CANCELADO') return { texto: 'CANCELADO', tono: 'rojo' }

  if (dias === null) return null
  if (dias < 0 && pendiente > 0) return { texto: `VENCIDO HACE ${Math.abs(dias)} D`, tono: 'rojo' }
  if (dias < 0) return null
  if (dias === 0) return { texto: 'ENTREGA HOY', tono: 'rojo' }
  if (dias === 1) return { texto: 'ENTREGA MAÑANA', tono: 'amarillo' }
  if (dias <= 3) return { texto: `${dias} DÍAS`, tono: 'amarillo' }
  return { texto: `${dias} DÍAS`, tono: 'verde' }
}

export default function Imprimir() {
  const { id } = useParams<{ id: string }>()
  const { data: pedido, isLoading } = useQuery<PedidoConTvs>({ queryKey: [`/api/pedidos/${id}`] })

  useFitToPage()

  if (isLoading) return null
  if (!pedido) return <main className="p-6">Pedido no encontrado.</main>

  const grupos = agruparPorMarca(pedido.televisiones)
  const totalPallets = pedido.televisiones.reduce((s, tv) => s + (tv.unidad === 'pallet' ? tv.cantidad || 0 : 0), 0)
  const totalPiezas = pedido.televisiones.reduce((s, tv) => s + (tv.unidad !== 'pallet' ? tv.cantidad || 0 : 0), 0)
  const totalModelos = pedido.televisiones.length
  const cantidadTotalPedido = typeof pedido.cantidadTotal === 'number' && pedido.cantidadTotal > 0 ? pedido.cantidadTotal : null
  const totalLineas = grupos.reduce((s, g) => s + g.items.length + 1, 0)
  const fechaFmt = new Date(pedido.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
  const fechaLimiteFmt = formatearFechaLimiteLarga(pedido.fechaLimite)
  const req = totalRequerido(pedido)
  const surt = totalSurtido(pedido.televisiones)
  const pct = req > 0 ? Math.round((surt / req) * 100) : 0
  const pendiente = req - surt
  const estado = normalizeOrderStatus({ progresoPct: pct, estadoOperativo: pedido.estadoOperativo })
  const dias = diasHastaLimite(pedido.fechaLimite)
  const tiempo = tiempoRestante(estado, dias, pendiente)
  const generadoFmt = new Date().toLocaleString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const colsClass = decidirColumnas(totalLineas)
  const multInicial = estimarMultiplicador(totalLineas)
  const totalLabel = formatearSubtotal(totalPallets, totalPiezas)
  const pedidoCorto = pedido.id.slice(-6).toUpperCase()

  return (
    <main className="imprimir">
      <PrintButton />
      <div
        className={`contenido-imprimir ${colsClass}`}
        style={{ '--fs-mult': String(multInicial) } as React.CSSProperties}
      >
        <div className="top-bar">
          <span className="brand">MITECHNOLOGIES</span>
          <span className="top-bar-ref">REF · {pedidoCorto}</span>
        </div>

        <header className="encabezado">
          {pedido.numeroPedido && <div className="pedido-numero">N° {pedido.numeroPedido}</div>}
          <h1 className="pedido-nombre">{pedido.pedidoNombre.toUpperCase()}</h1>

          <div className="info-grid">
            <div className="info-cell">
              <div className="info-label">Fecha creación</div>
              <div className="info-value">{fechaFmt}</div>
            </div>
            {fechaLimiteFmt && (
              <div className="info-cell">
                <div className="info-label">Fecha límite</div>
                <div className="info-value">{fechaLimiteFmt}</div>
              </div>
            )}
            {tiempo && (
              <div className="info-cell">
                <div className="info-label">Tiempo restante</div>
                <div className={`info-value info-tiempo tono-${tiempo.tono}`}>{tiempo.texto}</div>
              </div>
            )}
            {pedido.creadoPorNombre && (
              <div className="info-cell">
                <div className="info-label">Capturó</div>
                <div className="info-value">{pedido.creadoPorNombre}</div>
              </div>
            )}
          </div>

          {pedido.condiciones.length > 0 && (
            <div className="condiciones-banda">
              <span className="condiciones-label">CONDICIONES</span>
              {pedido.condiciones.map((c) => (
                <span key={c} className={`condicion-chip cond-${c.toLowerCase()}`}>
                  {c}
                </span>
              ))}
            </div>
          )}

          {typeof pedido.comentarios === 'string' && pedido.comentarios.trim() && (
            <div className="comentarios-banda">
              <span className="comentarios-banda-label">COMENTARIOS DEL ENVÍO</span>
              <p className="comentarios-banda-texto">{pedido.comentarios}</p>
            </div>
          )}

          <hr />
        </header>

        <div className="contenido-pedido">
          {grupos.map(({ marca, items, pallets, piezas }) => (
            <section key={marca} className="marca-bloque">
              <div className="marca-header">
                <h2 className="marca-titulo">{marca.toUpperCase()}</h2>
                <span className="marca-subtotal">{formatearSubtotal(pallets, piezas)}</span>
              </div>
              <ul>
                {items.map((tv) => (
                  <li key={tv.id} className={tv.unidad === 'pallet' ? 'es-pallet' : ''}>
                    <span className="col-pulgadas">{tv.pulgadas}&quot;</span>
                    {tv.condicion && (
                      <span className={`col-condicion condicion-chip cond-${tv.condicion.toLowerCase()}`}>{tv.condicion}</span>
                    )}
                    <span className="col-cantidad">{tv.sinLimite ? 'S/L' : tv.cantidad}</span>
                    <span className="col-unidad">{tv.sinLimite ? '' : unidadLabel(tv.cantidad, tv.unidad, true)}</span>
                    <span className="col-modelo">{tv.modelo ? tv.modelo : <span className="modelo-vacio">—</span>}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <section className="resumen-final">
          <hr className="resumen-rule" />
          <div className="resumen-grid">
            {cantidadTotalPedido !== null ? (
              <div className="resumen-cell">
                <div className="resumen-numero">{cantidadTotalPedido}</div>
                <div className="resumen-label">Total del pedido</div>
              </div>
            ) : (
              <div className="resumen-cell">
                <div className="resumen-numero">{totalPiezas}</div>
                <div className="resumen-label">{totalPiezas === 1 ? 'Pieza' : 'Piezas'}</div>
              </div>
            )}
            {totalPallets > 0 && (
              <div className="resumen-cell">
                <div className="resumen-numero">{totalPallets}</div>
                <div className="resumen-label">{totalPallets === 1 ? 'Pallet' : 'Pallets'}</div>
              </div>
            )}
            <div className="resumen-cell">
              <div className="resumen-numero">{totalModelos}</div>
              <div className="resumen-label">{totalModelos === 1 ? 'Modelo' : 'Modelos'}</div>
            </div>
            <div className="resumen-cell">
              <div className="resumen-numero">{grupos.length}</div>
              <div className="resumen-label">{grupos.length === 1 ? 'Marca' : 'Marcas'}</div>
            </div>
          </div>
        </section>

        <footer className="pie">
          Generado {generadoFmt} · {totalLabel} · {totalModelos} modelos · {grupos.length} {grupos.length === 1 ? 'marca' : 'marcas'}
        </footer>
      </div>
    </main>
  )
}
