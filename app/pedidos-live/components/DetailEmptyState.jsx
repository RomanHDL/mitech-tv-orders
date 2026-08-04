'use client'

// Estado vacío elegante y reutilizable para las secciones del detalle
// (pallets, granel, movimientos) — nunca deja un hueco sin explicación.
export default function DetailEmptyState({ mensaje }) {
  return (
    <div className="detalle-vacio-elegante">
      <p>{mensaje}</p>
    </div>
  )
}
