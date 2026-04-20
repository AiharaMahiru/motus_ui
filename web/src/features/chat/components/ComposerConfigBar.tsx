import {
  Brain,
  CheckCircle2,
  ChevronDown,
  Cpu,
  ListChecks,
  LoaderCircle,
  TimerReset,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { useI18n } from '../../../shared/i18n/I18nContext'
import {
  QUICK_MAX_STEPS_OPTIONS,
  QUICK_PROVIDER_OPTIONS,
  QUICK_MODEL_OPTIONS,
  QUICK_TIMEOUT_OPTIONS,
  type SessionDraft,
} from '../../sessions/constants'


type ComposerConfigBarProps = {
  compact?: boolean
  minimal?: boolean
  config: SessionDraft
  saveState: 'idle' | 'saving' | 'saved' | 'error'
  disabled?: boolean
  visibleFields?: readonly ComposerConfigField[]
  showSaveState?: boolean
  onConfigChange: (patch: Partial<SessionDraft>) => void
  onOpenAdvancedConfig: () => void
}

type ComposerConfigField = 'provider' | 'model' | 'thinking' | 'maxSteps' | 'timeout'

type ComposerSelectProps = {
  icon?: ReactNode
  label: string
  value: string
  options: readonly string[]
  disabled: boolean
  wide?: boolean
  compact?: boolean
  formatOption?: (value: string) => string
  onChange: (value: string) => void
}


function mergeOptions(base: readonly string[], current: string) {
  const value = current.trim()
  return value && !base.includes(value) ? [value, ...base] : [...base]
}

function ComposerSelect({
  icon,
  label,
  value,
  options,
  disabled,
  wide = false,
  compact = false,
  formatOption = (option) => option,
  onChange,
}: ComposerSelectProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) {
      return undefined
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
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
    <div
      className={open ? 'composer-option-shell composer-option-shell-open' : 'composer-option-shell'}
      ref={rootRef}
    >
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={label}
        className={
          compact
            ? 'composer-option-tab composer-option-tab-compact'
            : wide
              ? 'composer-option-tab composer-option-tab-wide'
              : 'composer-option-tab'
        }
        disabled={disabled}
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        {icon && !compact ? <span className="composer-option-icon">{icon}</span> : null}
        <span className="composer-option-copy">
          <span className="composer-option-label">{label}</span>
          <span className="composer-option-value">{formatOption(value)}</span>
        </span>
        <ChevronDown className={open ? 'composer-option-chevron composer-option-chevron-open' : 'composer-option-chevron'} size={13} />
      </button>

      {open ? (
        <div className="composer-option-menu" role="listbox">
          {options.map((option) => {
            const selected = option === value
            return (
              <button
                aria-selected={selected}
                className={selected ? 'composer-option-item composer-option-item-selected' : 'composer-option-item'}
                key={option}
                role="option"
                type="button"
                onClick={() => {
                  onChange(option)
                  setOpen(false)
                }}
              >
                <span className="composer-option-item-copy">
                  <span className="composer-option-item-title">{formatOption(option)}</span>
                  {selected ? <span className="composer-option-item-meta">当前生效</span> : null}
                </span>
                {selected ? <CheckCircle2 className="composer-option-item-check" size={13} /> : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}


export function ComposerConfigBar({
  compact = false,
  minimal = false,
  config,
  saveState,
  disabled = false,
  visibleFields = ['provider', 'model', 'thinking', 'maxSteps', 'timeout'],
  showSaveState = true,
  onConfigChange,
  onOpenAdvancedConfig: _onOpenAdvancedConfig,
}: ComposerConfigBarProps) {
  const { text } = useI18n()
  const modelOptions = mergeOptions(QUICK_MODEL_OPTIONS, config.modelName)
  const providerOptions = mergeOptions(QUICK_PROVIDER_OPTIONS, config.provider)
  const stepOptions = mergeOptions(QUICK_MAX_STEPS_OPTIONS, config.maxSteps)
  const timeoutOptions = mergeOptions(QUICK_TIMEOUT_OPTIONS, config.timeoutSeconds || '600')
  const thinkingValue = config.thinkingEnabled ? config.thinkingEffort : 'off'
  const thinkingOptions = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh'] as const
  const saveLabel =
    saveState === 'saving'
      ? text('配置保存中', 'Saving config')
      : saveState === 'saved'
        ? text('配置已同步', 'Config saved')
        : saveState === 'error'
          ? text('配置保存失败', 'Config failed')
          : ''

  if (minimal) {
    return (
      <div className="composer-config-bar-minimal">
        {visibleFields.includes('provider') ? (
          <div aria-label={`Provider ${config.provider}`} className="composer-minimal-chip">
            <span className="composer-minimal-chip-value">{config.provider}</span>
          </div>
        ) : null}

        {visibleFields.includes('model') ? (
          <div aria-label={`${text('模型', 'Model')} ${config.modelName}`} className="composer-minimal-chip">
            <span className="composer-minimal-chip-value">{config.modelName}</span>
          </div>
        ) : null}

        {visibleFields.includes('thinking') ? (
          <div
            aria-label={`${text('思考', 'Reasoning')} ${config.thinkingEnabled ? config.thinkingEffort : 'off'}`}
            className="composer-minimal-chip"
          >
            <span className="composer-minimal-chip-value">
              {config.thinkingEnabled ? config.thinkingEffort : 'off'}
            </span>
          </div>
        ) : null}

        {showSaveState && saveState !== 'idle' ? (
          <div className={`composer-status-pill composer-status-pill-${saveState}`}>
            {saveState === 'saving' ? <LoaderCircle className="animate-spin" size={12} /> : <CheckCircle2 size={12} />}
            <span>{saveLabel}</span>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className={compact ? 'composer-config-bar composer-config-bar-compact' : 'composer-config-bar'}>
      {visibleFields.includes('provider') ? (
        <ComposerSelect
          compact={compact}
          disabled={disabled}
          label="Provider"
          options={providerOptions}
          value={config.provider}
          onChange={(value) => onConfigChange({ provider: value as SessionDraft['provider'] })}
        />
      ) : null}

      {visibleFields.includes('model') ? (
        <ComposerSelect
          compact={compact}
          disabled={disabled}
          icon={<Cpu size={13} />}
          label={text('模型', 'Model')}
          options={modelOptions}
          value={config.modelName}
          wide
          onChange={(value) => onConfigChange({ modelName: value })}
        />
      ) : null}

      {visibleFields.includes('thinking') ? (
        <ComposerSelect
          compact={compact}
          disabled={disabled}
          icon={<Brain size={13} />}
          label={text('思考', 'Reasoning')}
          options={thinkingOptions}
          value={thinkingValue}
          onChange={(value) => {
            if (value === 'off') {
              onConfigChange({ thinkingEnabled: false })
              return
            }
            onConfigChange({
              thinkingEnabled: true,
              thinkingEffort: value as SessionDraft['thinkingEffort'],
            })
          }}
        />
      ) : null}

      {visibleFields.includes('maxSteps') ? (
        <ComposerSelect
          compact={compact}
          disabled={disabled}
          icon={<ListChecks size={13} />}
          label={text('步骤', 'Steps')}
          options={stepOptions}
          value={config.maxSteps}
          onChange={(value) => onConfigChange({ maxSteps: value })}
        />
      ) : null}

      {visibleFields.includes('timeout') ? (
        <ComposerSelect
          compact={compact}
          disabled={disabled}
          formatOption={(value) => `${value}s`}
          icon={<TimerReset size={13} />}
          label={text('超时', 'Timeout')}
          options={timeoutOptions}
          value={config.timeoutSeconds || '600'}
          onChange={(value) => onConfigChange({ timeoutSeconds: value })}
        />
      ) : null}

      {showSaveState && saveState !== 'idle' ? (
        <div className={`composer-status-pill composer-status-pill-${saveState}`}>
          {saveState === 'saving' ? <LoaderCircle className="animate-spin" size={12} /> : <CheckCircle2 size={12} />}
          <span>{saveLabel}</span>
        </div>
      ) : null}
    </div>
  )
}
