import { getUsuario } from '@/lib/auth'
import HistorialCliente from './historial-cliente'

export const dynamic = 'force-dynamic'

// Server component delgado a propósito: el módulo de Historial ahora es un
// dashboard de auditoría con paginación de servidor real (no una lista de
// pedidos precargada) — todos los datos (eventos, métricas, opciones de
// filtro) se piden desde el cliente a /api/eventos/* según el usuario
// interactúa, para no traer miles de eventos en cada carga de página.
export default async function HistorialPage() {
  const usuario = await getUsuario()

  return (
    <main className="page-wide historial-page">
      <HistorialCliente rol={usuario?.rol} />
    </main>
  )
}
