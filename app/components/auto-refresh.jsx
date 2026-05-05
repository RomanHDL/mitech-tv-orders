'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'

// Refresca el RSC payload cada 3s en páginas relevantes.
// router.refresh() es soft: NO resetea state de cliente
// (inputs, buscadores, foco, scroll), solo trae datos nuevos del server.
export default function AutoRefresh() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname) return
    if (pathname === '/login') return
    if (pathname.includes('/imprimir')) return

    const id = setInterval(() => {
      router.refresh()
    }, 3000)
    return () => clearInterval(id)
  }, [router, pathname])

  return null
}
