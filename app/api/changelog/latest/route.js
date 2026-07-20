import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { getUsuario } from '@/lib/auth'

// Última entrada de changelog NO descartada todavía por el usuario actual —
// alimenta el modal global de "novedades". Devuelve null cuando no hay nada
// que mostrar (sin entradas, o ya la descartó).
export async function GET() {
  const usuario = await getUsuario()
  if (!usuario?.userId) {
    return NextResponse.json({ entrada: null })
  }

  const db = await getDb()
  const [ultima] = await db
    .collection('changelog_entries')
    .find({})
    .sort({ publicadoEn: -1 })
    .limit(1)
    .toArray()

  if (!ultima) {
    return NextResponse.json({ entrada: null })
  }

  const descartado = await db.collection('changelog_dismissals').findOne({
    entryId: ultima._id.toString(),
    usuarioId: usuario.userId,
  })
  if (descartado) {
    return NextResponse.json({ entrada: null })
  }

  return NextResponse.json({ entrada: { ...ultima, _id: ultima._id.toString() } })
}
