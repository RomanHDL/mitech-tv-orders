// Orden "canónico" de las televisiones de un pedido — mismo criterio que ya
// usaba el módulo Surtir (app/surtir/panel-surtido.jsx: agrupa por marca y
// ordena cada grupo por pulgadas). Se extrae aquí para que Editar e Imprimir
// dejen de mostrar el orden crudo de inserción (donde un SKU agregado
// después, ej. vía "agregar SKU de último momento", quedaba pegado al final
// en vez de junto a sus hermanos del mismo tamaño).
//
// Array.prototype.sort es estable desde ES2019: dos TVs de la misma marca y
// pulgadas conservan su orden relativo original entre sí.
export function ordenarPorMarcaYPulgadas(televisiones) {
  const mapa = {}
  for (const tv of televisiones) {
    const marca = tv.marca || ''
    if (!mapa[marca]) mapa[marca] = []
    mapa[marca].push(tv)
  }
  return Object.keys(mapa)
    .sort()
    .flatMap((marca) => mapa[marca].slice().sort((a, b) => (a.pulgadas || 0) - (b.pulgadas || 0)))
}
