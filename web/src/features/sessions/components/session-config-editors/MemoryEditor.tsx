import { HardDrive } from 'lucide-react'

import { useI18n } from '../../../../shared/i18n/I18nContext'
import type { MemoryEditorProps } from './shared'

export function MemoryEditor({
  disabled = false,
  value,
  onChange,
}: MemoryEditorProps) {
  const { text } = useI18n()
  return (
    <div className="inspector-form-stack">
      <div className="session-segmented">
        {(['basic', 'compact'] as const).map((type) => (
          <button
            className={
              value.type === type
                ? 'session-segmented-button session-segmented-button-active'
                : 'session-segmented-button'
            }
            disabled={disabled}
            key={type}
            type="button"
            onClick={() => onChange({ ...value, type })}
          >
            <HardDrive size={14} />
            <span>{type === 'basic' ? text('基础', 'Basic') : text('压缩', 'Compact')}</span>
          </button>
        ))}
      </div>

      {value.type === 'compact' ? (
        <div className="inspector-grid-2">
          <label className="inspector-field">
            <span className="inspector-field-label">{text('压缩模型', 'Compaction model')}</span>
            <input
              className="inspector-input"
              disabled={disabled}
              value={value.compact_model_name ?? ''}
              onChange={(event) => onChange({ ...value, compact_model_name: event.target.value || null })}
            />
          </label>

          <label className="inspector-field">
            <span className="inspector-field-label">{text('安全比例', 'Safety ratio')}</span>
            <input
              className="inspector-input"
              disabled={disabled}
              max={1}
              min={0}
              step="0.05"
              type="number"
              value={value.safety_ratio ?? 0.5}
              onChange={(event) =>
                onChange({
                  ...value,
                  safety_ratio: event.target.value ? Number(event.target.value) : null,
                })
              }
            />
          </label>

          <label className="inspector-field">
            <span className="inspector-field-label">{text('压缩阈值', 'Compaction threshold')}</span>
            <input
              className="inspector-input"
              disabled={disabled}
              min={1}
              type="number"
              value={value.token_threshold ?? 256000}
              onChange={(event) =>
                onChange({
                  ...value,
                  token_threshold: event.target.value ? Number(event.target.value) : null,
                })
              }
            />
          </label>
        </div>
      ) : null}

      <div className="inspector-grid-2">
        <label className="inspector-field">
          <span className="inspector-field-label">{text('工具结果上限', 'Tool result token cap')}</span>
          <input
            className="inspector-input"
            disabled={disabled}
            min={1}
            type="number"
            value={value.max_tool_result_tokens}
            onChange={(event) =>
              onChange({
                ...value,
                max_tool_result_tokens: event.target.value
                  ? Number(event.target.value)
                  : value.max_tool_result_tokens,
              })
            }
          />
        </label>
      </div>

      <label className="inspector-field">
        <span className="inspector-field-label">{text('截断后缀', 'Truncation suffix')}</span>
        <textarea
          className="inspector-textarea"
          disabled={disabled}
          value={value.tool_result_truncation_suffix}
          onChange={(event) => onChange({ ...value, tool_result_truncation_suffix: event.target.value })}
        />
      </label>
    </div>
  )
}
