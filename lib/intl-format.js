// Mapeo entre el código de idioma de i18next (es-MX/en/zh-CN, usado en toda
// la app) y el locale de Intl correspondiente, para que fechas y números se
// formateen en el idioma activo en vez de quedar fijos en es-MX.
export const INTL_LOCALE = { 'es-MX': 'es-MX', en: 'en-US', 'zh-CN': 'zh-CN' }

export function localeDe(lang) {
  return INTL_LOCALE[lang] || 'es-MX'
}

export function formatearNumero(n, lang) {
  return Number(n).toLocaleString(localeDe(lang))
}
