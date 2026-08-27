// Parser y normalización compartida para importar pedidos en lote.
// Convierte filas crudas {brand, model, qty, condicion} (de texto pegado,
// Excel o foto/IA) en items con la forma que usa el formulario de TVs,
// autodetectando pulgadas.
import { MARCAS, PULGADAS, SKU_REGEX, CONDICIONES } from './catalogos'

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

// Condición: código tal cual (GRA/GRB/GRC/...), solo normaliza mayúsculas.
export function normalizarCondicion(raw) {
  return String(raw || '').trim().toUpperCase()
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

// Normaliza un texto de encabezado para compararlo/inferir su campo:
// minúsculas, sin acentos, sin paréntesis ni dos puntos, espacios colapsados.
function normalizarEncabezado(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[()]/g, '')
    .replace(/:+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Encabezados reconocidos -> campo canónico de la fila. Cubre tanto el
// formato clásico (Marca, Modelo, Cantidad) como el de pedidos por SKU
// (SKU, QTY, Tipo de TV (Marca), Condición).
const MAPA_ENCABEZADOS = {
  sku: 'sku',
  skus: 'sku',
  modelo: 'modelo',
  model: 'modelo',
  marca: 'marca',
  brand: 'marca',
  tipo: 'marca',
  'tipo de tv': 'marca',
  'tipo de tv marca': 'marca',
  qty: 'qty',
  cantidad: 'qty',
  cant: 'qty',
  condicion: 'condicion',
  condition: 'condicion',
  grado: 'condicion',
}

// Igual que MAPA_ENCABEZADOS pero por coincidencia parcial — respaldo para
// cuando el texto del encabezado viene con ruido (típico del OCR de una
// foto: acentos y palabras cortas como "QTY" son las que más fallan) y no
// calza exacto con el diccionario de arriba.
function inferirCampoEncabezado(normalizado) {
  if (MAPA_ENCABEZADOS[normalizado]) return MAPA_ENCABEZADOS[normalizado]
  if (!normalizado) return null
  if (normalizado.includes('sku')) return 'sku'
  if (normalizado.includes('model')) return 'modelo'
  if (normalizado.includes('marca') || normalizado.includes('brand') || normalizado.includes('tipo')) return 'marca'
  if (normalizado.includes('qty') || normalizado.includes('cant')) return 'qty'
  if (normalizado.includes('condic') || normalizado.includes('grado')) return 'condicion'
  return null
}

// Si `celdas` es un renglón de encabezado reconocible, devuelve un arreglo
// paralelo {índice -> campo canónico|null}; si no, devuelve null. Exige al
// menos 2 campos reconocidos e incluir sku o modelo (identifica la columna
// del producto) para no confundir un renglón de datos con un encabezado.
function detectarEncabezado(celdas) {
  const campos = celdas.map((c) => inferirCampoEncabezado(normalizarEncabezado(c)))
  const reconocidos = campos.filter(Boolean)
  if (reconocidos.length < 2) return null
  if (!campos.includes('sku') && !campos.includes('modelo')) return null
  return campos
}

// celdas + mapa de columnas del encabezado -> {brand, model, qty, condicion}.
// Si el encabezado no logró identificar la columna de QTY o de CONDICIÓN
// (ruido de OCR en esas palabras, muy común con acentos como "CONDICIÓN"),
// se rescatan por el CONTENIDO de las celdas que sobraron: un entero suelto
// solo puede ser QTY, un código del catálogo de condiciones solo puede ser
// CONDICIÓN — no dependen de que el encabezado se haya leído bien.
function filaDesdeColumnas(celdas, mapaColumnas) {
  const valores = {}
  const usados = new Set()
  mapaColumnas.forEach((campo, i) => {
    if (!campo) return
    const val = (celdas[i] ?? '').trim()
    if (val !== '' && valores[campo] === undefined) { valores[campo] = val; usados.add(i) }
  })
  celdas.forEach((c, i) => {
    if (usados.has(i)) return
    const val = (c ?? '').trim()
    if (val === '') return
    if (valores.qty === undefined && /^\d+$/.test(val)) { valores.qty = val; usados.add(i); return }
    if (valores.condicion === undefined && CONDICIONES.includes(val.toUpperCase())) { valores.condicion = val; usados.add(i) }
  })
  const model = valores.sku ?? valores.modelo ?? ''
  if (!model) return null
  return {
    brand: valores.marca || '',
    model,
    qty: valores.qty || '',
    condicion: valores.condicion || '',
  }
}

// Parsea texto pegado (desde Excel/WhatsApp/CSV) a filas {brand, model, qty,
// condicion}. Descarta encabezados y la fila de "Total". Si detecta un
// renglón de encabezado reconocible, usa ESE orden de columnas para todo lo
// que sigue (soporta SKU primero, QTY, Marca, Condición en cualquier orden);
// si no, cae al heurístico clásico columna0=marca/columna1=modelo/última
// celda numérica=cantidad.
export function parsearTexto(texto) {
  const filas = []
  let mapaColumnas = null
  for (const lineaRaw of String(texto || '').split(/\r?\n/)) {
    const linea = lineaRaw.trim()
    if (!linea) continue
    const celdas = dividirLinea(linea).map((c) => c.trim())
    const primera = (celdas[0] || '').toLowerCase()
    if (primera.startsWith('total')) continue
    const encabezado = detectarEncabezado(celdas)
    if (encabezado) { mapaColumnas = encabezado; continue }
    if (!mapaColumnas && CABECERAS.has(primera)) continue
    const fila = mapaColumnas ? filaDesdeColumnas(celdas, mapaColumnas) : celdasAFila(celdas)
    filas.push(fila)
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

const CABECERAS_SKU_BLOQUE = new Set(['sku', 'skus'])
const CABECERAS_BRAND_BLOQUE = new Set(['brand', 'marca'])
const CABECERAS_SIZE_BLOQUE = new Set(['size', 'pulgadas', 'tamano', 'tamaño'])

// Respaldo para listas "en bloque" (una columna) tipo:
//   SKU / SNTV007470 / SNTV007133 / SNTV006977 / Brand: / Samsung / Size: / 65
// Son SKUs ALTERNATIVOS de una misma TV (cualquiera de ellos sirve), no TVs
// distintas. Este formato no trae columna de cantidad -> cantidad SIEMPRE 1;
// "Size" es el tamaño de pantalla, nunca se usa como cantidad ni se multiplica
// por el número de SKUs. Solo se debe invocar cuando el parser tabular normal
// (parsearTexto/filasAItems) no encontró ningún renglón.
export function parsearBloqueAlternativas(texto) {
  const lineas = String(texto || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  const skus = []
  let brand = ''
  let size = ''
  let modo = null
  for (const linea of lineas) {
    const clave = linea.toLowerCase().replace(/:$/, '')
    if (CABECERAS_SKU_BLOQUE.has(clave)) { modo = 'sku'; continue }
    if (CABECERAS_BRAND_BLOQUE.has(clave)) { modo = 'brand'; continue }
    if (CABECERAS_SIZE_BLOQUE.has(clave)) { modo = 'size'; continue }
    if (modo === 'sku') skus.push(linea)
    else if (modo === 'brand' && !brand) brand = linea
    else if (modo === 'size' && !size) size = linea
  }

  const modelos = skus.map(limpiarSku).filter(Boolean)
  if (modelos.length === 0) return null

  const marca = normalizarMarca(brand)
  const tallaNum = parseInt(String(size).replace(/[^\d]/g, ''), 10)
  const pulgadas = PULGADAS.includes(tallaNum) ? tallaNum : detectarPulgadas(modelos[0])

  return [{
    marca,
    modelo: modelos[0],
    modelosAlternativos: modelos.slice(1),
    pulgadas,
    cantidad: 1,
    condicion: '',
    unidad: 'pieza',
    sinLimite: false,
    _flags: {
      marcaOk: MARCAS.includes(marca),
      skuOk: SKU_REGEX.test(modelos[0]),
      pulgadasOk: pulgadas !== '',
      condicionOk: true,
    },
  }]
}

// Rellena las pulgadas vacías usando un mapa { MODELO: pulgada } (catálogo ONN).
// Solo toca los renglones que quedaron en blanco; actualiza su bandera.
export function aplicarCatalogo(items, mapa) {
  if (!mapa || !items?.length) return items
  return items.map((it) => {
    if (it.pulgadas === '' && mapa[it.modelo] != null) {
      return { ...it, pulgadas: mapa[it.modelo], _flags: { ...it._flags, pulgadasOk: true } }
    }
    return it
  })
}

// Convierte filas crudas a items del formulario, con banderas de validez por
// renglón para resaltar lo que falta revisar.
export function filasAItems(filas) {
  return (filas || []).map((f) => {
    const marca = normalizarMarca(f.brand)
    const modelo = limpiarSku(f.model)
    const pulgadas = detectarPulgadas(f.model)
    const cantidad = Number(f.qty) > 0 ? Math.floor(Number(f.qty)) : 1
    const condicion = f.condicion ? normalizarCondicion(f.condicion) : ''
    return {
      marca,
      modelo,
      pulgadas,
      cantidad,
      condicion,
      unidad: 'pieza',
      sinLimite: false,
      _flags: {
        marcaOk: MARCAS.includes(marca),
        skuOk: SKU_REGEX.test(modelo),
        pulgadasOk: pulgadas !== '',
        condicionOk: condicion === '' || CONDICIONES.includes(condicion),
      },
    }
  })
}
