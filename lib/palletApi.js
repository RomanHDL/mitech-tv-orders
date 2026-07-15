// Cliente del API de pallets del WMS (appsc.mitechnologiesinc.com).
// La respuesta trae `Movimientos` como un string JSON escapado, y cada
// movimiento trae a su vez `ProductosMovidos` como otro string JSON anidado.
// Hay que hacer doble JSON.parse — nunca confiar en que ya vengan como array.

const BASE_URL = process.env.PALLET_API_URL || 'https://appsc.mitechnologiesinc.com'

function parseJsonSeguro(valor) {
  if (typeof valor !== 'string' || !valor.trim()) return []
  try {
    const parsed = JSON.parse(valor)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// Consulta el pallet por su código (ej. "A01-F015-001") y normaliza los
// movimientos/productos anidados. Devuelve null si no hay código.
export async function getPalletMovimientos(palletCode) {
  if (!palletCode) return null

  const url = `${BASE_URL}/Home/BinPalletID_GET_ApiAR?PalletID=${encodeURIComponent(palletCode)}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`API de pallets respondió ${res.status}`)
  }

  // Pallets sin registro devuelven 200 con cuerpo vacío (no JSON válido).
  const texto = await res.text()
  if (!texto.trim()) return null
  let data
  try {
    data = JSON.parse(texto)
  } catch {
    throw new Error('API de pallets devolvió una respuesta inválida')
  }

  const movimientos = parseJsonSeguro(data.Movimientos).map((m) => ({
    tipoMovimiento: m.TipoMovimiento || '',
    fechaMovimiento: m.FechaMovimiento || null,
    movidoPor: m.MovidoPor || '',
    palletOrigen: m.PalletOrigen || '',
    palletDestino: m.PalletDestino || '',
    comments: m.Comments || '',
    productosMovidos: parseJsonSeguro(m.ProductosMovidos).map((p) => ({
      productSKU: p.ProductSKU || '',
      serialNumber: p.SerialNumber || '',
      qty: p.Qty || 0,
    })),
  }))

  return {
    nombrePallet: data.NombrePallet || palletCode,
    cantidadTotal: data.CantidadTotal,
    condiciones: data.Condiciones,
    ubicacion: data.Ubicacion,
    movimientos,
  }
}
