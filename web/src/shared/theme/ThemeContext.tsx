import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'

export type AppTheme = 'light' | 'dark' | 'black'

const STORAGE_KEY = 'motus-agent:web:theme'

export const APP_THEME_OPTIONS = [
  { labelEn: 'Light', labelZh: '浅色', value: 'light' },
  { labelEn: 'Dark', labelZh: '深色', value: 'dark' },
  { labelEn: 'Black', labelZh: '黑色', value: 'black' },
] as const satisfies ReadonlyArray<{
  labelEn: string
  labelZh: string
  value: AppTheme
}>

type ThemeContextValue = {
  theme: AppTheme
  setTheme: (theme: AppTheme) => void
  themeOptions: typeof APP_THEME_OPTIONS
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  setTheme: () => undefined,
  themeOptions: APP_THEME_OPTIONS,
})

function normalizeTheme(input?: string | null): AppTheme {
  if (input === 'dark' || input === 'black') {
    return input
  }
  return 'light'
}

function readInitialTheme(): AppTheme {
  if (typeof window === 'undefined') {
    return 'light'
  }

  const storedTheme = window.localStorage.getItem(STORAGE_KEY)
  if (storedTheme) {
    return normalizeTheme(storedTheme)
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const [theme, setThemeState] = useState<AppTheme>(readInitialTheme)

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = theme
      document.documentElement.style.colorScheme = theme === 'light' ? 'light' : 'dark'
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, theme)
    }
  }, [theme])

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme: setThemeState,
      themeOptions: APP_THEME_OPTIONS,
    }),
    [theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
