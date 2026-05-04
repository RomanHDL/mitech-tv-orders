'use client'

import { useEffect } from 'react'

// Mide el alto real del contenido y ajusta la variable CSS --fs-mult
// hasta que quepa en una hoja carta vertical.
export default function FitToPage() {
  useEffect(() => {
    const ajustar = () => {
      const el = document.querySelector('.contenido-imprimir')
      if (!el) return

      // Letter portrait a 96 DPI: 11" * 96 = 1056 px de alto.
      // Margenes de 1cm arriba y abajo: ~75 px.
      // Margen de seguridad para que no se corte: usar 940.
      const objetivo = 940

      const leerMult = () =>
        parseFloat(getComputedStyle(el).getPropertyValue('--fs-mult')) || 1

      let mult = leerMult()

      // Si el contenido ya cabe, intenta crecer hasta el tope (1).
      if (el.scrollHeight <= objetivo) {
        while (mult < 1) {
          const siguiente = Math.min(1, mult + 0.04)
          el.style.setProperty('--fs-mult', String(siguiente.toFixed(3)))
          if (el.scrollHeight > objetivo) {
            // Nos pasamos, volver al anterior y salir.
            el.style.setProperty('--fs-mult', String(mult.toFixed(3)))
            return
          }
          mult = siguiente
        }
        return
      }

      // Si no cabe, encoger hasta que entre o llegar al mínimo.
      while (el.scrollHeight > objetivo && mult > 0.35) {
        mult -= 0.04
        el.style.setProperty('--fs-mult', String(mult.toFixed(3)))
      }
    }

    // Correr después del primer paint
    const timer = setTimeout(ajustar, 80)

    // Re-medir antes de imprimir y al cambiar tamaño de ventana
    window.addEventListener('beforeprint', ajustar)
    window.addEventListener('resize', ajustar)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('beforeprint', ajustar)
      window.removeEventListener('resize', ajustar)
    }
  }, [])

  return null
}
