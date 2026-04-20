import { lazy, Suspense, useState } from 'react'

import { BookOpenText, ChevronDown, FolderCode } from 'lucide-react'

import type { SkillMessagePayload } from './skillMessage'
import { useToolMessageSummary } from './useToolMessageSummary'


type SkillLoadViewerProps = {
  compact?: boolean
  payload: SkillMessagePayload
  rawContent: string
}

const MarkdownMessage = lazy(() =>
  import('./MarkdownMessage').then((module) => ({
    default: module.MarkdownMessage,
  })),
)

export function SkillLoadViewer({ payload, rawContent, compact = false }: SkillLoadViewerProps) {
  const [expanded, setExpanded] = useState(false)
  const summaryQuery = useToolMessageSummary('load_skill', rawContent, payload.summary || `已加载 ${payload.skillName}`)
  const summary = summaryQuery.data || payload.summary || `已加载 ${payload.skillName}`

  if (compact) {
    return (
      <div className="skill-load-compact">
        <div className="skill-load-compact-summary">
          <BookOpenText size={13} />
          <span>{summary}</span>
        </div>
        <div className="skill-load-compact-directory">
          <FolderCode size={12} />
          <code>{payload.directory}</code>
        </div>
      </div>
    )
  }

  return (
    <section className="skill-load-panel">
      <button
        aria-expanded={expanded}
        className="skill-load-header"
        type="button"
        onClick={() => setExpanded((current) => !current)}
      >
        <div className="min-w-0 flex-1">
          <div className="skill-load-title-row">
            <span className="skill-load-title">
              <BookOpenText size={14} />
              已加载 Skill
            </span>
            <span className="skill-load-name">{payload.skillName}</span>
          </div>
          <div className="skill-load-summary">{summary}</div>
        </div>

        <div className="skill-load-meta">
          <span className="skill-load-directory">
            <FolderCode size={12} />
            <code>{payload.directory}</code>
          </span>
          <ChevronDown className={expanded ? 'skill-load-chevron skill-load-chevron-open' : 'skill-load-chevron'} size={16} />
        </div>
      </button>

      {expanded ? (
        <div className="skill-load-body">
          <Suspense fallback={<div className="message-content whitespace-pre-wrap">{payload.markdown}</div>}>
            <MarkdownMessage content={payload.markdown} />
          </Suspense>
        </div>
      ) : null}
    </section>
  )
}
