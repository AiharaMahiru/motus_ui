import { useState } from 'react'

import { Plus, Trash2 } from 'lucide-react'

import { useI18n } from '../../../../shared/i18n/I18nContext'
import type { StringListEditorProps } from './shared'

export function StringListEditor({
  addButtonTestId,
  disabled = false,
  emptyLabel = '',
  inputTestId,
  label,
  values,
  onChange,
  placeholder,
}: StringListEditorProps) {
  const { text } = useI18n()
  const [draftValue, setDraftValue] = useState('')
  const resolvedPlaceholder = placeholder || text('输入后回车或点击添加', 'Press Enter or click Add')

  function appendValue() {
    const nextValue = draftValue.trim()
    if (!nextValue || values.includes(nextValue)) {
      return
    }
    onChange([...values, nextValue])
    setDraftValue('')
  }

  return (
    <div className="inspector-field">
      <span className="inspector-field-label">{label}</span>
      <div className="session-chip-editor">
        {values.length ? (
          <div className="session-chip-list">
            {values.map((item) => (
              <span className="session-chip-item" key={item}>
                <span>{item}</span>
                <button
                  aria-label={`${text('移除', 'Remove')} ${item}`}
                  className="session-chip-remove"
                  disabled={disabled}
                  type="button"
                  onClick={() => onChange(values.filter((value) => value !== item))}
                >
                  <Trash2 size={12} />
                </button>
              </span>
            ))}
          </div>
        ) : emptyLabel ? (
          <div className="inspector-alert inspector-alert-muted">{emptyLabel}</div>
        ) : null}

        <div className="session-inline-actions">
          <input
            className="inspector-input"
            data-testid={inputTestId}
            disabled={disabled}
            placeholder={resolvedPlaceholder}
            value={draftValue}
            onChange={(event) => setDraftValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                appendValue()
              }
            }}
          />
          <button
            className="inspector-action-secondary"
            data-testid={addButtonTestId}
            disabled={disabled || !draftValue.trim()}
            type="button"
            onClick={appendValue}
          >
            <Plus size={14} />
            <span>{text('添加', 'Add')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
