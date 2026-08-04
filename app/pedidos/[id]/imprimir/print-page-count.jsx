'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

// A4 vertical a 96dpi: 297mm ≈ 1123px de alto. Menos ~14mm de margen arriba
// y abajo (~106px) y un margen de seguridad para variación entre motores de
// impresión: ~950px de contenido útil por hoja. Es una ESTIMACIÓN por altura
// de contenido (mismo enfoque que ya usaba fit-to-page.jsx en este proyecto),
// no un conteo exacto de páginas reales — el documento no tiene un footer
// que se repita en cada hoja física (eso requeriría @page margin boxes, con
// soporte inconsistente entre motores de impresión), así que este número
// solo se muestra UNA vez, al final del documento, y por eso "N de N" es
// siempre correcto para esa posición aunque no aparezca en las hojas previas.
const ALTURA_UTIL_PAGINA_PX = 950

export default function PrintPageCount() {
  const { t } = useTranslation()
  const [totalPaginas, setTotalPaginas] = useState(1)

  useEffect(() => {
    const calcular = () => {
      const el = document.getElementById('print-order-root')
      if (!el) return
      setTotalPaginas(Math.max(1, Math.ceil(el.scrollHeight / ALTURA_UTIL_PAGINA_PX)))
    }
    const timer = setTimeout(calcular, 80)
    window.addEventListener('beforeprint', calcular)
    window.addEventListener('resize', calcular)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('beforeprint', calcular)
      window.removeEventListener('resize', calcular)
    }
  }, [])

  return <span>{t('imprimir.paginaDe', { actual: totalPaginas, total: totalPaginas })}</span>
}
