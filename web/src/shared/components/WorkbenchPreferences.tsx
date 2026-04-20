import { Check, ChevronDown, Languages, Palette } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { useI18n } from '../i18n/I18nContext'
import { useTheme } from '../theme/ThemeContext'

type PreferenceMenuProps<TValue extends string> = {
  currentLabel: string
  icon: typeof Palette
  items: ReadonlyArray<{
    label: string
    value: TValue
  }>
  title: string
  value: TValue
  onChange: (value: TValue) => void
}

function PreferenceMenu<TValue extends string>({
  currentLabel,
  icon: Icon,
  items,
  title,
  value,
  onChange,
}: PreferenceMenuProps<TValue>) {
  const [open, setOpen] = useState(false)
  const shellRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) {
      return undefined
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!shellRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div className="topbar-pref-shell" ref={shellRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={title}
        className="topbar-pref-button"
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <Icon size={14} />
        <span className="topbar-pref-label">{currentLabel}</span>
        <ChevronDown className={open ? 'topbar-pref-chevron topbar-pref-chevron-open' : 'topbar-pref-chevron'} size={13} />
      </button>

      {open ? (
        <div className="topbar-pref-menu" role="menu">
          {items.map((item) => {
            const selected = item.value === value
            return (
              <button
                className={selected ? 'topbar-pref-item topbar-pref-item-active' : 'topbar-pref-item'}
                key={item.value}
                role="menuitemradio"
                type="button"
                onClick={() => {
                  onChange(item.value)
                  setOpen(false)
                }}
              >
                <span>{item.label}</span>
                {selected ? <Check size={13} /> : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export function WorkbenchPreferences() {
  const { locale, localeOptions, setLocale, text } = useI18n()
  const { theme, themeOptions, setTheme } = useTheme()

  const localeLabel = useMemo(
    () => localeOptions.find((item) => item.value === locale),
    [locale, localeOptions],
  )
  const themeLabel = useMemo(
    () => themeOptions.find((item) => item.value === theme),
    [theme, themeOptions],
  )

  return (
    <>
      <PreferenceMenu
        currentLabel={themeLabel ? text(themeLabel.labelZh, themeLabel.labelEn) : theme}
        icon={Palette}
        items={themeOptions.map((item) => ({
          label: text(item.labelZh, item.labelEn),
          value: item.value,
        }))}
        title={text('主题', 'Theme')}
        value={theme}
        onChange={setTheme}
      />
      <PreferenceMenu
        currentLabel={localeLabel ? text(localeLabel.labelZh, localeLabel.labelEn) : locale}
        icon={Languages}
        items={localeOptions.map((item) => ({
          label: text(item.labelZh, item.labelEn),
          value: item.value,
        }))}
        title={text('语言', 'Language')}
        value={locale}
        onChange={setLocale}
      />
    </>
  )
}
