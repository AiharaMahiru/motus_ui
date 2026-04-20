import { useState } from 'react'

import { CheckCircle2, ChevronDown, CircleAlert, Info, TerminalSquare } from 'lucide-react'

import { useI18n } from '../../../shared/i18n/I18nContext'
import type { ToolResultPayload } from './toolResultMessage'
import { useToolMessageSummary } from './useToolMessageSummary'


type ToolResultViewerProps = {
  compact?: boolean
  payload: ToolResultPayload
  rawContent: string
}

function ResultIcon({ status }: { status: ToolResultPayload['status'] }) {
  if (status === 'success') {
    return <CheckCircle2 size={14} className="text-emerald-600" />
  }
  if (status === 'error') {
    return <CircleAlert size={14} className="text-red-600" />
  }
  return <Info size={14} className="text-slate-500" />
}

export function ToolResultViewer({ payload, rawContent, compact = false }: ToolResultViewerProps) {
  const { text } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const summaryQuery = useToolMessageSummary(payload.toolName, rawContent, payload.summary)
  const summary = summaryQuery.data || payload.summary

  if (compact) {
    return (
      <div className="tool-result-compact">
        <div className="tool-result-compact-summary">
          <ResultIcon status={payload.status} />
          <span>{summary}</span>
        </div>
        {payload.content && payload.content !== summary ? (
          <pre className="tool-result-compact-body">{payload.content}</pre>
        ) : null}
      </div>
    )
  }

  return (
    <section className="tool-result-panel">
      <button
        aria-expanded={expanded}
        className="tool-result-header"
        type="button"
        onClick={() => setExpanded((current) => !current)}
      >
        <div className="min-w-0 flex-1">
          <div className="tool-result-title-row">
            <span className="tool-result-title">
              <TerminalSquare size={14} />
              {text('工具结果', 'Tool result')}
            </span>
            <span className="tool-result-name">{payload.toolName}</span>
          </div>
          <div className="tool-result-summary">
            <ResultIcon status={payload.status} />
            <span>{summary}</span>
          </div>
        </div>

        <ChevronDown className={expanded ? 'tool-result-chevron tool-result-chevron-open' : 'tool-result-chevron'} size={16} />
      </button>

      {expanded ? (
        <div className="tool-result-body">
          <pre>{payload.content}</pre>
        </div>
      ) : null}
    </section>
  )
}
