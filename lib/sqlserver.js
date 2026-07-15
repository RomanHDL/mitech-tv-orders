import sql from 'mssql'

let poolPromise

// Pool de conexión al SQL Server del WMS (BinManagerRO, usuario solo-lectura).
// Mismo patrón singleton que lib/mongodb.js para sobrevivir cold starts.
function getPoolPromise() {
  if (poolPromise) return poolPromise

  const {
    SQLSERVER_HOST,
    SQLSERVER_PORT,
    SQLSERVER_USER,
    SQLSERVER_PASSWORD,
    SQLSERVER_DB,
  } = process.env

  if (!SQLSERVER_HOST || !SQLSERVER_USER || !SQLSERVER_PASSWORD || !SQLSERVER_DB) {
    throw new Error('Faltan variables SQLSERVER_* en variables de entorno')
  }

  const config = {
    server: SQLSERVER_HOST,
    port: Number(SQLSERVER_PORT) || 1433,
    user: SQLSERVER_USER,
    password: SQLSERVER_PASSWORD,
    database: SQLSERVER_DB,
    options: { encrypt: false, trustServerCertificate: true },
    pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
    connectionTimeout: 15000,
    requestTimeout: 20000,
  }

  if (process.env.NODE_ENV === 'development') {
    if (!global._sqlPoolPromise) {
      global._sqlPoolPromise = new sql.ConnectionPool(config).connect()
    }
    poolPromise = global._sqlPoolPromise
  } else {
    poolPromise = new sql.ConnectionPool(config).connect()
  }

  return poolPromise
}

async function getPool() {
  return await getPoolPromise()
}

// Pedidos del WMS en vivo. Usa joins directos sobre tablas base (OM.Orders,
// OM.Customers, SOP.vw_StatusInternal): el usuario de solo-lectura NO tiene
// acceso a la base BinManager primaria, así que las vistas ya armadas
// (OM.vw_OrderDetails, BM.vw_OrdersMaster, FFM.vw_OrdersMaster_V2) fallan por
// ser cross-DB. No usarlas.
export async function getPedidosLive({ limit = 100, search = '' } = {}) {
  const pool = await getPool()
  const top = Math.min(Math.max(Number(limit) || 100, 1), 500)

  const request = pool.request()
  request.input('top', sql.Int, top)
  request.input('search', sql.NVarChar, search ? `%${search}%` : null)

  const result = await request.query(`
    SELECT TOP (@top)
      o.OrderID, o.WebOrderID, o.Source, o.AccountName,
      c.FullName, c.CompanyName,
      st.StatusName AS Estatus, st.StatusDescription AS EstatusDescripcion,
      o.CurrencyCode, o.Total, o.EnteredDate, o.Location, o.PONumber
    FROM OM.Orders o
    LEFT JOIN OM.Customers c ON o.CustomerID = c.CustomerID
    LEFT JOIN SOP.vw_StatusInternal st ON o.StatusInternal = st.StatusID
    WHERE (
      @search IS NULL
      OR o.WebOrderID LIKE @search
      OR o.AccountName LIKE @search
      OR o.Source LIKE @search
      OR o.PONumber LIKE @search
      OR CAST(o.OrderID AS NVARCHAR(20)) LIKE @search
    )
    ORDER BY o.OrderID DESC
  `)

  return result.recordset
}

// Artículos de un pedido, con el BinCode (nombre de pallet) resuelto para
// poder consultar después la API de movimientos (lib/palletApi.js).
export async function getItemsDePedido(orderId) {
  const pool = await getPool()
  const request = pool.request()
  request.input('orderId', sql.Int, orderId)

  const result = await request.query(`
    SELECT
      oi.OrderItemsID, oi.SKU, oi.ItemDescription, oi.Qty, oi.Amount,
      oi.BinID, b.BinCode
    FROM OM.OrderItems oi
    LEFT JOIN BM.Bins b ON oi.BinID = b.BinID
    WHERE oi.OrderID = @orderId
    ORDER BY oi.OrderItemsID
  `)

  return result.recordset
}
