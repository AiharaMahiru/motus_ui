export type AppLocale = 'zh-CN' | 'en-US'

const DEFAULT_LOCALE: AppLocale = 'zh-CN'

let currentLocale: AppLocale = DEFAULT_LOCALE

export function getRuntimeLocale() {
  return currentLocale
}

export function setRuntimeLocale(locale: AppLocale) {
  currentLocale = locale
}

export function isZhLocale(locale: AppLocale = currentLocale) {
  return locale === 'zh-CN'
}

export function pickLocaleText(zh: string, en: string, locale: AppLocale = currentLocale) {
  return isZhLocale(locale) ? zh : en
}

export function normalizeLocale(input?: string | null): AppLocale {
  if (!input) {
    return DEFAULT_LOCALE
  }
  const normalized = input.toLowerCase()
  if (normalized.startsWith('en')) {
    return 'en-US'
  }
  return 'zh-CN'
}

export const APP_LOCALE_OPTIONS = [
  { labelEn: 'Chinese', labelZh: '中文', value: 'zh-CN' },
  { labelEn: 'English', labelZh: '英文', value: 'en-US' },
] as const satisfies ReadonlyArray<{
  labelEn: string
  labelZh: string
  value: AppLocale
}>
