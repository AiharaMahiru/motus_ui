import type { ChangeEvent } from 'react'

import { Plus, Trash2 } from 'lucide-react'

import type { McpServerConfig } from '../../../../shared/api/contracts'
import { useI18n } from '../../../../shared/i18n/I18nContext'
import {
  createDefaultMcpServer,
  createDefaultResponseFormat,
  createDefaultSandbox,
} from '../../constants'
import { SandboxEditor } from './SandboxEditor'
import { StringListEditor } from './StringListEditor'
import type { McpServerListEditorProps } from './shared'
import { fromLineText, lineTextToMap, mapToLineText, toLineText, updateItemAtIndex } from './shared'

export function McpServerListEditor({
  disabled = false,
  servers,
  onChange,
}: McpServerListEditorProps) {
  const { text } = useI18n()
  const transportLabels: Record<McpServerConfig['transport'], string> = {
    remote_http: text('远端 HTTP', 'Remote HTTP'),
    local_stdio: text('本地命令', 'Local command'),
  }
  return (
    <div className="inspector-form-stack">
      <div className="session-editor-section-head">
        <span className="inspector-field-label">{text('MCP 服务', 'MCP servers')}</span>
        <div className="session-inline-actions">
          <button
            className="inspector-action-secondary"
            disabled={disabled}
            type="button"
            onClick={() => onChange([...servers, createDefaultMcpServer('remote_http')])}
        >
          <Plus size={14} />
          <span>{text('远端 HTTP', 'Remote HTTP')}</span>
        </button>
          <button
            className="inspector-action-secondary"
            disabled={disabled}
            type="button"
            onClick={() => onChange([...servers, createDefaultMcpServer('local_stdio')])}
        >
          <Plus size={14} />
          <span>{text('本地命令', 'Local command')}</span>
        </button>
      </div>
      </div>

      <div className="session-editor-stack">
        {servers.length ? (
          servers.map((server, index) => (
            <article className="session-editor-card" key={`${server.name}:${index}`}>
              <div className="session-editor-card-head">
                <strong>{text('服务', 'Server')} {index + 1}</strong>
                <button
                  className="inspector-action-secondary"
                  disabled={disabled}
                  type="button"
                  onClick={() => onChange(servers.filter((_, itemIndex) => itemIndex !== index))}
                >
                  <Trash2 size={14} />
                  <span>{text('删除', 'Delete')}</span>
                </button>
              </div>

              <div className="inspector-grid-2">
                <label className="inspector-field">
                  <span className="inspector-field-label">{text('名称', 'Name')}</span>
                  <input
                    className="inspector-input"
                    disabled={disabled}
                    value={server.name}
                    onChange={(event) =>
                      onChange(updateItemAtIndex(servers, index, (item) => ({ ...item, name: event.target.value })))
                    }
                  />
                </label>

                <label className="inspector-field">
                  <span className="inspector-field-label">{text('传输方式', 'Transport')}</span>
                  <select
                    className="inspector-select"
                    disabled={disabled}
                    value={server.transport}
                    onChange={(event) =>
                      onChange(
                        updateItemAtIndex(servers, index, () =>
                          createDefaultMcpServer(event.target.value as McpServerConfig['transport']),
                        ),
                      )
                    }
                  >
                    {Object.entries(transportLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {server.transport === 'remote_http' ? (
                <label className="inspector-field">
                  <span className="inspector-field-label">{text('地址', 'URL')}</span>
                  <input
                    className="inspector-input"
                    disabled={disabled}
                    value={server.url ?? ''}
                    onChange={(event) =>
                      onChange(
                        updateItemAtIndex(servers, index, (item) => ({ ...item, url: event.target.value || null })),
                      )
                    }
                  />
                </label>
              ) : (
                <>
                  <label className="inspector-field">
                    <span className="inspector-field-label">{text('命令', 'Command')}</span>
                    <input
                      className="inspector-input"
                      disabled={disabled}
                      value={server.command ?? ''}
                      onChange={(event) =>
                        onChange(
                          updateItemAtIndex(servers, index, (item) => ({
                            ...item,
                            command: event.target.value || null,
                          })),
                        )
                      }
                    />
                  </label>

                  <label className="inspector-field">
                    <span className="inspector-field-label">{text('参数（每行一项）', 'Arguments (one per line)')}</span>
                    <textarea
                      className="inspector-textarea inspector-textarea-code"
                      disabled={disabled}
                      value={toLineText(server.args ?? [])}
                      onChange={(event) =>
                        onChange(
                          updateItemAtIndex(servers, index, (item) => ({
                            ...item,
                            args: fromLineText(event.target.value),
                          })),
                        )
                      }
                    />
                  </label>
                </>
              )}

              <div className="inspector-grid-2">
                <label className="inspector-field">
                  <span className="inspector-field-label">{text('工具前缀', 'Tool prefix')}</span>
                  <input
                    className="inspector-input"
                    disabled={disabled}
                    value={server.prefix}
                    onChange={(event) =>
                      onChange(updateItemAtIndex(servers, index, (item) => ({ ...item, prefix: event.target.value })))
                    }
                  />
                </label>

                <label className="inspector-field">
                  <span className="inspector-field-label">{text('镜像', 'Image')}</span>
                  <input
                    className="inspector-input"
                    disabled={disabled}
                    value={server.image ?? ''}
                    onChange={(event) =>
                      onChange(
                        updateItemAtIndex(servers, index, (item) => ({ ...item, image: event.target.value || null })),
                      )
                    }
                  />
                </label>
              </div>

              <StringListEditor
                disabled={disabled}
                label={text('白名单', 'Allowlist')}
                values={server.allowlist}
                onChange={(nextValues) =>
                  onChange(updateItemAtIndex(servers, index, (item) => ({ ...item, allowlist: nextValues })))
                }
              />

              <StringListEditor
                disabled={disabled}
                label={text('黑名单', 'Blocklist')}
                values={server.blocklist}
                onChange={(nextValues) =>
                  onChange(updateItemAtIndex(servers, index, (item) => ({ ...item, blocklist: nextValues })))
                }
              />

              <label className="inspector-field">
                <span className="inspector-field-label">{text('请求头（KEY=VALUE，每行一项）', 'Headers (KEY=VALUE, one per line)')}</span>
                <textarea
                  className="inspector-textarea inspector-textarea-code"
                  disabled={disabled}
                  value={mapToLineText(server.headers ?? {})}
                  onChange={(event) =>
                    onChange(
                      updateItemAtIndex(servers, index, (item) => ({
                        ...item,
                        headers: lineTextToMap(event.target.value),
                      })),
                    )
                  }
                />
              </label>

              <label className="inspector-field">
                <span className="inspector-field-label">{text('环境变量（KEY=VALUE，每行一项）', 'Environment variables (KEY=VALUE, one per line)')}</span>
                <textarea
                  className="inspector-textarea inspector-textarea-code"
                  disabled={disabled}
                  value={mapToLineText(server.env ?? {})}
                  onChange={(event) =>
                    onChange(
                      updateItemAtIndex(servers, index, (item) => ({
                        ...item,
                        env: lineTextToMap(event.target.value),
                      })),
                    )
                  }
                />
              </label>

              <label className="inspector-field">
                <span className="inspector-field-label">{text('方法映射（方法=工具名，每行一项）', 'Method aliases (method=tool name, one per line)')}</span>
                <textarea
                  className="inspector-textarea inspector-textarea-code"
                  disabled={disabled}
                  value={mapToLineText(server.method_aliases ?? {})}
                  onChange={(event) =>
                    onChange(
                      updateItemAtIndex(servers, index, (item) => ({
                        ...item,
                        method_aliases: lineTextToMap(event.target.value),
                      })),
                    )
                  }
                />
              </label>

              <div className="inspector-grid-2">
                <label className="inspector-field">
                  <span className="inspector-field-label">{text('端口', 'Port')}</span>
                  <input
                    className="inspector-input"
                    disabled={disabled}
                    min={1}
                    type="number"
                    value={server.port}
                    onChange={(event) =>
                      onChange(
                        updateItemAtIndex(servers, index, (item) => ({
                          ...item,
                          port: event.target.value ? Number(event.target.value) : item.port,
                        })),
                      )
                    }
                  />
                </label>

                <label className="inspector-field">
                  <span className="inspector-field-label">{text('沙盒路径', 'Sandbox path')}</span>
                  <input
                    className="inspector-input"
                    disabled={disabled}
                    value={server.sandbox_path}
                    onChange={(event) =>
                      onChange(
                        updateItemAtIndex(servers, index, (item) => ({
                          ...item,
                          sandbox_path: event.target.value,
                        })),
                      )
                    }
                  />
                </label>
              </div>

              <label className="session-toggle-item">
                <input
                  checked={Boolean(server.sandbox)}
                  disabled={disabled}
                  type="checkbox"
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    onChange(
                      updateItemAtIndex(servers, index, (item) => ({
                        ...item,
                        sandbox: event.target.checked ? createDefaultSandbox() : null,
                      })),
                    )
                  }
                />
                <span>{text('为该服务单独指定沙盒', 'Use dedicated sandbox for this server')}</span>
              </label>

              {server.sandbox ? (
                <div className="session-editor-subsection">
                  <SandboxEditor
                    disabled={disabled}
                    value={server.sandbox}
                    onChange={(nextSandbox) =>
                      onChange(updateItemAtIndex(servers, index, (item) => ({ ...item, sandbox: nextSandbox })))
                    }
                  />
                </div>
              ) : null}
            </article>
          ))
        ) : null}
      </div>
    </div>
  )
}

export function createEmptyResponseFormat() {
  return createDefaultResponseFormat()
}
