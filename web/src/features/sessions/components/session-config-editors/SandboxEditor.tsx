import { Cloud, HardDrive, Wrench } from 'lucide-react'

import { useI18n } from '../../../../shared/i18n/I18nContext'
import { createDefaultSandbox } from '../../constants'
import type { SandboxEditorProps } from './shared'
import { lineTextToMap, mapToLineText } from './shared'

export function SandboxEditor({
  disabled = false,
  value,
  onChange,
}: SandboxEditorProps) {
  const { text } = useI18n()
  const providerOptions = [
    ['local', text('本地', 'Local'), HardDrive],
    ['docker', text('容器', 'Container'), Wrench],
    ['cloud', text('云端', 'Cloud'), Cloud],
  ] as const

  return (
    <div className="inspector-form-stack">
      <div className="session-segmented">
        {providerOptions.map(([provider, label, Icon]) => (
          <button
            className={
              value.provider === provider
                ? 'session-segmented-button session-segmented-button-active'
                : 'session-segmented-button'
            }
            disabled={disabled}
            key={provider}
            type="button"
            onClick={() => onChange({ ...createDefaultSandbox(provider), env: value.env })}
          >
            <Icon size={14} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {value.provider === 'local' ? (
        <label className="inspector-field">
          <span className="inspector-field-label">{text('工作目录', 'Working directory')}</span>
          <input
            className="inspector-input"
            disabled={disabled}
            value={value.cwd ?? ''}
            onChange={(event) => onChange({ ...value, cwd: event.target.value || null })}
          />
        </label>
      ) : null}

      {value.provider === 'docker' ? (
        <>
          <label className="inspector-field">
            <span className="inspector-field-label">{text('镜像', 'Image')}</span>
            <input
              className="inspector-input"
              disabled={disabled}
              value={value.image ?? ''}
              onChange={(event) => onChange({ ...value, image: event.target.value || null })}
            />
          </label>

          <div className="inspector-grid-2">
            <label className="session-toggle-item">
              <input
                checked={value.mount_project_root}
                disabled={disabled}
                type="checkbox"
                onChange={(event) => onChange({ ...value, mount_project_root: event.target.checked })}
              />
              <span>{text('挂载项目根目录', 'Mount project root')}</span>
            </label>

            <label className="session-toggle-item">
              <input
                checked={value.restrict_file_tools_to_workspace}
                disabled={disabled}
                type="checkbox"
                onChange={(event) =>
                  onChange({ ...value, restrict_file_tools_to_workspace: event.target.checked })
                }
              />
              <span>{text('限制文件工具到工作区', 'Restrict file tools to workspace')}</span>
            </label>
          </div>

          <label className="inspector-field">
            <span className="inspector-field-label">{text('挂载路径', 'Mount path')}</span>
            <input
              className="inspector-input"
              disabled={disabled}
              value={value.mount_path}
              onChange={(event) => onChange({ ...value, mount_path: event.target.value })}
            />
          </label>
        </>
      ) : null}

      {value.provider === 'cloud' ? (
        <div className="inspector-grid-2">
          <label className="inspector-field">
            <span className="inspector-field-label">{text('云端地址', 'Cloud URL')}</span>
            <input
              className="inspector-input"
              disabled={disabled}
              value={value.cloud_url ?? ''}
              onChange={(event) => onChange({ ...value, cloud_url: event.target.value || null })}
            />
          </label>

          <label className="inspector-field">
            <span className="inspector-field-label">{text('令牌环境变量', 'Token env var')}</span>
            <input
              className="inspector-input"
              disabled={disabled}
              value={value.token_env_var ?? ''}
              onChange={(event) => onChange({ ...value, token_env_var: event.target.value || null })}
            />
          </label>
        </div>
      ) : null}

      <label className="inspector-field">
        <span className="inspector-field-label">{text('环境变量（KEY=VALUE，每行一项）', 'Environment variables (KEY=VALUE, one per line)')}</span>
        <textarea
          className="inspector-textarea inspector-textarea-code"
          disabled={disabled}
          value={mapToLineText(value.env ?? {})}
          onChange={(event) => onChange({ ...value, env: lineTextToMap(event.target.value) })}
        />
      </label>
    </div>
  )
}
