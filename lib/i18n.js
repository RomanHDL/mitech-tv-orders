'use client'

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import en from '../public/locales/en/common.json'
import esMX from '../public/locales/es-MX/common.json'
import zhCN from '../public/locales/zh-CN/common.json'

// Igual patrón que el MI Stack (client/src/i18n): 3 idiomas, un solo
// namespace "common", persistido en localStorage bajo la misma clave
// (mitech_idioma) para que la preferencia sea consistente si alguna vez se
// comparte sesión de navegador entre ambas versiones de la app.
if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        en: { common: en },
        'es-MX': { common: esMX },
        'zh-CN': { common: zhCN },
      },
      fallbackLng: 'es-MX',
      defaultNS: 'common',
      detection: {
        order: ['localStorage', 'navigator'],
        lookupLocalStorage: 'mitech_idioma',
        caches: ['localStorage'],
      },
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    })
}

export default i18n
