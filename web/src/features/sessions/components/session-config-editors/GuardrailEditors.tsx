import { Plus, Trash2 } from 'lucide-react'

import type { GuardrailRule } from '../../../../shared/api/contracts'
import { useI18n } from '../../../../shared/i18n/I18nContext'
import {
  createDefaultGuardrailRule,
  createDefaultToolGuardrail,
} from '../../constants'
import { StringListEditor } from './StringListEditor'
import type { GuardrailListEditorProps, ToolGuardrailListEditorProps } from './shared'
import { updateItemAtIndex } from './shared'

function GuardrailRuleCard({
  disabled = false,
  label,
  rule,
  onChange,
  onRemove,
}: {
  disabled?: boolean
  label: string
  rule: GuardrailRule
  onChange: (nextRule: GuardrailRule) => void
  onRemove: () => void
}) {
  const { text } = useI18n()
  const guardrailKindLabels: Record<GuardrailRule['kind'], string> = {
    deny_regex: text('禁止匹配', 'Deny regex'),
    require_regex: text('必须匹配', 'Require regex'),
    rewrite_regex: text('重写匹配', 'Rewrite regex'),
    max_length: text('最大长度', 'Max length'),
  }
  return (
    <article className="session-editor-card">
      <div className="session-editor-card-head">
        <strong>{label}</strong>
        <button
          className="inspector-action-secondary"
          disabled={disabled}
          type="button"
          onClick={onRemove}
        >
          <Trash2 size={14} />
          <span>{text('删除', 'Delete')}</span>
        </button>
      </div>

      <div className="inspector-grid-2">
        <label className="inspector-field">
          <span className="inspector-field-label">{text('规则类型', 'Rule type')}</span>
          <select
            className="inspector-select"
            disabled={disabled}
            value={rule.kind}
            onChange={(event) =>
              onChange({
                ...rule,
                kind: event.target.value as GuardrailRule['kind'],
                max_length: event.target.value === 'max_length' ? rule.max_length ?? 4096 : null,
              })
            }
          >
            {Object.entries(guardrailKindLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="inspector-field">
          <span className="inspector-field-label">{text('提示消息', 'Message')}</span>
          <input
            className="inspector-input"
            disabled={disabled}
            value={rule.message ?? ''}
            onChange={(event) => onChange({ ...rule, message: event.target.value })}
          />
        </label>
      </div>

      {rule.kind === 'max_length' ? (
        <label className="inspector-field">
          <span className="inspector-field-label">{text('最大长度', 'Max length')}</span>
          <input
            className="inspector-input"
            disabled={disabled}
            min={1}
            type="number"
            value={rule.max_length ?? 4096}
            onChange={(event) =>
              onChange({
                ...rule,
                max_length: event.target.value ? Number(event.target.value) : null,
              })
            }
          />
        </label>
      ) : (
        <>
          <label className="inspector-field">
            <span className="inspector-field-label">{text('匹配表达式', 'Pattern')}</span>
            <input
              className="inspector-input inspector-input-mono"
              disabled={disabled}
              value={rule.pattern ?? ''}
              onChange={(event) => onChange({ ...rule, pattern: event.target.value })}
            />
          </label>

          {rule.kind === 'rewrite_regex' ? (
            <label className="inspector-field">
              <span className="inspector-field-label">{text('替换内容', 'Replacement')}</span>
              <input
                className="inspector-input inspector-input-mono"
                disabled={disabled}
                value={rule.replacement ?? ''}
                onChange={(event) => onChange({ ...rule, replacement: event.target.value })}
              />
            </label>
          ) : null}
        </>
      )}

      {rule.kind !== 'max_length' ? (
        <div className="session-toggle-grid">
          <label className="session-toggle-item">
            <input
              checked={rule.ignore_case ?? false}
              disabled={disabled}
              type="checkbox"
              onChange={(event) => onChange({ ...rule, ignore_case: event.target.checked })}
            />
            <span>{text('忽略大小写', 'Ignore case')}</span>
          </label>
          <label className="session-toggle-item">
            <input
              checked={rule.multiline ?? false}
              disabled={disabled}
              type="checkbox"
              onChange={(event) => onChange({ ...rule, multiline: event.target.checked })}
            />
            <span>{text('多行匹配', 'Multiline')}</span>
          </label>
          <label className="session-toggle-item">
            <input
              checked={rule.dotall ?? false}
              disabled={disabled}
              type="checkbox"
              onChange={(event) => onChange({ ...rule, dotall: event.target.checked })}
            />
            <span>{text('点号匹配换行', 'Dot matches newline')}</span>
          </label>
        </div>
      ) : null}
    </article>
  )
}

export function GuardrailListEditor({
  disabled = false,
  label,
  rules,
  onChange,
}: GuardrailListEditorProps) {
  const { text } = useI18n()
  return (
    <div className="inspector-field">
      <div className="session-editor-section-head">
        <span className="inspector-field-label">{label}</span>
        <button
          className="inspector-action-secondary"
          disabled={disabled}
          type="button"
          onClick={() => onChange([...rules, createDefaultGuardrailRule()])}
        >
          <Plus size={14} />
          <span>{text('新增规则', 'Add rule')}</span>
        </button>
      </div>

      <div className="session-editor-stack">
        {rules.length ? (
          rules.map((rule, index) => (
            <GuardrailRuleCard
              disabled={disabled}
              key={`${rule.kind}:${index}`}
              label={`${text('规则', 'Rule')} ${index + 1}`}
              rule={rule}
              onChange={(nextRule) => onChange(updateItemAtIndex(rules, index, () => nextRule))}
              onRemove={() => onChange(rules.filter((_, itemIndex) => itemIndex !== index))}
            />
          ))
        ) : null}
      </div>
    </div>
  )
}

export function ToolGuardrailListEditor({
  disabled = false,
  rules,
  onChange,
}: ToolGuardrailListEditorProps) {
  const { text } = useI18n()
  return (
    <div className="inspector-field">
      <div className="session-editor-section-head">
        <span className="inspector-field-label">{text('工具规则', 'Tool rules')}</span>
        <button
          className="inspector-action-secondary"
          disabled={disabled}
          type="button"
          onClick={() => onChange([...rules, createDefaultToolGuardrail()])}
        >
          <Plus size={14} />
          <span>{text('新增工具规则', 'Add tool rule')}</span>
        </button>
      </div>

      <div className="session-editor-stack">
        {rules.length ? (
          rules.map((rule, index) => (
            <article className="session-editor-card" key={`${rule.tool_name}:${index}`}>
              <div className="session-editor-card-head">
                <strong>{text('工具规则', 'Tool rule')} {index + 1}</strong>
                <button
                  className="inspector-action-secondary"
                  disabled={disabled}
                  type="button"
                  onClick={() => onChange(rules.filter((_, itemIndex) => itemIndex !== index))}
                >
                  <Trash2 size={14} />
                  <span>{text('删除', 'Delete')}</span>
                </button>
              </div>

              <label className="inspector-field">
                <span className="inspector-field-label">{text('工具名', 'Tool name')}</span>
                <input
                  className="inspector-input"
                  disabled={disabled}
                  value={rule.tool_name}
                  onChange={(event) =>
                    onChange(updateItemAtIndex(rules, index, (item) => ({ ...item, tool_name: event.target.value })))
                  }
                />
              </label>

              <StringListEditor
                disabled={disabled}
                label={text('路径字段', 'Path fields')}
                values={rule.path_fields}
                onChange={(nextValues) =>
                  onChange(updateItemAtIndex(rules, index, (item) => ({ ...item, path_fields: nextValues })))
                }
              />

              <StringListEditor
                disabled={disabled}
                label={text('允许根目录', 'Allowed roots')}
                values={rule.allowed_roots}
                onChange={(nextValues) =>
                  onChange(updateItemAtIndex(rules, index, (item) => ({ ...item, allowed_roots: nextValues })))
                }
              />

              <label className="session-toggle-item">
                <input
                  checked={rule.require_absolute_paths}
                  disabled={disabled}
                  type="checkbox"
                  onChange={(event) =>
                    onChange(
                      updateItemAtIndex(rules, index, (item) => ({
                        ...item,
                        require_absolute_paths: event.target.checked,
                      })),
                    )
                  }
                />
                <span>{text('要求绝对路径', 'Require absolute paths')}</span>
              </label>

              <GuardrailListEditor
                disabled={disabled}
                label={text('工具输入规则', 'Tool input rules')}
                rules={rule.input_rules}
                onChange={(nextValue) =>
                  onChange(updateItemAtIndex(rules, index, (item) => ({ ...item, input_rules: nextValue })))
                }
              />

              <GuardrailListEditor
                disabled={disabled}
                label={text('工具输出规则', 'Tool output rules')}
                rules={rule.output_rules}
                onChange={(nextValue) =>
                  onChange(updateItemAtIndex(rules, index, (item) => ({ ...item, output_rules: nextValue })))
                }
              />
            </article>
          ))
        ) : null}
      </div>
    </div>
  )
}
