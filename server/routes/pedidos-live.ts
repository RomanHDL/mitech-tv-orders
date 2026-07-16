// Pedidos en vivo del WMS (solo admin) — puerto de
// app/pedidos-live/page.jsx + app/api/pedidos-live/[orderId]/route.js.
import { Router, type Express } from 'express'
import { getPedidosLive, getItemsDePedido } from '../integrations/sqlserver'
import { getPalletMovimientos } from '../integrations/palletApi'
import { requireRole } from '../middleware/auth'

const router = Router()

router.get('/api/pedidos-live', requireRole('admin'), async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 150
    const search = typeof req.query.search === 'string' ? req.query.search : ''
    const filas = await getPedidosLive({ limit, search })
    res.set('Cache-Control', 'no-store').json(
      filas.map((p) => ({
        orderId: p.OrderID,
        webOrderId: p.WebOrderID || '',
        source: p.Source || '',
        accountName: p.AccountName || '',
        cliente: p.FullName || p.CompanyName || '',
        estatus: p.Estatus || 'Sin estatus',
        moneda: p.CurrencyCode || 'MXN',
        total: p.Total,
        fecha: p.EnteredDate,
        ubicacion: p.Location || '',
      }))
    )
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'No se pudo conectar al WMS' })
  }
})

// Detalle de un pedido del WMS: sus artículos y, cuando el artículo ya
// tiene un pallet (BinID) asignado, el último movimiento reportado por la
// API de pallets. Restringido a admin: expone datos internos del WMS
// (clientes, montos).
router.get('/api/pedidos-live/:orderId', requireRole('admin'), async (req, res) => {
  const orderId = Number(req.params.orderId)
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(400).json({ error: 'OrderID inválido' })
  }

  try {
    const filas = await getItemsDePedido(orderId)

    const items = await Promise.all(
      filas.map(async (f) => {
        let ultimoMovimiento = null
        if (f.BinCode) {
          try {
            const pallet = await getPalletMovimientos(f.BinCode)
            const mov = pallet?.movimientos?.[0]
            if (mov) {
              ultimoMovimiento = { tipoMovimiento: mov.tipoMovimiento, movidoPor: mov.movidoPor, fecha: mov.fechaMovimiento }
            }
          } catch {
            // La API de pallets puede fallar sin tumbar el detalle del pedido.
          }
        }
        return {
          orderItemsId: f.OrderItemsID,
          sku: f.SKU,
          itemDescription: f.ItemDescription,
          qty: f.Qty,
          amount: f.Amount,
          binCode: f.BinCode || null,
          ultimoMovimiento,
        }
      })
    )

    res.set('Cache-Control', 'no-store').json({ items })
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Error al consultar el WMS' })
  }
})

export function registerPedidosLiveRoutes(app: Express) {
  app.use(router)
}
