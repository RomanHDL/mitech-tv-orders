import { getDb } from '@/lib/mongodb'
import UsuariosCliente from './usuarios-cliente'

export const dynamic = 'force-dynamic'

async function obtenerUsuarios() {
  const db = await getDb()
  const usuarios = await db.collection('usuarios')
    .find({})
    .sort({ creado: -1 })
    .toArray()

  return usuarios.map((u) => ({
    id: u._id.toString(),
    email: u.email || '',
    nombre: u.nombre || '',
    rol: u.rol,
    tienePin: Boolean(u.pin),
    tieneNfc: Boolean(u.nfcUid),
    nfcUid: u.nfcUid || '',
    creado: u.creado ? new Date(u.creado).toISOString() : null,
  }))
}

export default async function UsuariosPage() {
  const usuarios = await obtenerUsuarios()
  return <UsuariosCliente usuarios={usuarios} />
}
