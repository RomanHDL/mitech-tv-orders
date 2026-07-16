// Puerto de app/pedidos/[id]/imprimir/fit-to-page.jsx — mide el alto real
// del contenido y ajusta la variable CSS --fs-mult hasta que quepa en una
// hoja carta vertical.
import { useEffect } from 'react'

export function useFitToPage() {
  useEffect(() => {
    const ajustar = () => {
      const el = document.querySelector('.contenido-imprimir') as HTMLElement | null
      if (!el) return

      // Letter portrait a 96 DPI: 11" * 96 = 1056 px de alto.
      // Margen de seguridad para que no se corte: usar 940.
      const objetivo = 940

      const leerMult = () => parseFloat(getComputedStyle(el).getPropertyValue('--fs-mult')) || 1
      let mult = leerMult()

      if (el.scrollHeight <= objetivo) {
        while (mult < 1) {
          const siguiente = Math.min(1, mult + 0.04)
          el.style.setProperty('--fs-mult', String(siguiente.toFixed(3)))
          if (el.scrollHeight > objetivo) {
            el.style.setProperty('--fs-mult', String(mult.toFixed(3)))
            return
          }
          mult = siguiente
        }
        return
      }

      while (el.scrollHeight > objetivo && mult > 0.35) {
        mult -= 0.04
        el.style.setProperty('--fs-mult', String(mult.toFixed(3)))
      }
    }

    const timer = setTimeout(ajustar, 80)
    window.addEventListener('beforeprint', ajustar)
    window.addEventListener('resize', ajustar)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('beforeprint', ajustar)
      window.removeEventListener('resize', ajustar)
    }
  }, [])
}
