import { useState } from 'react'

import { CheckCircle2, ChevronDown, Clock3, LoaderCircle, TerminalSquare, XCircle } from 'lucide-react'

import { useI18n } from '../../../shared/i18n/I18nContext'
import { formatIsoTime } from '../../../shared/lib/format'
import type { ToolExecutionPayload, ToolExecutionStatus } from './toolExecution'
import { useToolMessageSummary } from './useToolMessageSummary'

type ToolExecutionViewerProps = {
  compact?: boolean
  payload: ToolExecutionPayload
  rawContent: string
  timestamp?: string
  defaultOpen?: boolean
}

function StatusBadge({
  status,
  text,
}: {
  status: ToolExecutionStatus
  text: (zh: string, en: string) => string
}) {
  if (status === 'running') {
    return (
      <span className="tool-execution-status tool-execution-status-running">
        <LoaderCircle size={13} className="animate-spin" />
        {text('执行中', 'Running')}
      </span>
    )
  }

  if (status === 'failed') {
    return (
      <span className="tool-execution-status tool-execution-status-failed">
        <XCircle size={13} />
        {text('执行失败', 'Failed')}
      </span>
    )
  }

  return (
    <span className="tool-execution-status tool-execution-status-completed">
      <CheckCircle2 size={13} />
      {text('已完成', 'Completed')}
    </span>
  )
}

function TaskMarker({ status }: { status?: string }) {
  const normalizedStatus = status?.toLowerCase() ?? ''
  if (normalizedStatus.includes('progress') || normalizedStatus.includes('running') || normalizedStatus.includes('pending')) {
    return <LoaderCircle size={14} className="animate-spin text-blue-600" />
  }
  if (normalizedStatus.includes('error') || normalizedStatus.includes('fail')) {
    return <XCircle size={14} className="text-red-600" />
  }
  return <CheckCircle2 size={14} className="text-emerald-600" />
}

export function ToolExecutionViewer({
  compact = false,
  payload,
  rawContent,
  timestamp,
  defaultOpen = true,
}: ToolExecutionViewerProps) {
  const { text } = useI18n()
  const [open, setOpen] = useState(defaultOpen)
  const fallbackSummary = payload.tasks[0]?.content || `${payload.toolName} ${text('已执行', 'executed')}`
  const summaryQuery = useToolMessageSummary(payload.toolName, rawContent, fallbackSummary)
  const summary = summaryQuery.data || fallbackSummary

  if (compact) {
    return (
      <div className="tool-execution-compact">
        <div className="tool-execution-compact-summary">
          <TerminalSquare size={13} />
          <span>{summary}</span>
          <StatusBadge status={payload.status} text={text} />
        </div>
        <div className="tool-execution-compact-list">
          {payload.tasks.map((task, index) => (
            <div className="tool-execution-compact-item" key={`${task.content}:${task.timestamp ?? index}`}>
              <span className="tool-execution-compact-marker">
                <TaskMarker status={task.status} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="tool-execution-compact-meta">
                  <span>{formatIsoTime(task.timestamp ?? timestamp)}</span>
                  {task.status ? <span>{task.status}</span> : null}
                </div>
                <p className="tool-execution-compact-content">{task.content}</p>
                {task.activeOrm ? <code className="tool-execution-compact-command">{task.activeOrm}</code> : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <section className="tool-execution-panel">
      <button
        aria-expanded={open}
        className="tool-execution-header"
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="tool-execution-icon">
            <TerminalSquare size={16} />
          </span>
          <div className="min-w-0 text-left">
            <span className="tool-execution-kicker">{text('工具执行', 'Tool execution')}</span>
            <div className="tool-execution-title-row">
              <strong className="tool-execution-title">{payload.toolName}</strong>
              <span className="tool-execution-count">{payload.tasks.length} {text('项任务', 'tasks')}</span>
            </div>
            <div className="tool-execution-summary">{summary}</div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <StatusBadge status={payload.status} text={text} />
          <ChevronDown
            className={open ? 'tool-execution-chevron tool-execution-chevron-open' : 'tool-execution-chevron'}
            size={16}
          />
        </div>
      </button>

      {open ? (
        <div className="tool-execution-body">
          {payload.tasks.map((task, index) => (
            <div className="tool-execution-task" key={`${task.content}:${task.timestamp ?? index}`}>
              <div className="tool-execution-task-marker">
                <TaskMarker status={task.status} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="tool-execution-task-meta">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 size={11} />
                    {formatIsoTime(task.timestamp ?? timestamp)}
                  </span>
                  {task.status ? <span>{task.status}</span> : null}
                </div>

                <p className="tool-execution-task-content">{task.content}</p>

                {task.activeOrm ? (
                  <div className="tool-execution-command">
                    <span>active_orm</span>
                    <code>{task.activeOrm}</code>
                  </div>
                ) : null}

                {task.detail ? (
                  <details className="tool-execution-detail">
                    <summary>{text('查看结构化详情', 'View structured detail')}</summary>
                    <pre>{task.detail}</pre>
                  </details>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}
