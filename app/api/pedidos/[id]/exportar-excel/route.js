import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { getServerT } from '@/lib/i18n-server'
import { generarWorkbookExcelPedido } from '@/lib/pedido-excel-workbook'

// Descarga el "Avance del pedido" de UN SOLO pedido como .xlsx — servido
// desde el servidor (no en el cliente) porque `exceljs` necesita Node para
// escribir estilos/colores/formato condicional reales (la librería `xlsx`
// del lado cliente, usada por la exportación masiva de /pedidos, no
// soporta escribir estilos en su versión gratuita).
export async function GET(_req, { params }) {
  const t = await getServerT()
  const { id } = await params
  if (!ObjectId.isValid(id)) {
    return Response.json({ error: t('apiComun.idInvalido') }, { status: 400 })
  }
  const db = await getDb()
  const pedido = await db.collection('pedidos').findOne({ _id: new ObjectId(id) })
  if (!pedido) {
    return Response.json({ error: t('apiComun.noEncontrado') }, { status: 404 })
  }

  const televisiones = (pedido.televisiones || []).map((tvRaw) => ({
    ...tvRaw,
    condiciones: Array.isArray(tvRaw.condiciones) ? tvRaw.condiciones : (tvRaw.condicion ? [tvRaw.condicion] : []),
  }))

  const { buffer, nombreArchivo } = await generarWorkbookExcelPedido(
    { ...pedido, televisiones },
    t,
  )

  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nombreArchivo}"; filename*=UTF-8''${encodeURIComponent(nombreArchivo)}`,
    },
  })
}
