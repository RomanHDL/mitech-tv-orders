// Puerto de lib/importar-pedido.js — parser y normalización compartida
// para importar pedidos en lote (pegar texto, Excel o foto/OCR). Convierte
// filas crudas {brand, model, qty} en items con la forma que usa el
// formulario de TVs, autodetectando pulgadas.
import { MARCAS, PULGADAS, SKU_REGEX } from './schema'

const MARCAS_LOWER = new Map(MARCAS.map((m) => [m.toLowerCase(), m]))

export function normalizarMarca(raw: unknown): string {
  const t = String(raw || '').trim()
  return MARCAS_LOWER.get(t.toLowerCase()) || t
}

export function limpiarSku(raw: unknown): string {
  return String(raw || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 20).toUpperCase()
}

// Las pulgadas son los PRIMEROS DOS DÍGITOS del modelo, ignorando letras.
//   32H40G -> 32 | 40H4030F4 -> 40 | UN50U7900F -> 50 | 55S451 -> 55 |
//   100012585 -> "10" no válido -> '' (ONN, se llena a mano / catálogo)
export function detectarPulgadas(model: unknown): number | '' {
  const digitos = String(model || '').replace(/\D/g, '')
  if (digitos.length < 2) return ''
  const n = parseInt(digitos.slice(0, 2), 10)
  return (PULGADAS as readonly number[]).includes(n) ? n : ''
}

const CABECERAS = new Set(['brand', 'marca', 'model', 'modelo', 'sku', 'qty', 'cantidad', 'cant'])

function dividirLinea(linea: string): string[] {
  if (linea.includes('\t')) return linea.split('\t')
  if (linea.includes(',')) return linea.split(',')
  const porBloques = linea.split(/\s{2,}/)
  if (porBloques.filter((c) => c.trim() !== '').length >= 3) return porBloques
  return linea.split(/\s+/)
}

export type FilaCruda = { brand: string; model: string; qty: number }

export function parsearTexto(texto: string): FilaCruda[] {
  const filas: FilaCruda[] = []
  for (const lineaRaw of String(texto || '').split(/\r?\n/)) {
    const linea = lineaRaw.trim()
    if (!linea) continue
    const celdas = dividirLinea(linea).map((c) => c.trim())
    const primera = (celdas[0] || '').toLowerCase()
    if (primera.startsWith('total')) continue
    if (CABECERAS.has(primera)) continue
    const fila = celdasAFila(celdas)
    if (fila) filas.push(fila)
  }
  return filas
}

function celdasAFila(celdas: string[]): FilaCruda | null {
  const utiles = celdas.filter((c) => c !== '')
  if (utiles.length < 2) return null
  const brand = utiles[0]
  const model = utiles[1]
  let qty = 0
  for (let i = utiles.length - 1; i >= 2; i--) {
    const n = parseInt(String(utiles[i]).replace(/[^\d]/g, ''), 10)
    if (Number.isFinite(n)) {
      qty = n
      break
    }
  }
  return { brand, model, qty }
}

const CABECERAS_SKU_BLOQUE = new Set(['sku', 'skus'])
const CABECERAS_BRAND_BLOQUE = new Set(['brand', 'marca'])
const CABECERAS_SIZE_BLOQUE = new Set(['size', 'pulgadas', 'tamano', 'tamaño'])

export type ItemFlags = { marcaOk: boolean; skuOk: boolean; pulgadasOk: boolean }
export type ItemImportado = {
  marca: string
  modelo: string
  modelosAlternativos: string[]
  pulgadas: number | ''
  cantidad: number
  unidad: 'pieza' | 'pallet'
  sinLimite: boolean
  _flags: ItemFlags
}

// Respaldo para listas "en bloque" (una columna) tipo:
//   SKU / SNTV007470 / SNTV007133 / Brand: / Samsung / Size: / 65
// Son SKUs ALTERNATIVOS de una misma TV (cualquiera sirve), cantidad
// siempre 1; "Size" es el tamaño de pantalla, no se usa como cantidad.
export function parsearBloqueAlternativas(texto: string): ItemImportado[] | null {
  const lineas = String(texto || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  const skus: string[] = []
  let brand = ''
  let size = ''
  let modo: 'sku' | 'brand' | 'size' | null = null
  for (const linea of lineas) {
    const clave = linea.toLowerCase().replace(/:$/, '')
    if (CABECERAS_SKU_BLOQUE.has(clave)) {
      modo = 'sku'
      continue
    }
    if (CABECERAS_BRAND_BLOQUE.has(clave)) {
      modo = 'brand'
      continue
    }
    if (CABECERAS_SIZE_BLOQUE.has(clave)) {
      modo = 'size'
      continue
    }
    if (modo === 'sku') skus.push(linea)
    else if (modo === 'brand' && !brand) brand = linea
    else if (modo === 'size' && !size) size = linea
  }

  const modelos = skus.map(limpiarSku).filter(Boolean)
  if (modelos.length === 0) return null

  const marca = normalizarMarca(brand)
  const tallaNum = parseInt(String(size).replace(/[^\d]/g, ''), 10)
  const pulgadas = (PULGADAS as readonly number[]).includes(tallaNum) ? tallaNum : detectarPulgadas(modelos[0])

  return [
    {
      marca,
      modelo: modelos[0],
      modelosAlternativos: modelos.slice(1),
      pulgadas,
      cantidad: 1,
      unidad: 'pieza',
      sinLimite: false,
      _flags: {
        marcaOk: (MARCAS as readonly string[]).includes(marca),
        skuOk: SKU_REGEX.test(modelos[0]),
        pulgadasOk: pulgadas !== '',
      },
    },
  ]
}

// Rellena las pulgadas vacías usando un mapa { MODELO: pulgada } (catálogo ONN).
export function aplicarCatalogo(items: ItemImportado[], mapa: Record<string, number> | null | undefined): ItemImportado[] {
  if (!mapa || !items?.length) return items
  return items.map((it) => {
    if (it.pulgadas === '' && mapa[it.modelo] != null) {
      return { ...it, pulgadas: mapa[it.modelo], _flags: { ...it._flags, pulgadasOk: true } }
    }
    return it
  })
}

export function filasAItems(filas: FilaCruda[]): ItemImportado[] {
  return (filas || []).map((f) => {
    const marca = normalizarMarca(f.brand)
    const modelo = limpiarSku(f.model)
    const pulgadas = detectarPulgadas(f.model)
    const cantidad = Number(f.qty) > 0 ? Math.floor(Number(f.qty)) : 1
    return {
      marca,
      modelo,
      modelosAlternativos: [],
      pulgadas,
      cantidad,
      unidad: 'pieza',
      sinLimite: false,
      _flags: {
        marcaOk: (MARCAS as readonly string[]).includes(marca),
        skuOk: SKU_REGEX.test(modelo),
        pulgadasOk: pulgadas !== '',
      },
    }
  })
}
