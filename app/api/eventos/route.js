import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { getUsuario } from '@/lib/auth'
import { construirFiltroEventos, idsDePedidosDeCapturista } from '@/lib/eventos'

const PAGINAS_VALIDAS = [8, 15, 25, 50, 100]
const LIMITE_EXPORTACION = 5000

// GET /api/eventos?q=&desde=&hasta=&estado=&tipo=&usuario=&condicion=&categoria=&pagina=&porPagina=&todos=1
// Lista paginada de eventos (auditoría real de pedidos), con paginación de
// servidor real — nunca se traen todos los eventos al navegador salvo que
// se pida explícitamente `todos=1` para exportación (con un tope duro).
export async function GET(req) {
  const usuario = await getUsuario()
  const { searchParams } = new URL(req.url)

  const filtro = construirFiltroEventos({
    busqueda: searchParams.get('q') || '',
    desde: searchParams.get('desde') || '',
    hasta: searchParams.get('hasta') || '',
    estado: searchParams.get('estado') || 'todos',
    tipoEvento: searchParams.get('tipo') || 'todos',
    usuarioId: searchParams.get('usuario') || 'todos',
    condicion: searchParams.get('condicion') || 'todos',
    categoria: searchParams.get('categoria') || 'todos',
    pedidoIdsDeCapturista: await idsDePedidosDeCapturista(await getDb(), usuario),
  })

  const db = await getDb()
  const col = db.collection('eventos')

  const total = await col.countDocuments(filtro)

  const esExportacion = searchParams.get('todos') === '1'
  const porPaginaSolicitado = Number(searchParams.get('porPagina')) || 15
  const porPagina = PAGINAS_VALIDAS.includes(porPaginaSolicitado) ? porPaginaSolicitado : 15
  const pagina = Math.max(1, Number(searchParams.get('pagina')) || 1)

  let cursor = col.find(filtro).sort({ creadoEn: -1 })
  if (esExportacion) {
    cursor = cursor.limit(LIMITE_EXPORTACION)
  } else {
    cursor = cursor.skip((pagina - 1) * porPagina).limit(porPagina)
  }

  const eventos = await cursor.toArray()

  return NextResponse.json({
    eventos: eventos.map((e) => ({ ...e, _id: e._id.toString() })),
    total,
    pagina,
    porPagina,
  })
}
