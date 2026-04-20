import { lazy, Suspense, useMemo, useState } from 'react'

import { Check, ChevronDown, Copy, Layers3, Trash2, Wrench } from 'lucide-react'

import type { ChatMessage } from '../../../shared/api/contracts'
import { useI18n } from '../../../shared/i18n/I18nContext'
import { copyTextToClipboard } from '../../../shared/lib/clipboard'
import { formatIsoTime, renderMessageContent } from '../../../shared/lib/format'
import { parseSkillMessage } from './skillMessage'
import { batchToolMessages, resolveMessageTimestamp, toolNameOfMessage } from './toolMessageGrouping'
import { parseToolResultMessage } from './toolResultMessage'
import { parseToolExecutionPayload } from './toolExecution'
import { useToolMessageSummary } from './useToolMessageSummary'
import { parseWebSearchMessage } from './webSearchMessage'


type ToolMessageGroupProps = {
  deleteDisabled?: boolean
  embedded?: boolean
  messages: ChatMessage[]
  onDeleteBatch?: (messages: ChatMessage[]) => void
  onDelete?: () => void
}

const SkillLoadViewer = lazy(() =>
  import('./SkillLoadViewer').then((module) => ({
    default: module.SkillLoadViewer,
  })),
)
const WebSearchResultViewer = lazy(() =>
  import('./WebSearchResultViewer').then((module) => ({
    default: module.WebSearchResultViewer,
  })),
)
const ToolExecutionViewer = lazy(() =>
  import('./ToolExecutionViewer').then((module) => ({
    default: module.ToolExecutionViewer,
  })),
)
const ToolResultViewer = lazy(() =>
  import('./ToolResultViewer').then((module) => ({
    default: module.ToolResultViewer,
  })),
)

function summarizeTools(messages: ChatMessage[]) {
  const counts = new Map<string, number>()
  for (const message of messages) {
    const toolName = toolNameOfMessage(message)
    counts.set(toolName, (counts.get(toolName) ?? 0) + 1)
  }
  return [...counts.entries()].map(([name, count]) => `${name}×${count}`).join(' · ')
}

function lastTimestamp(messages: ChatMessage[]) {
  return messages
    .map((message) => message.timestamp ?? message.created_at ?? message.updated_at)
    .filter((value): value is string => typeof value === 'string')
    .at(-1)
}

type ToolMessageBatchCardProps = {
  deleteDisabled?: boolean
  defaultExpanded?: boolean
  index: number
  messages: ChatMessage[]
  nested?: boolean
  onDelete?: (messages: ChatMessage[]) => void
}

function renderDetailContent(entry: ChatMessage, entryContent: string, entryTimestamp: string | undefined, compact = false) {
  const entrySkillPayload = parseSkillMessage(entry, entryContent)
  const entryWebSearchPayload = parseWebSearchMessage(entry, entryContent)
  const entryToolExecutionPayload = entryWebSearchPayload ? null : parseToolExecutionPayload(entryContent)
  const entryToolResultPayload = parseToolResultMessage(entry, entryContent)

  if (entrySkillPayload) {
    return (
      <Suspense fallback={<div className="message-content whitespace-pre-wrap">{entryContent}</div>}>
        <SkillLoadViewer compact={compact} payload={entrySkillPayload} rawContent={entryContent} />
      </Suspense>
    )
  }

  if (entryWebSearchPayload) {
    return (
      <Suspense fallback={<div className="message-content whitespace-pre-wrap">{entryContent}</div>}>
        <WebSearchResultViewer compact={compact} payload={entryWebSearchPayload} rawContent={entryContent} />
      </Suspense>
    )
  }

  if (entryToolExecutionPayload) {
    return (
      <Suspense fallback={<div className="message-content whitespace-pre-wrap">{entryContent}</div>}>
        <ToolExecutionViewer compact={compact} payload={entryToolExecutionPayload} rawContent={entryContent} timestamp={entryTimestamp} />
      </Suspense>
    )
  }

  if (entryToolResultPayload) {
    return (
      <Suspense fallback={<div className="message-content whitespace-pre-wrap">{entryContent}</div>}>
        <ToolResultViewer compact={compact} payload={entryToolResultPayload} rawContent={entryContent} />
      </Suspense>
    )
  }

  return <div className="message-content whitespace-pre-wrap">{entryContent}</div>
}

export function ToolMessageBatchCard({
  deleteDisabled = false,
  index,
  messages,
  nested = false,
  defaultExpanded = false,
  onDelete,
}: ToolMessageBatchCardProps) {
  const { text } = useI18n()
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [copied, setCopied] = useState(false)
  const message = messages[0]
  const content = renderMessageContent(message).trim()
  const skillMessagePayload = parseSkillMessage(message, content)
  const webSearchPayload = parseWebSearchMessage(message, content)
  const toolExecutionPayload = webSearchPayload ? null : parseToolExecutionPayload(content)
  const toolResultPayload = parseToolResultMessage(message, content)

  const toolName =
    skillMessagePayload?.skillName ||
    webSearchPayload?.toolName ||
    toolExecutionPayload?.toolName ||
    toolResultPayload?.toolName ||
    'tool'
  const fallbackSummary =
    skillMessagePayload?.summary ||
    (webSearchPayload
      ? text(`检索到 ${webSearchPayload.results.length} 条结果`, `${webSearchPayload.results.length} search results`)
      : undefined) ||
    toolExecutionPayload?.tasks[0]?.content ||
    toolResultPayload?.summary ||
    text('工具消息', 'Tool message')
  const summaryQuery = useToolMessageSummary(
    skillMessagePayload ? 'load_skill' : webSearchPayload?.toolName || toolExecutionPayload?.toolName || toolResultPayload?.toolName || 'tool',
    content,
    fallbackSummary,
    expanded && !nested,
  )
  const summary = (summaryQuery.data as string | undefined) || fallbackSummary
  const timestamp = resolveMessageTimestamp(message)
  const count = messages.length

  async function handleCopy() {
    const mergedContent = messages
      .map((entry) => renderMessageContent(entry).trim())
      .filter(Boolean)
      .join('\n\n')
    await copyTextToClipboard(mergedContent)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div className={nested ? 'tool-group-row tool-group-row-nested' : 'tool-group-row'}>
      <div className={nested ? 'tool-group-row-header tool-group-row-header-nested' : 'tool-group-row-header'}>
        <button
          aria-expanded={expanded}
          className="tool-group-row-header-toggle"
          type="button"
          onClick={() => setExpanded((current) => !current)}
        >
          <div className="tool-group-row-main">
            {nested ? (
              <div className="tool-group-row-inline-header">
                <span className="tool-group-row-kicker-icon">
                  <Wrench size={12} />
                </span>
                <span className="tool-group-row-name tool-group-row-name-nested">{toolName}</span>
                {count > 1 ? <span className="tool-group-row-count">×{count}</span> : null}
              </div>
            ) : (
              <div className="tool-group-row-title-line">
                <div className="tool-group-row-kicker">
                  <span className="tool-group-row-kicker-icon">
                    <Wrench size={12} />
                  </span>
                  <span>{text('工具批次', 'Tool batch')}</span>
                </div>
                {count > 1 ? <span className="tool-group-row-count">×{count}</span> : null}
              </div>
            )}
            {!nested ? <span className="tool-group-row-name">{toolName}</span> : null}
            <span className={nested ? 'tool-group-row-summary tool-group-row-summary-nested' : 'tool-group-row-summary'}>
              {summary}
            </span>
          </div>
          <div className="tool-group-row-meta">
            {timestamp ? <span className="tool-group-row-time">{formatIsoTime(timestamp)}</span> : null}
            <ChevronDown className={expanded ? 'tool-group-chevron tool-group-chevron-open' : 'tool-group-chevron'} size={14} />
          </div>
        </button>
        <div className="message-actions tool-group-actions">
          <button
            aria-label={text('复制工具批次', 'Copy tool batch')}
            className="message-action-button"
            title={text('复制工具批次', 'Copy tool batch')}
            type="button"
            onClick={() => void handleCopy()}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
          {onDelete ? (
            <button
              aria-label={text('删除工具批次', 'Delete tool batch')}
              className="message-action-button message-action-button-danger"
              disabled={deleteDisabled}
              title={text('删除工具批次', 'Delete tool batch')}
              type="button"
              onClick={() => onDelete(messages)}
            >
              <Trash2 size={12} />
            </button>
          ) : null}
        </div>
      </div>

      {expanded ? (
        <div className={nested ? 'tool-group-row-body tool-group-row-body-nested' : 'tool-group-row-body'}>
          {messages.map((entry, entryIndex) => {
            const entryContent = renderMessageContent(entry).trim()
            const entryTimestamp = resolveMessageTimestamp(entry)

            return (
              <div className="tool-group-detail-item" key={`${toolName}:${index}:${entryIndex}`}>
                {renderDetailContent(entry, entryContent, entryTimestamp, nested)}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export function ToolMessageGroup({
  messages,
  embedded = false,
  onDeleteBatch,
  onDelete,
  deleteDisabled = false,
}: ToolMessageGroupProps) {
  const { text } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const summary = useMemo(() => summarizeTools(messages), [messages])
  const batches = useMemo(() => batchToolMessages(messages), [messages])
  const timestamp = lastTimestamp(messages)

  async function handleCopy() {
    const mergedContent = messages
      .map((message) => renderMessageContent(message).trim())
      .filter(Boolean)
      .join('\n\n')
    await copyTextToClipboard(mergedContent)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <section className={embedded ? 'tool-group-panel tool-group-panel-embedded' : 'tool-group-panel'}>
      <div className="tool-group-header">
        <button
          aria-expanded={expanded}
          className="tool-group-header-toggle"
          type="button"
          onClick={() => setExpanded((current) => !current)}
        >
          <div className="min-w-0 flex-1">
            <div className="tool-group-title-row">
              <span className="tool-group-title">
                <Layers3 size={14} />
                {embedded ? text('工具结果', 'Tool results') : text('连续工具调用', 'Grouped tool calls')}
              </span>
              <span className="tool-group-count">{messages.length} {text('条', 'items')}</span>
              {batches.length !== messages.length ? <span className="tool-group-count">{batches.length} {text('组', 'groups')}</span> : null}
            </div>
            <div className="tool-group-summary">{summary}</div>
          </div>
          <div className="tool-group-meta">
            {timestamp ? <span className="text-[10px] font-mono text-slate-400">{formatIsoTime(timestamp)}</span> : null}
            <ChevronDown className={expanded ? 'tool-group-chevron tool-group-chevron-open' : 'tool-group-chevron'} size={16} />
          </div>
        </button>
        <div className="message-actions tool-group-actions">
          <button
            aria-label={text('复制工具消息', 'Copy tool messages')}
            className="message-action-button"
            title={text('复制工具消息', 'Copy tool messages')}
            type="button"
            onClick={() => void handleCopy()}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
          {onDelete ? (
            <button
              aria-label={text('删除工具消息', 'Delete tool messages')}
              className="message-action-button message-action-button-danger"
              disabled={deleteDisabled}
              title={text('删除工具消息', 'Delete tool messages')}
              type="button"
              onClick={onDelete}
            >
              <Trash2 size={12} />
            </button>
          ) : null}
        </div>
      </div>

      {expanded ? (
        <div className="tool-group-body">
          {batches.map((batch, index) => (
            <ToolMessageBatchCard
              deleteDisabled={deleteDisabled}
              index={index}
              key={`${toolNameOfMessage(batch[0])}:${index}`}
              messages={batch}
              onDelete={onDeleteBatch}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}
