// Bootstrap i18n (HARD RULE del stack: en / es-MX / zh-CN). La extracción
// completa del copy en español a claves ocurre en la Fase 8; este bootstrap
// deja la infraestructura lista desde el scaffold para que las páginas ya
// puedan usar `useTranslation()` a medida que se van portando.
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import HttpBackend from 'i18next-http-backend'
import LanguageDetector from 'i18next-browser-languagedetector'

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: ['en', 'es-MX', 'zh-CN'],
    ns: ['common'],
    defaultNS: 'common',
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'mitech_idioma',
    },
    interpolation: { escapeValue: false },
  })

export default i18n
