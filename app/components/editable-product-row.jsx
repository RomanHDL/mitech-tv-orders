'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CONDICIONES, PULGADAS, SKU_REGEX } from '@/lib/catalogos'
import { IconArrowDown, IconArrowUp, IconBox, IconChevronDown, IconCopy, IconTrash } from './icons'

// Fila de SKU editable — modo Nuevo/Editar pedido. Mismo estilo visual que
// SupplyProductRow (Surtir), pero captura datos del producto en vez de
// registrar surtido: no hay +/-, confirmar, ni reiniciar aquí.
//
// onAccion(idx, accion, payload?) centraliza duplicar/mover/eliminar/update
// en un solo callback — el padre (PedidoForm) es quien conoce el arreglo
// completo de `tvs` y aplica el cambio por índice real (idx = tv._idx).
export default function EditableProductRow({ tv, individualTarget, onAccion, esPrimera, esUltima }) {
  const { t } = useTranslation()
  const [condicionAbierta, setCondicionAbierta] = useState(false)
  const skuInputRef = useRef(null)
  const idx = tv._idx
  const esPallet = tv.unidad === 'pallet'
  const skuOk = SKU_REGEX.test(tv.modelo || '')
  const tieneMetaIndividual = individualTarget !== null && individualTarget !== undefined

  // Enfoca el campo SKU al montar SOLO si nace vacío — ocurre únicamente
  // cuando la fila se acaba de agregar en blanco (duplicar/importar siempre
  // traen un modelo ya capturado, así que no compiten por el foco).
  useEffect(() => {
    if (!tv.modelo) {
      skuInputRef.current?.focus()
      skuInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const actualizar = (campo, valor) => onAccion(idx, 'update', { campo, valor })

  const toggleCondicion = (codigo) => {
    const actuales = tv.condiciones || []
    const yaEsta = actuales.includes(codigo)
    if (yaEsta && actuales.length === 1) return
    actualizar('condiciones', yaEsta ? actuales.filter((c) => c !== codigo) : [...actuales, codigo])
  }

  return (
    <div className="fila-surtido-fila fila-editable-producto">
      <div className="fila-editable-campos">
        <label className="fila-editable-campo fila-editable-campo-sku">
          <span>{t('pedidoForm.colSkuModelo')}</span>
          <input
            ref={skuInputRef}
            type="text"
            value={tv.modelo}
            onChange={(e) => actualizar('modelo', String(e.target.value).replace(/[^A-Za-z0-9]/g, '').slice(0, 20).toUpperCase())}
            placeholder={t('pedidoForm.colSkuModelo')}
            minLength={3}
            maxLength={20}
            aria-invalid={tv.modelo && !skuOk ? 'true' : undefined}
            required
          />
        </label>

        <label className="fila-editable-campo">
          <span>{t('common.marca')}</span>
          <input
            list="marcas-list"
            value={tv.marca}
            onChange={(e) => actualizar('marca', e.target.value)}
            placeholder={t('common.marca')}
            required
          />
        </label>

        <label className="fila-editable-campo">
          <span>{t('pedidoForm.colPulgada')}</span>
          <select value={tv.pulgadas} onChange={(e) => actualizar('pulgadas', e.target.value)} required>
            <option value="">—</option>
            {PULGADAS.map((p) => <option key={p} value={p}>{p}&quot;</option>)}
          </select>
        </label>

        <div className="fila-editable-campo">
          <span>{t('pedidoForm.colTipo')}</span>
          <div className="tv-segment" role="group" aria-label={t('pedidoForm.tipoTelevisionAria')}>
            <button
              type="button"
              className={`tv-segment-btn ${esPallet ? 'activo' : ''}`}
              onClick={() => actualizar('unidad', 'pallet')}
              aria-pressed={esPallet}
            >
              <IconBox /> {t('pedidoForm.pallet')}
            </button>
            <button
              type="button"
              className={`tv-segment-btn ${!esPallet ? 'activo' : ''}`}
              onClick={() => actualizar('unidad', 'pieza')}
              aria-pressed={!esPallet}
            >
              <span aria-hidden="true">∞</span> {t('pedidoForm.sinLimite')}
            </button>
          </div>
        </div>

        <div className="fila-editable-campo fila-editable-condicion">
          <span>{t('pedidoForm.condicion')}</span>
          <div className="fila-editable-condicion-wrap">
            <button
              type="button"
              className="tv-fila-condicion-btn"
              onClick={() => setCondicionAbierta((v) => !v)}
              aria-expanded={condicionAbierta}
              aria-haspopup="listbox"
            >
              <span className="tv-fila-condicion-resumen">
                {(tv.condiciones || []).map((c) => (
                  <span key={c} className={`tv-condicion-chip tv-condicion-chip-${c.toLowerCase()} tv-fila-condicion-chip`}>{c}</span>
                ))}
              </span>
              <IconChevronDown />
            </button>
            {condicionAbierta && (
              <div className="fila-editable-condicion-dropdown" role="listbox" aria-multiselectable="true">
                {CONDICIONES.map((c) => {
                  const seleccionada = (tv.condiciones || []).includes(c)
                  return (
                    <button
                      key={c}
                      type="button"
                      role="option"
                      aria-selected={seleccionada}
                      className={`tv-condicion-chip tv-condicion-chip-${c.toLowerCase()} tv-condicion-mas-item ${seleccionada ? 'activa' : ''}`}
                      onClick={() => toggleCondicion(c)}
                    >
                      {c}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {tieneMetaIndividual && (
          <div className="fila-editable-campo fila-editable-meta-info">
            <span>{t('pedidoForm.grupo.metaUnicoSku')}</span>
            <strong>{individualTarget}</strong>
          </div>
        )}
      </div>

      <div className="fila-editable-acciones">
        <button type="button" className="btn-icono" onClick={() => onAccion(idx, 'duplicar')} title={t('pedidoForm.duplicarFilaTitle')} aria-label={t('pedidoForm.duplicarFilaTitle')}>
          <IconCopy />
        </button>
        <button type="button" className="btn-icono" onClick={() => onAccion(idx, 'moverArriba')} disabled={esPrimera} title={t('pedidoForm.moverArribaTitle')} aria-label={t('pedidoForm.moverArribaTitle')}>
          <IconArrowUp />
        </button>
        <button type="button" className="btn-icono" onClick={() => onAccion(idx, 'moverAbajo')} disabled={esUltima} title={t('pedidoForm.moverAbajoTitle')} aria-label={t('pedidoForm.moverAbajoTitle')}>
          <IconArrowDown />
        </button>
        <button type="button" className="btn-icono btn-icono-eliminar" onClick={() => onAccion(idx, 'eliminar')} title={t('pedidoForm.quitar')} aria-label={t('pedidoForm.quitar')}>
          <IconTrash />
        </button>
      </div>
    </div>
  )
}
