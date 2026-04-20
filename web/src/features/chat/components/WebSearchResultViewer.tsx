import { useState } from 'react'

import { ChevronDown, ExternalLink, Globe, Search } from 'lucide-react'

import { useI18n } from '../../../shared/i18n/I18nContext'
import type { WebSearchMessagePayload } from './webSearchMessage'
import { useToolMessageSummary } from './useToolMessageSummary'


type WebSearchResultViewerProps = {
  compact?: boolean
  payload: WebSearchMessagePayload
  rawContent: string
}

function hostName(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function WebSearchResultViewer({ payload, rawContent, compact = false }: WebSearchResultViewerProps) {
  const { text } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const fallbackSummary =
    payload.results[0]?.title
      ? text(
          `检索到 ${payload.results.length} 条结果，首条为 ${payload.results[0].title}`,
          `${payload.results.length} results, first one is ${payload.results[0].title}`,
        )
      : text(`检索到 ${payload.results.length} 条网页结果`, `${payload.results.length} web results found`)
  const summaryQuery = useToolMessageSummary(payload.toolName, rawContent, fallbackSummary)
  const summary = summaryQuery.data || fallbackSummary

  if (compact) {
    return (
      <div className="web-search-compact">
        <div className="web-search-compact-summary">
          <Search size={13} />
          <span>{summary}</span>
        </div>
        <div className="web-search-compact-list">
          {payload.results.slice(0, 3).map((item) => (
            <a className="web-search-compact-item" href={item.url} key={item.url} rel="noreferrer" target="_blank">
              <span className="web-search-compact-host">{hostName(item.url)}</span>
              <span className="web-search-compact-title">{item.title}</span>
            </a>
          ))}
        </div>
      </div>
    )
  }

  return (
    <section className="web-search-panel">
      <button
        aria-expanded={expanded}
        className="web-search-header"
        type="button"
        onClick={() => setExpanded((current) => !current)}
      >
        <div className="min-w-0 flex-1">
          <div className="web-search-title-row">
            <span className="web-search-title">
              <Search size={14} />
              {text('搜索结果', 'Search results')}
            </span>
            <span className="web-search-count">{payload.results.length} {text('条', 'items')}</span>
          </div>
          <div className="web-search-summary">{summary}</div>
        </div>

        <ChevronDown className={expanded ? 'web-search-chevron web-search-chevron-open' : 'web-search-chevron'} size={16} />
      </button>

      {expanded ? (
        <div className="web-search-body">
          {payload.results.map((item) => (
            <a className="web-search-item" href={item.url} key={item.url} rel="noreferrer" target="_blank">
              <div className="web-search-item-topline">
                <span className="web-search-domain">
                  <Globe size={11} />
                  {hostName(item.url)}
                </span>
                <ExternalLink size={12} className="text-slate-400" />
              </div>
              <strong className="web-search-item-title">{item.title}</strong>
              {item.description ? <p className="web-search-item-description">{item.description}</p> : null}
            </a>
          ))}
        </div>
      ) : null}
    </section>
  )
}
