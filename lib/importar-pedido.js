// Parser y normalización compartida para importar pedidos en lote.
// Convierte filas crudas {brand, model, qty} (de texto pegado, Excel o foto/IA)
// en items con la forma que usa el formulario de TVs, autodetectando pulgadas.
import { MARCAS, PULGADAS, SKU_REGEX } from './catalogos'

// Mapa de marca en minúsculas -> valor canónico del catálogo.
const MARCAS_LOWER = new Map(MARCAS.map((m) => [m.toLowerCase(), m]))

// Devuelve la marca canónica del catálogo (case-insensitive). Si no existe,
// regresa el texto tal cual (trim) para que se marque como inválida.
export function normalizarMarca(raw) {
  const t = String(raw || '').trim()
  return MARCAS_LOWER.get(t.toLowerCase()) || t
}

// SKU/Modelo: solo alfanuméricos, mayúsculas, tal cual viene (máx 20).
export function limpiarSku(raw) {
  return String(raw || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 20).toUpperCase()
}

// Las pulgadas son los PRIMEROS DOS DÍGITOS del modelo, ignorando letras.
// Se acepta solo si es una pulgada válida del catálogo.
//   32H40G -> 32 | 40H4030F4 -> 40 | UN50U7900F -> 50 (no el "UN") |
//   55S451 -> 55 | 100012585 -> "10" no válido -> '' (ONN, se llena a mano)
export function detectarPulgadas(model) {
  const digitos = String(model || '').replace(/\D/g, '')
  if (digitos.length < 2) return ''
  const n = parseInt(digitos.slice(0, 2), 10)
  return PULGADAS.includes(n) ? n : ''
}

const CABECERAS = new Set(['brand', 'marca', 'model', 'modelo', 'sku', 'qty', 'cantidad', 'cant'])

// Separa una línea en celdas: prioriza tab, luego coma, luego 2+ espacios.
// Si eso no logra al menos 3 columnas (típico del texto que sale del OCR de una
// foto, separado por un solo espacio), separa por cualquier espacio.
function dividirLinea(linea) {
  if (linea.includes('\t')) return linea.split('\t')
  if (linea.includes(',')) return linea.split(',')
  const porBloques = linea.split(/\s{2,}/)
  if (porBloques.filter((c) => c.trim() !== '').length >= 3) return porBloques
  return linea.split(/\s+/)
}

// Parsea texto pegado (desde Excel/WhatsApp/CSV) a filas {brand, model, qty}.
// Descarta encabezados y la fila de "Total".
export function parsearTexto(texto) {
  const filas = []
  for (const lineaRaw of String(texto || '').split(/\r?\n/)) {
    const linea = lineaRaw.trim()
    if (!linea) continue
    const celdas = dividirLinea(linea).map((c) => c.trim())
    const primera = (celdas[0] || '').toLowerCase()
    if (primera.startsWith('total')) continue
    if (CABECERAS.has(primera)) continue
    filas.push(celdasAFila(celdas))
  }
  return filas.filter(Boolean)
}

// celdas -> {brand, model, qty}. brand=col0, model=col1, qty=última celda numérica.
function celdasAFila(celdas) {
  const utiles = celdas.filter((c) => c !== '')
  if (utiles.length < 2) return null
  const brand = utiles[0]
  const model = utiles[1]
  // qty: última celda que sea un número entero.
  let qty = 0
  for (let i = utiles.length - 1; i >= 2; i--) {
    const n = parseInt(String(utiles[i]).replace(/[^\d]/g, ''), 10)
    if (Number.isFinite(n)) { qty = n; break }
  }
  return { brand, model, qty }
}

// Convierte filas crudas a items del formulario, con banderas de validez por
// renglón para resaltar lo que falta revisar.
export function filasAItems(filas) {
  return (filas || []).map((f) => {
    const marca = normalizarMarca(f.brand)
    const modelo = limpiarSku(f.model)
    const pulgadas = detectarPulgadas(f.model)
    const cantidad = Number(f.qty) > 0 ? Math.floor(Number(f.qty)) : 1
    return {
      marca,
      modelo,
      pulgadas,
      cantidad,
      unidad: 'pieza',
      sinLimite: false,
      _flags: {
        marcaOk: MARCAS.includes(marca),
        skuOk: SKU_REGEX.test(modelo),
        pulgadasOk: pulgadas !== '',
      },
    }
  })
}
