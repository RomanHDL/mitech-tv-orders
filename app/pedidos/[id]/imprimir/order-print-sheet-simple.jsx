'use client'

import { useTranslation } from 'react-i18next'
import { isRequestedQuantityDefined } from '@/lib/surtido-grupos'
import { LOGO_MITECH } from '@/lib/logo-mitech'
import PrintPageCount from './print-page-count'
import './imprimir.css'

// Vista de impresión "simple" — pensada para el piso de surtido, no para
// reporte ejecutivo: letra grande, blanco y negro, sin KPIs ni fechas ni
// colores. Mismo dato/agrupación que la vista completa (marca → pulgadas →
// SKU, misma fuente de verdad de lib/surtido-grupos.js) — solo cambia la
// presentación. La meta (pide/pendiente) le pertenece al GRUPO, nunca se
// inventa por SKU; cada SKU solo muestra lo que aportó él (surtido).
export default function OrderPrintSheetSimple({ pedido, brandSections, pedidoRef }) {
  const { t } = useTranslation()
  return (
    <div id="print-order-root" className="print-hoja print-simple">
      <div className="print-simple-header">
        <img src={LOGO_MITECH} alt="MiTechnologies" className="print-simple-logo" />
        <div className="print-simple-header-texto">
          <h1 className="print-simple-pedido-nombre">{pedido.pedidoNombre.toUpperCase()}</h1>
          {pedido.numeroPedido && <span className="print-simple-numero">#{pedido.numeroPedido}</span>}
        </div>
        <div className="print-simple-ref">REF: {pedidoRef}</div>
      </div>

      {brandSections.map((brand) => (
        <section key={brand.key} className="print-simple-marca">
          <h2 className="print-simple-marca-nombre">{brand.label.toUpperCase()}</h2>

          {brand.sizes.map((group) => {
            const requestedText = isRequestedQuantityDefined(group.requested)
              ? group.requested
              : t('surtir.grupo.porDefinir')
            const pendingText = group.summary.pending === null || group.summary.pending === undefined
              ? '—'
              : group.summary.pending

            return (
              <div key={group.key} className="print-simple-grupo">
                <div className="print-simple-grupo-header">
                  <span className="print-simple-grupo-pulgadas">{group.size}&quot;</span>
                  <span className="print-simple-grupo-metricas">
                    <span>{t('surtir.grupo.solicitadoGrupo')} <b>{requestedText}</b></span>
                    <span>{t('surtir.grupo.surtidoGrupo')} <b>{group.summary.supplied}</b></span>
                    <span>{t('surtir.grupo.pendienteGrupo')} <b>{pendingText}</b></span>
                  </span>
                </div>

                <div className="print-simple-sku-lista">
                  {group.products.map((tv) => (
                    <div key={tv._idx} className="print-simple-sku-fila">
                      <span className="print-simple-sku-modelo">{tv.modelo || '—'}</span>
                      {(tv.condiciones || []).length > 0 && (
                        <span className="print-simple-sku-cond">{tv.condiciones.join(' / ')}</span>
                      )}
                      <span className="print-simple-sku-llevamos">
                        {t('common.surtido')}: <b>{tv.cantidadSurtida || 0}</b>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </section>
      ))}

      <footer className="print-simple-footer">
        <PrintPageCount />
      </footer>
    </div>
  )
}
