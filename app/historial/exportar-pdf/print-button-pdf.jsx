'use client'

import { IconArrowLeft, IconPrinter } from '../../components/icons'

export default function PrintButtonPdf() {
  return (
    <div className="pdf-acciones-imprimir">
      <button onClick={() => window.close()} className="btn-volver">
        <IconArrowLeft />
        Cerrar
      </button>
      <button onClick={() => window.print()} className="btn-imprimir">
        <IconPrinter />
        Imprimir / Guardar como PDF
      </button>
    </div>
  )
}
