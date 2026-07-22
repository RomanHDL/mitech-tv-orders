// Traducción para Server Components (imprimir, exportar-pdf, changelog, etc.)
// que no pueden usar el hook useTranslation() de react-i18next. No depende de
// la librería i18next en el servidor: simplemente lee el idioma desde la
// cookie mitech_idioma (sincronizada por LanguageSwitcher) y busca las claves
// en los mismos JSON que usa el cliente, con la misma interpolación {{var}}.
import { cookies } from 'next/headers'
import en from '@/public/locales/en/common.json'
import esMX from '@/public/locales/es-MX/common.json'
import zhCN from '@/public/locales/zh-CN/common.json'

const RECURSOS = { en, 'es-MX': esMX, 'zh-CN': zhCN }
const IDIOMA_DEFAULT = 'es-MX'

function buscarClave(dict, clave) {
  return clave.split('.').reduce((acc, parte) => (acc && acc[parte] !== undefined ? acc[parte] : undefined), dict)
}

export async function getServerLang() {
  const store = await cookies()
  const lang = store.get('mitech_idioma')?.value
  return RECURSOS[lang] ? lang : IDIOMA_DEFAULT
}

// t(clave, params?) — mismo comportamiento que t() del cliente para los usos
// de esta app: interpolación {{var}} y sufijo _one/_other si params.count
// existe (subset simplificado del pluralizado de i18next, suficiente para
// las claves que usamos aquí).
function crearT(dict) {
  const fallback = RECURSOS[IDIOMA_DEFAULT]
  return function t(clave, params) {
    let claveFinal = clave
    if (params && typeof params.count === 'number') {
      claveFinal = `${clave}_${params.count === 1 ? 'one' : 'other'}`
      if (buscarClave(dict, claveFinal) === undefined && buscarClave(fallback, claveFinal) === undefined) {
        claveFinal = clave
      }
    }
    let str = buscarClave(dict, claveFinal)
    if (str === undefined) str = buscarClave(fallback, claveFinal)
    if (str === undefined) return clave
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.replaceAll(`{{${k}}}`, v)
      }
    }
    return str
  }
}

export async function getServerT() {
  const lang = await getServerLang()
  return crearT(RECURSOS[lang] || RECURSOS[IDIOMA_DEFAULT])
}
