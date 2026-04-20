import { Cpu, FolderTree, Info, Server, Sparkles } from 'lucide-react'

import type { AppMeta } from '../../../shared/api/contracts'
import { useI18n } from '../../../shared/i18n/I18nContext'
import { formatIsoDateTime } from '../../../shared/lib/format'


type MetaPanelProps = {
  meta?: AppMeta
}


export function MetaPanel({ meta }: MetaPanelProps) {
  const { text } = useI18n()
  if (!meta) {
    return null
  }

  return (
    <div className="inspector-page">
      <section className="inspector-section">
        <div className="meta-list">
          <div className="meta-row">
            <div className="meta-row-label">
              <Info size={14} />
              <span>{text('版本', 'Version')}</span>
            </div>
            <span className="inspector-chip">{meta.app_version}</span>
          </div>

          <div className="meta-row">
            <div className="meta-row-label">
              <Server size={14} />
              <span>{text('桌面模式', 'Desktop mode')}</span>
            </div>
            <span className="meta-row-value">{meta.desktop_mode ? text('开启', 'On') : text('关闭', 'Off')}</span>
          </div>

          <div className="meta-row">
            <div className="meta-row-label">
              <Cpu size={14} />
              <span>{text('后端模式', 'Backend mode')}</span>
            </div>
            <span className="meta-row-value">{meta.backend_mode}</span>
          </div>

          <div className="meta-row meta-row-block">
            <div className="meta-row-label">
              <Server size={14} />
              <span>API Base URL</span>
            </div>
            <div className="inspector-path-block">{meta.api_base_url}</div>
          </div>

          <div className="meta-row meta-row-block">
            <div className="meta-row-label">
              <FolderTree size={14} />
              <span>{text('runtime 目录', 'Runtime dir')}</span>
            </div>
            <div className="inspector-path-block">{meta.runtime_dir}</div>
          </div>

          <div className="meta-row meta-row-block">
            <div className="meta-row-label">
              <FolderTree size={14} />
              <span>{text('项目根目录', 'Project root')}</span>
            </div>
            <div className="inspector-path-block">{meta.project_root}</div>
          </div>

          <div className="meta-row">
            <div className="meta-row-label">
              <Server size={14} />
              <span>{text('服务启动时间', 'Server started')}</span>
            </div>
            <span className="meta-row-value">{formatIsoDateTime(meta.server_started_at)}</span>
          </div>
        </div>
      </section>

      <section className="inspector-section">
        <div className="meta-list">
          <div className="meta-row">
            <div className="meta-row-label">
              <Sparkles size={14} />
              <span>{text('支持中断恢复', 'Supports HITL')}</span>
            </div>
            <span className="meta-row-value">{meta.supports_interrupts ? text('是', 'Yes') : text('否', 'No')}</span>
          </div>

          <div className="meta-row">
            <div className="meta-row-label">
              <span>{text('支持动态会话配置', 'Supports dynamic session config')}</span>
            </div>
            <span className="meta-row-value">{meta.supports_dynamic_session_config ? text('是', 'Yes') : text('否', 'No')}</span>
          </div>

          <div className="meta-row">
            <div className="meta-row-label">
              <span>{text('支持预览运行', 'Supports preview')}</span>
            </div>
            <span className="meta-row-value">{meta.supports_preview ? text('是', 'Yes') : text('否', 'No')}</span>
          </div>

          <div className="meta-row">
            <div className="meta-row-label">
              <span>{text('支持结构化输出', 'Supports structured output')}</span>
            </div>
            <span className="meta-row-value">{meta.supports_structured_response_format ? text('是', 'Yes') : text('否', 'No')}</span>
          </div>
        </div>
      </section>
    </div>
  )
}
