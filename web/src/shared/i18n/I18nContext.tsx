import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'

import {
  APP_LOCALE_OPTIONS,
  getRuntimeLocale,
  normalizeLocale,
  pickLocaleText,
  setRuntimeLocale,
  type AppLocale,
} from './runtimeLocale'

const STORAGE_KEY = 'motus-agent:web:locale'

type I18nContextValue = {
  locale: AppLocale
  setLocale: (locale: AppLocale) => void
  text: (zh: string, en: string) => string
  localeOptions: typeof APP_LOCALE_OPTIONS
}

const defaultLocale = getRuntimeLocale()

const I18nContext = createContext<I18nContextValue>({
  locale: defaultLocale,
  setLocale: () => undefined,
  text: (zh, en) => pickLocaleText(zh, en, defaultLocale),
  localeOptions: APP_LOCALE_OPTIONS,
})

function readInitialLocale(): AppLocale {
  if (typeof window === 'undefined') {
    return defaultLocale
  }

  const storedLocale = window.localStorage.getItem(STORAGE_KEY)
  if (storedLocale) {
    return normalizeLocale(storedLocale)
  }

  return normalizeLocale(window.navigator.language)
}

export function I18nProvider({ children }: PropsWithChildren) {
  const [locale, setLocaleState] = useState<AppLocale>(readInitialLocale)

  useEffect(() => {
    setRuntimeLocale(locale)
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, locale)
    }
  }, [locale])

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale: setLocaleState,
      text: (zh, en) => pickLocaleText(zh, en, locale),
      localeOptions: APP_LOCALE_OPTIONS,
    }),
    [locale],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  return useContext(I18nContext)
}
