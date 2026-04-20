import { Plus, Trash2 } from 'lucide-react'

import type { ResponseFieldConfig } from '../../../../shared/api/contracts'
import { useI18n } from '../../../../shared/i18n/I18nContext'
import type { ResponseFormatEditorProps } from './shared'
import { updateItemAtIndex } from './shared'

const EDITABLE_RESPONSE_FIELD_TYPES = [
  'string',
  'integer',
  'number',
  'boolean',
  'string[]',
  'integer[]',
  'number[]',
  'boolean[]',
] as const

function resolveEditableFieldType(field: ResponseFieldConfig) {
  return typeof field.type === 'string' && EDITABLE_RESPONSE_FIELD_TYPES.includes(field.type as (typeof EDITABLE_RESPONSE_FIELD_TYPES)[number])
    ? field.type
    : 'string'
}

export function ResponseFormatEditor({
  disabled = false,
  hidden = false,
  value,
  onChange,
}: ResponseFormatEditorProps) {
  const { text } = useI18n()
  if (hidden) {
    return null
  }

  const fields = value.fields ?? []
  const responseFieldTypeLabels: Record<string, string> = {
    string: text('文本', 'Text'),
    integer: text('整数', 'Integer'),
    number: text('数字', 'Number'),
    boolean: text('布尔值', 'Boolean'),
    'string[]': text('文本列表', 'Text list'),
    'integer[]': text('整数列表', 'Integer list'),
    'number[]': text('数字列表', 'Number list'),
    'boolean[]': text('布尔值列表', 'Boolean list'),
    object: text('对象', 'Object'),
    array: text('数组', 'Array'),
  }

  return (
    <div className="inspector-form-stack">
      <div className="inspector-grid-2">
        <label className="inspector-field">
          <span className="inspector-field-label">{text('格式名', 'Format name')}</span>
          <input
            className="inspector-input"
            disabled={disabled}
            value={value.name}
            onChange={(event) => onChange({ ...value, name: event.target.value })}
          />
        </label>

        <label className="inspector-field">
          <span className="inspector-field-label">{text('说明', 'Description')}</span>
          <input
            className="inspector-input"
            disabled={disabled}
            value={value.description ?? ''}
            onChange={(event) => onChange({ ...value, description: event.target.value })}
          />
        </label>
      </div>

      <div className="session-editor-section-head">
        <span className="inspector-field-label">{text('字段列表', 'Fields')}</span>
        <button
          className="inspector-action-secondary"
          disabled={disabled}
          type="button"
          onClick={() =>
            onChange({
              ...value,
              fields: [
                ...fields,
                {
                  name: '',
                  type: 'string',
                  description: '',
                  required: true,
                } satisfies ResponseFieldConfig,
              ],
            })
          }
        >
          <Plus size={14} />
          <span>{text('新增字段', 'Add field')}</span>
        </button>
      </div>

      <div className="session-editor-stack">
        {fields.length ? (
          fields.map((field, index) => (
            <article className="session-editor-card" key={`${field.name}:${index}`}>
              <div className="session-editor-card-head">
                <strong>{text('字段', 'Field')} {index + 1}</strong>
                <button
                  className="inspector-action-secondary"
                  disabled={disabled}
                  type="button"
                  onClick={() =>
                    onChange({
                      ...value,
                      fields: fields.filter((_, fieldIndex) => fieldIndex !== index),
                    })
                  }
                >
                  <Trash2 size={14} />
                  <span>{text('删除', 'Delete')}</span>
                </button>
              </div>

              <div className="inspector-grid-2">
                <label className="inspector-field">
                  <span className="inspector-field-label">{text('字段名', 'Field name')}</span>
                  <input
                    className="inspector-input"
                    disabled={disabled}
                    value={field.name}
                    onChange={(event) =>
                      onChange({
                        ...value,
                        fields: updateItemAtIndex(fields, index, (item) => ({ ...item, name: event.target.value })),
                      })
                    }
                  />
                </label>

                <label className="inspector-field">
                  <span className="inspector-field-label">{text('类型', 'Type')}</span>
                  <select
                    className="inspector-select"
                    disabled={disabled}
                    value={resolveEditableFieldType(field)}
                    onChange={(event) =>
                      onChange({
                        ...value,
                        fields: updateItemAtIndex(fields, index, (item) => ({
                          ...item,
                          type: event.target.value as Exclude<ResponseFieldConfig['type'], null | undefined>,
                        })),
                      })
                    }
                  >
                    {EDITABLE_RESPONSE_FIELD_TYPES.map((value) => (
                      <option key={value} value={value}>
                        {responseFieldTypeLabels[value]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="inspector-field">
                <span className="inspector-field-label">{text('说明', 'Description')}</span>
                <input
                  className="inspector-input"
                  disabled={disabled}
                  value={field.description ?? ''}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      fields: updateItemAtIndex(fields, index, (item) => ({
                        ...item,
                        description: event.target.value,
                      })),
                    })
                  }
                />
              </label>

              <label className="session-toggle-item">
                <input
                  checked={field.required}
                  disabled={disabled}
                  type="checkbox"
                  onChange={(event) =>
                    onChange({
                      ...value,
                      fields: updateItemAtIndex(fields, index, (item) => ({
                        ...item,
                        required: event.target.checked,
                      })),
                    })
                  }
                />
                <span>{text('必填', 'Required')}</span>
              </label>
            </article>
          ))
        ) : null}
      </div>
    </div>
  )
}
