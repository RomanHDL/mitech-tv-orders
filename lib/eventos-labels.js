// Deriva las etiquetas mostradas de un evento de la bitácora. Los eventos
// nuevos ya guardan `detalle`/`detalleSecundario` en el idioma del actor al
// momento de la acción (ver lib/eventos.js + rutas que llaman a
// registrarEvento). Los eventos viejos (de antes de eso) quedaron con los
// literales en español hardcodeados que existían en ese momento — este
// módulo los reconoce y los traduce también al mostrarlos, sin reescribir
// nada en la base de datos. Es un módulo sin dependencias de servidor
// (nada de mongodb/next-headers) para poder usarse tanto en Server
// Components (getServerT) como en componentes cliente (useTranslation).

const DETALLE_LITERAL_A_CLAVE = {
  'Pedido creado': 'pedidoCreado',
  'Surtido iniciado': 'surtidoIniciado',
  '100% surtido': 'surtidoCompleto',
  'Carga iniciada': 'cargaIniciada',
  'Pedido listo para salida': 'listoParaSalida',
  'Pedido despachado': 'despachado',
  'Pedido cancelado': 'cancelado',
  'Dueño actualizado': 'duenoActualizado',
  'Cantidades modificadas': 'cantidadesModificadas',
  'Pedido editado': 'pedidoEditado',
  'Fecha límite modificada': 'fechaLimiteModificada',
  'Condiciones actualizadas': 'condicionesActualizadas',
  'Número de pedido actualizado': 'numeroPedidoActualizado',
  'Nombre actualizado': 'nombreActualizado',
}

export function detalleLabel(t, evento) {
  const texto = evento?.detalle
  if (!texto) return texto || ''
  const clave = DETALLE_LITERAL_A_CLAVE[texto]
  return clave ? t(`eventosDetalle.${clave}`) : texto
}

const PATRONES_SECUNDARIO = [
  { re: /^(\d+) modelos? capturados$/, clave: 'modelosCapturados', grupos: ['count'] },
  { re: /^(\d+) de (\d+) artículos surtidos$/, clave: 'articulosSurtidos', grupos: ['surt', 'req'] },
  { re: /^De (\d+) a (\d+) piezas$/, clave: 'deAaBPiezas', grupos: ['antes', 'despues'] },
  { re: /^Cantidades: de (\d+) a (\d+)$/, clave: 'cantidadesDeAaB', grupos: ['antes', 'despues'] },
]

export function detalleSecundarioLabel(t, evento) {
  const texto = evento?.detalleSecundario
  if (!texto) return texto

  for (const { re, clave, grupos } of PATRONES_SECUNDARIO) {
    const m = texto.match(re)
    if (m) {
      const params = {}
      grupos.forEach((g, i) => { params[g] = g === 'count' ? Number(m[i + 1]) : m[i + 1] })
      return t(`eventosDetalle.${clave}`, params)
    }
  }

  // Varios cambios de una edición unidos con " · " (cada pieza es uno de los
  // literales fijos de arriba, ej. "Condiciones actualizadas · Nombre actualizado").
  if (texto.includes(' · ')) {
    const partes = texto.split(' · ')
    const traducidas = partes.map((p) => {
      const clave = DETALLE_LITERAL_A_CLAVE[p.trim()]
      return clave ? t(`eventosDetalle.${clave}`) : p
    })
    if (traducidas.some((p, i) => p !== partes[i])) return traducidas.join(' · ')
  }

  return texto.replace(/— sin dueño —/g, t('eventosDetalle.sinDueno'))
}
