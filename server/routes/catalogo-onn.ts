// Catálogo ONN (modelo -> pulgadas) usado para autollenar pulgadas al
// importar en lote (SKUs de ONN no traen el tamaño en el modelo). Solo se
// expone la lectura aquí (capturista y admin la necesitan para el panel de
// import de <PedidoForm>); el CRUD de administración llega en la Fase 7.
import { Router, type Express } from 'express'
import { db } from '../db'
import { catalogoOnn } from '../../shared/schema'
import { requireRole } from '../middleware/auth'

const router = Router()

router.get('/api/catalogo-onn', requireRole('admin', 'capturista'), async (_req, res) => {
  const filas = await db.select().from(catalogoOnn)
  res.json(filas)
})

export function registerCatalogoOnnRoutes(app: Express) {
  app.use(router)
}
