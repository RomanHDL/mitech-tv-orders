export const CHANGELOG_CATEGORIAS = ['feature', 'improvement', 'bugfix', 'security']
export const CHANGELOG_PRIORIDADES = ['critical', 'high', 'normal', 'low']

// `t` viene del hook useTranslation (cliente) o de getServerT() (servidor) —
// mismo patrón que estadoLabel/unidadLabel de lib/catalogos.js.
export function categoriaLabel(t, categoria) {
  return t(`changelog.categoria.${categoria}`)
}

export function prioridadLabel(t, prioridad) {
  return t(`changelog.prioridad.${prioridad}`)
}

export function versionValida(version) {
  return typeof version === 'string' && /^\d+\.\d+\.\d+$/.test(version.trim())
}
