export const CHANGELOG_CATEGORIAS = ['feature', 'improvement', 'bugfix', 'security']
export const CHANGELOG_PRIORIDADES = ['critical', 'high', 'normal', 'low']

export const CATEGORIA_LABEL = {
  feature: 'Nueva función',
  improvement: 'Mejora',
  bugfix: 'Corrección',
  security: 'Seguridad',
}

export const PRIORIDAD_LABEL = {
  critical: 'Crítica',
  high: 'Alta',
  normal: 'Normal',
  low: 'Baja',
}

export function versionValida(version) {
  return typeof version === 'string' && /^\d+\.\d+\.\d+$/.test(version.trim())
}
