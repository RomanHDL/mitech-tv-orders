import { getDb } from '@/lib/mongodb'
import { DEFAULT_MODULOS_POR_ROL, sanearModulos } from '@/lib/modulos'
import UsuariosCliente from './usuarios-cliente'

export const dynamic = 'force-dynamic'

async function obtenerUsuarios() {
  const db = await getDb()
  const usuarios = await db.collection('usuarios')
    .find({})
    .sort({ creado: -1 })
    .toArray()

  // Misma migración perezosa que GET /api/usuarios: usuarios sin
  // allowedModules reciben el default de su rol y se persiste una vez.
  const resultado = []
  for (const u of usuarios) {
    let allowedModules = sanearModulos(u.allowedModules)
    if (allowedModules.length === 0) {
      allowedModules = DEFAULT_MODULOS_POR_ROL[u.rol] || []
      await db.collection('usuarios').updateOne({ _id: u._id }, { $set: { allowedModules } })
    }
    resultado.push({
      id: u._id.toString(),
      email: u.email || '',
      nombre: u.nombre || '',
      rol: u.rol,
      tienePin: Boolean(u.pin),
      tieneNfc: Boolean(u.nfcUid),
      nfcUid: u.nfcUid || '',
      allowedModules,
      creado: u.creado ? new Date(u.creado).toISOString() : null,
    })
  }
  return resultado
}

export default async function UsuariosPage() {
  const usuarios = await obtenerUsuarios()
  return <UsuariosCliente usuarios={usuarios} />
}
