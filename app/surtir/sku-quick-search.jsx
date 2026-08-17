'use client'

import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isRequestedQuantityDefined } from '@/lib/surtido-grupos'
import { searchSkuMatches } from '@/lib/sku-search'
import { IconAlert, IconCheck, IconMinus, IconPlus, IconSearch } from '../components/icons'

// Buscador rápido de SKU dentro de Surtir — herramienta ADICIONAL sobre el
// diseño agrupado (marca → pulgadas → SKU), que se conserva sin cambios.
// Nunca crea un segundo estado: `onActualizar` es la MISMA función que ya
// usa cada fila de SupplyProductRow (ver panel-surtido.jsx), así que
// confirmar desde aquí actualiza el mismo TV real, su grupo, su marca y los
// totales del pedido — una sola fuente de verdad.
export default function SkuQuickSearch({ products, onActualizar, onEncontrado, pedidoEtiqueta }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  // null = sin búsqueda activa · [] = buscó y no encontró · array = varias coincidencias por elegir
  const [matches, setMatches] = useState(null)
  const [seleccionado, setSeleccionado] = useState(null)
  const [cantidad, setCantidad] = useState(0)
  const [confirmado, setConfirmado] = useState(false)

  const inputRef = useRef(null)
  const cantidadRef = useRef(null)

  function elegir(item) {
    setSeleccionado(item)
    setMatches(null)
    setCantidad(item.product.cantidadSurtida || 0)
    setConfirmado(false)
    onEncontrado?.(item.product._idx)
    setTimeout(() => cantidadRef.current?.focus(), 0)
  }

  function buscar(texto) {
    setConfirmado(false)
    const limpio = texto.trim()
    if (!limpio) {
      setMatches(null)
      setSeleccionado(null)
      return
    }
    const resultados = searchSkuMatches(products, limpio)
    if (resultados.length === 1) {
      elegir(resultados[0])
    } else {
      setSeleccionado(null)
      setMatches(resultados)
    }
  }

  function submitBusqueda(e) {
    e.preventDefault()
    buscar(query)
  }

  function cambiarCantidad(valorBruto) {
    if (!seleccionado) return
    const tv = seleccionado.product
    const limite = tv.sinLimite ? Infinity : tv.cantidad
    setCantidad(Math.max(0, Math.min(limite, Number(valorBruto) || 0)))
  }

  function confirmarAvance(e) {
    e?.preventDefault()
    if (!seleccionado) return
    onActualizar(seleccionado.product._idx, cantidad, { inmediato: true })
    setConfirmado(true)
    setQuery('')
    setMatches(null)
    setSeleccionado(null)
    setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 0)
    setTimeout(() => setConfirmado(false), 2500)
  }

  const tv = seleccionado?.product
  const group = seleccionado?.group
  const metaDefinida = group && isRequestedQuantityDefined(group.requested)
  const tieneMetaIndividual = group && group.summary.individualTarget !== null && group.summary.individualTarget !== undefined

  return (
    <div className="sku-buscador">
      <form className="sku-buscador-caja" onSubmit={submitBusqueda}>
        <label htmlFor="sku-buscador-input" className="sku-buscador-titulo">
          <IconSearch /> {t('surtir.skuBuscador.titulo')}
        </label>
        <div className="sku-buscador-fila">
          <input
            id="sku-buscador-input"
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('surtir.skuBuscador.placeholder')}
            className="sku-buscador-input"
            autoComplete="off"
          />
          <button type="submit" className="btn btn-secondary sku-buscador-btn">
            <IconSearch /> {t('surtir.skuBuscador.boton')}
          </button>
        </div>
      </form>

      {confirmado && (
        <div className="alerta alerta-exito sku-buscador-confirmado">
          <IconCheck /> <span>{t('surtir.skuBuscador.avanceActualizado')}</span>
        </div>
      )}

      {matches !== null && matches.length === 0 && (
        <div className="sku-buscador-resultado sku-buscador-no-encontrado">
          <strong><IconAlert /> {t('surtir.skuBuscador.noEncontradoTitulo')}</strong>
          <p>{t('surtir.skuBuscador.noEncontradoDesc', { sku: query.trim().toUpperCase(), pedido: pedidoEtiqueta })}</p>
        </div>
      )}

      {matches !== null && matches.length > 1 && (
        <div className="sku-buscador-resultado sku-buscador-multiple">
          <strong>{t('surtir.skuBuscador.multipleTitulo', { count: matches.length, query: query.trim() })}</strong>
          <ul className="sku-buscador-lista">
            {matches.map((item) => (
              <li key={item.product._idx}>
                <button type="button" onClick={() => elegir(item)}>
                  <span className="sku-buscador-lista-modelo">{item.product.modelo}</span>
                  <span className="sku-buscador-lista-detalle">
                    {item.brandLabel} {item.group.size}&quot;
                    {(item.product.condiciones || []).map((c) => (
                      <span key={c} className={`tag tag-${c.toLowerCase()}`}>{c}</span>
                    ))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {seleccionado && (
        <div className="sku-buscador-resultado sku-buscador-encontrado">
          <div className="sku-buscador-encontrado-header">
            <strong><IconCheck /> {t('surtir.skuBuscador.encontradoTitulo')}</strong>
            <span className="sku-buscador-encontrado-desc">
              {seleccionado.brandLabel} · {group.size}&quot;
              {(tv.condiciones || []).map((c) => (
                <span key={c} className={`tag tag-${c.toLowerCase()}`}>{c}</span>
              ))}
            </span>
          </div>
          <div className="sku-buscador-encontrado-modelo">{tv.modelo}</div>

          <div className="sku-buscador-metricas">
            <div className="sku-buscador-metrica">
              <span>{t('surtir.grupo.solicitadoGrupo')}</span>
              <strong>{metaDefinida ? group.requested : t('surtir.grupo.porDefinir')}</strong>
            </div>
            <div className="sku-buscador-metrica">
              <span>{t('surtir.grupo.surtidoGrupo')}</span>
              <strong>{group.summary.supplied}</strong>
            </div>
            <div className="sku-buscador-metrica">
              <span>{t('surtir.grupo.pendienteGrupo')}</span>
              <strong>{metaDefinida ? group.summary.pending : '—'}</strong>
            </div>
            {tieneMetaIndividual && (
              <div className="sku-buscador-metrica">
                <span>{t('surtir.grupo.metaSku')}</span>
                <strong>{group.summary.individualTarget}</strong>
              </div>
            )}
          </div>

          <form className="sku-buscador-avance" onSubmit={confirmarAvance}>
            <span className="sku-buscador-avance-label">{t('surtir.cantidadSurtidaLabel')}</span>
            <div className="stepper-cantidad">
              <button
                type="button"
                onClick={() => cambiarCantidad(cantidad - 1)}
                disabled={cantidad === 0}
                aria-label={t('surtir.restarUno')}
                title={t('surtir.restarUno')}
              >
                <IconMinus />
              </button>
              <input
                ref={cantidadRef}
                type="number"
                min="0"
                max={tv.sinLimite ? undefined : tv.cantidad}
                value={cantidad}
                onChange={(e) => cambiarCantidad(e.target.value)}
                aria-label={t('surtir.cantidadSurtidaLabel')}
                className="stepper-cantidad-input"
              />
              <button
                type="button"
                onClick={() => cambiarCantidad(cantidad + 1)}
                disabled={!tv.sinLimite && cantidad >= tv.cantidad}
                aria-label={t('surtir.sumarUno')}
                title={t('surtir.sumarUno')}
              >
                <IconPlus />
              </button>
            </div>
            <button type="submit" className="btn btn-primary sku-buscador-confirmar">
              <IconCheck /> {t('surtir.skuBuscador.confirmarAvance')}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
