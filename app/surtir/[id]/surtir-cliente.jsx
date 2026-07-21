'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { IconArrowLeft } from '../../components/icons'
import PanelSurtido from '../panel-surtido'

// Vista standalone de un solo pedido (deep link / acceso directo). Toda la
// lógica real de surtido vive en PanelSurtido, la misma que usa la vista
// unificada de /surtir — para no duplicar el módulo en dos versiones.
export default function SurtirCliente({ pedido, rol }) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  return (
    <main className="surtir-standalone-page">
      <div className="surtir-standalone-volver">
        <Link href="/surtir" className="btn btn-secondary btn-sm">
          <IconArrowLeft /> Volver
        </Link>
      </div>
      <PanelSurtido
        pedido={pedido}
        rol={rol}
        standalone
        onCambiado={() => startTransition(() => router.refresh())}
      />
    </main>
  )
}
