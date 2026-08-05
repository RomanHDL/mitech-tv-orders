import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { MARCAS } from '@/lib/catalogos'
import { getUsuario } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Catálogo dinámico de marcas: la lista semilla (lib/catalogos.js) unida a
// cualquier marca real ya usada en pedidos existentes — así una marca nueva
// escrita en un pedido queda disponible para sugerirse en los siguientes,
// sin necesitar una colección/administración de catálogo aparte.
export async function GET() {
  const usuario = await getUsuario()
  if (!usuario) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const db = await getDb()
  const usadas = await db.collection('pedidos').distinct('televisiones.marca')

  const vistas = new Map()
  for (const m of [...MARCAS, ...usadas]) {
    if (typeof m !== 'string' || !m.trim()) continue
    const key = m.trim().toLowerCase()
    if (!vistas.has(key)) vistas.set(key, m.trim())
  }

  const marcas = [...vistas.values()].sort((a, b) => a.localeCompare(b))
  return NextResponse.json({ marcas }, { headers: { 'Cache-Control': 'no-store' } })
}
