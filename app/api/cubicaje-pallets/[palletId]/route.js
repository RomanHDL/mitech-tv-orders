import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { getServerT } from '@/lib/i18n-server'
import { sanitizarMensajeError, serializarPalletPublico } from '@/lib/integration-cubicaje'

// Lookup de un pallet ya recibido de Cubicaje (colección integrationCubicajePallets,
// alimentada por POST /api/integrations/cubicaje/pallets). Es una consulta local —
// el navegador NUNCA llama a Cubicaje directamente. Auth: cualquier rol logueado
// (regla general de GET en middleware.js), sin modulo adicional — es solo lectura
// de un dato ya sincronizado, análogo a consultar el propio pedido.
export async function GET(_req, { params }) {
  const t = await getServerT()
  const { palletId } = await params
  if (typeof palletId !== 'string' || !palletId.trim()) {
    return NextResponse.json({ error: t('apiComun.idInvalido') }, { status: 400 })
  }

  try {
    const db = await getDb()
    const pallet = await db.collection('integrationCubicajePallets').findOne({ palletId: palletId.trim() })
    if (!pallet) {
      return NextResponse.json({ error: t('apiPallets.palletNoEncontrado') }, { status: 404 })
    }
    return NextResponse.json(serializarPalletPublico(pallet))
  } catch (err) {
    console.error('[cubicaje-pallets] Error interno:', sanitizarMensajeError(err))
    return NextResponse.json({ error: t('apiPallets.errorInterno') }, { status: 500 })
  }
}
