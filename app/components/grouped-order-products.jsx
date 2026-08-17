'use client'

import { groupProductsByBrandAndSize } from '@/lib/surtido-grupos'
import BrandSection from '../surtir/brand-section'

// Estructura visual común (encabezado de marca grande y centrado → grupos
// de pulgadas → filas de SKU) compartida entre Nuevo/Editar pedido y
// Surtir — reutiliza EXACTAMENTE el mismo BrandSection/SizeGroupSection,
// solo cambia `mode`:
//   - 'supply': diseño aprobado de Surtir, sin cambios (+/-, confirmar,
//     reiniciar, surtido/pendiente/excedente/estado).
//   - 'create' | 'edit': captura de producto y meta por grupo, sin
//     controles de surtido.
export default function GroupedOrderProducts({
  televisiones,
  metasGrupo,
  mode = 'supply',
  onActualizar,
  onFilaAccion,
  onCambiarMeta,
  highlightedIdx,
}) {
  const brandSections = groupProductsByBrandAndSize(televisiones, metasGrupo)

  return (
    <div className="secciones-surtido">
      {brandSections.map((brandSection) => (
        <BrandSection
          key={brandSection.key}
          brandSection={brandSection}
          mode={mode}
          onActualizar={onActualizar}
          onFilaAccion={onFilaAccion}
          onCambiarMeta={onCambiarMeta}
          highlightedIdx={highlightedIdx}
        />
      ))}
    </div>
  )
}
