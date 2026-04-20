import { Boxes, ExternalLink, FolderOpen, Route, Sparkles } from 'lucide-react'

import type { TraceExportResult, TracingStatus } from '../../../shared/api/contracts'
import { useI18n } from '../../../shared/i18n/I18nContext'
import { formatIsoDateTime } from '../../../shared/lib/format'


type TracingPanelProps = {
  activeTitle: string
  activeStatus?: TracingStatus
  runtimeStatus?: TracingStatus
  exportResult?: TraceExportResult
  onExportActive?: () => void
  onExportRuntime?: () => void
  exporting: boolean
}


function TraceStatusSection({
  title,
  status,
  onExport,
  exporting,
}: {
  title: string
  status?: TracingStatus
  onExport?: () => void
  exporting: boolean
}) {
  const { text } = useI18n()
  if (!status) {
    return null
  }

  return (
    <section className="inspector-section">
        <div className="inspector-section-head inspector-section-head-compact">
          <div className="inspector-title-inline">
            <span className="inspector-section-icon">
              <Route size={14} />
            </span>
            <div className="inspector-title-group">
              <h3 className="inspector-section-title">{title}</h3>
            </div>
          </div>
        <span className={status?.collecting ? 'status-badge status-running' : 'status-badge status-idle'}>
          {status?.collecting ? text('采集中', 'Collecting') : text('空闲', 'Idle')}
        </span>
      </div>

      <div className="inspector-form-stack">
        <div className="inspector-grid-2">
          <div className="tool-section-card !p-3">
            <span className="inspector-field-label">{text('范围', 'Scope')}</span>
            <div className="mt-1 text-[13px] font-black" style={{ color: 'var(--app-text)' }}>{status.scope}</div>
          </div>
          <div className="tool-section-card !p-3">
            <span className="inspector-field-label">{text('任务数', 'Tracked tasks')}</span>
            <div className="mt-1 text-[13px] font-black" style={{ color: 'var(--app-text)' }}>{status.tracked_task_count}</div>
          </div>
        </div>

        <div className="tool-section-card !p-3">
          <div className="flex items-center gap-2">
            <FolderOpen size={14} style={{ color: 'var(--app-text-faint)' }} />
            <span className="inspector-field-label">{text('日志目录', 'Log directory')}</span>
          </div>
          <div className="inspector-path-block mt-2">{status.log_dir}</div>
        </div>

        <div className="tool-section-card !p-3">
          <div className="flex items-center gap-2">
            <Boxes size={14} style={{ color: 'var(--app-text-faint)' }} />
            <span className="inspector-field-label">{text('配置概览', 'Config')}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="inspector-chip">{status.config.collection_level}</span>
            <span className="inspector-chip inspector-chip-muted">{status.config.online_tracing ? text('在线查看', 'Viewer mode') : text('本地导出', 'Local export')}</span>
            <span className="inspector-chip inspector-chip-muted">{status.available_files.length} {text('个产物', 'artifacts')}</span>
          </div>
        </div>

        <div className="inspector-toolbar">
          {status.viewer_url ? (
            <a className="inspector-action-secondary" href={status.viewer_url} rel="noreferrer" target="_blank">
              <ExternalLink size={14} />
              <span>{text('打开查看器', 'Open viewer')}</span>
            </a>
          ) : null}
          {onExport ? (
            <button className="inspector-action-primary" disabled={exporting} type="button" onClick={onExport}>
              {exporting ? text('导出中...', 'Exporting...') : text('导出 Trace', 'Export trace')}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  )
}


export function TracingPanel({
  activeTitle,
  activeStatus,
  runtimeStatus,
  exportResult,
  onExportActive,
  onExportRuntime,
  exporting,
}: TracingPanelProps) {
  const { text } = useI18n()
  if (!activeStatus && !runtimeStatus && !exportResult) {
    return null
  }

  return (
    <div className="inspector-page">
      <TraceStatusSection exporting={exporting} onExport={onExportActive} status={activeStatus} title={activeTitle} />
      <TraceStatusSection exporting={exporting} onExport={onExportRuntime} status={runtimeStatus} title={text('系统运行时', 'Runtime')} />

      {exportResult ? (
        <section className="inspector-section">
          <div className="inspector-section-head inspector-section-head-compact">
            <div className="inspector-title-inline">
              <span className="inspector-section-icon">
                <Sparkles size={14} />
              </span>
              <div className="inspector-title-group">
                <h3 className="inspector-section-title">{text('最近一次导出', 'Latest export')}</h3>
              </div>
            </div>
            <span className="inspector-chip">{formatIsoDateTime(new Date().toISOString())}</span>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            <span className="inspector-chip">{exportResult.files.length} {text('个产物', 'artifacts')}</span>
            {exportResult.message ? <span className="inspector-chip inspector-chip-muted">{exportResult.message}</span> : null}
          </div>
          <div className="inspector-path-block mt-3">{exportResult.log_dir}</div>
        </section>
      ) : null}
    </div>
  )
}
