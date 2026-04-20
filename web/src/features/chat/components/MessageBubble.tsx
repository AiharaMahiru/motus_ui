import { lazy, memo, Suspense, useMemo, useState } from 'react'

import { Check, Copy, Trash2 } from 'lucide-react'

import type { ChatMessage } from '../../../shared/api/contracts'
import { useI18n } from '../../../shared/i18n/I18nContext'
import { copyTextToClipboard } from '../../../shared/lib/clipboard'
import { formatIsoTime, renderMessageContent } from '../../../shared/lib/format'
import { formatAttachmentSize, normalizeMessageAttachments } from '../attachments'
import type { PreviewRequestLanguage } from '../../previews/previewCode'
import { MarkdownMessage } from './MarkdownMessage'
import { parseToolResultMessage } from './toolResultMessage'
import { parseSkillMessage } from './skillMessage'
import { parseToolExecutionPayload } from './toolExecution'
import { parseWebSearchMessage } from './webSearchMessage'


type MessageBubbleProps = {
  deleteDisabled?: boolean
  message: ChatMessage
  onDelete?: () => void
  onRequestPreview?: (payload: {
    code: string
    key: string
    language: PreviewRequestLanguage
  }) => void
  activePreviewKey?: string
  isPreviewRunning?: boolean
  sessionId?: string
  timestamp?: string
}

type MessageUserParams = {
  attachments?: unknown
  display_content?: string
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


function MessageBubbleInner({
  message,
  timestamp,
  onDelete,
  deleteDisabled = false,
  onRequestPreview,
  activePreviewKey,
  isPreviewRunning = false,
  sessionId,
}: MessageBubbleProps) {
  const { text } = useI18n()
  const isUser = message.role === 'user'
  const isTool = message.role === 'tool'
  const userParams =
    typeof message.user_params === 'object' && message.user_params
      ? (message.user_params as MessageUserParams)
      : undefined
  const displayContent =
    isUser && typeof userParams?.display_content === 'string'
      ? userParams.display_content
      : renderMessageContent(message)
  const content = displayContent.trim()
  const messageTimestamp = timestamp ?? getMessageTimestamp(message)
  const [copied, setCopied] = useState(false)
  const attachments = normalizeMessageAttachments(userParams?.attachments)
  const skillMessagePayload = isUser ? null : parseSkillMessage(message, content)
  const webSearchPayload = isUser ? null : parseWebSearchMessage(message, content)
  const toolExecutionPayload = isUser || webSearchPayload ? null : parseToolExecutionPayload(content)
  const toolResultPayload = isUser ? null : parseToolResultMessage(message, content)
  const previewContext = useMemo(
    () => ({
      activePreviewKey,
      isPreviewRunning,
      onRequestPreview,
      sessionId,
    }),
    [activePreviewKey, isPreviewRunning, onRequestPreview, sessionId],
  )
  
  // Skip redundant stream ID messages or empty content
  const isRedundantStreamId = content.startsWith('WEBUI_STREAM_') && !content.includes('\n')
  const hasContent = content.length > 0 && !isRedundantStreamId

  if (!hasContent) {
    return null
  }

  const roleLabel = isUser 
    ? text('用户输入', 'User') 
    : skillMessagePayload
      ? text('技能加载', 'Skill load')
      : webSearchPayload
        ? text('搜索结果', 'Search results')
      : toolExecutionPayload
      ? text('工具执行', 'Tool execution')
      : toolResultPayload
        ? text('工具输出', 'Tool output')
      : isTool
        ? text('工具消息', 'Tool message')
      : text('最终回答', 'Assistant')

  async function handleCopy() {
    const attachmentText = attachments.length
      ? `\n\n${text('附件', 'Attachments')}:\n${attachments
          .map((attachment, index) => {
            const name = attachment.file_name || text('未命名附件', 'Unnamed attachment')
            const mimeType = attachment.mime_type ? ` (${attachment.mime_type})` : ''
            return `${index + 1}. ${name}${mimeType}`
          })
          .join('\n')}`
      : ''
    await copyTextToClipboard(`${content}${attachmentText}`.trim())
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <article className={isUser ? "message-row message-row-user" : "message-row"}>
      <div className="message-bubble-header">
        <div className="message-bubble-header-main">
          <span className={isUser ? "message-role message-role-user" : "message-role message-role-assistant"}>
            {roleLabel}
          </span>
          {messageTimestamp && <span className="message-time">[{formatIsoTime(messageTimestamp)}]</span>}
        </div>
        <div className="message-actions">
          <button
            aria-label={text('复制消息', 'Copy message')}
            className="message-action-button"
            title={text('复制消息', 'Copy message')}
            type="button"
            onClick={handleCopy}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
          {onDelete ? (
            <button
              aria-label={text('删除消息', 'Delete message')}
              className="message-action-button message-action-button-danger"
              disabled={deleteDisabled}
              title={text('删除消息', 'Delete message')}
              type="button"
              onClick={onDelete}
            >
              <Trash2 size={12} />
            </button>
          ) : null}
        </div>
      </div>
      {skillMessagePayload ? (
        <Suspense fallback={<div className="message-bubble message-bubble-assistant"><div className="message-content font-medium !leading-relaxed whitespace-pre-wrap">{content || ' '}</div></div>}>
          <SkillLoadViewer payload={skillMessagePayload} rawContent={content} />
        </Suspense>
      ) : webSearchPayload ? (
        <Suspense fallback={<div className="message-bubble message-bubble-assistant"><div className="message-content font-medium !leading-relaxed whitespace-pre-wrap">{content || ' '}</div></div>}>
          <WebSearchResultViewer payload={webSearchPayload} rawContent={content} />
        </Suspense>
      ) : toolExecutionPayload ? (
        <Suspense fallback={<div className="message-bubble message-bubble-assistant"><div className="message-content font-medium !leading-relaxed whitespace-pre-wrap">{content || ' '}</div></div>}>
          <ToolExecutionViewer payload={toolExecutionPayload} rawContent={content} timestamp={messageTimestamp} />
        </Suspense>
      ) : toolResultPayload ? (
        <Suspense fallback={<div className="message-bubble message-bubble-assistant"><div className="message-content font-medium !leading-relaxed whitespace-pre-wrap">{content || ' '}</div></div>}>
          <ToolResultViewer payload={toolResultPayload} rawContent={content} />
        </Suspense>
      ) : (
        <div className={isUser ? 'message-bubble message-bubble-user' : 'message-bubble message-bubble-assistant'}>
          {attachments.length ? (
            <div className="message-attachments">
              {attachments.map((attachment, index) => (
                <div className="message-attachment-chip" key={`${attachment.id || attachment.file_name || 'attachment'}:${index}`}>
                  <span className="message-attachment-name">{attachment.file_name || text('未命名附件', 'Unnamed attachment')}</span>
                  <span className="message-attachment-meta">
                    {attachment.kind === 'image' ? text('图片', 'Image') : text('文件', 'File')}
                    {attachment.size_label || formatAttachmentSize(attachment.size_bytes) ? ` · ${attachment.size_label || formatAttachmentSize(attachment.size_bytes)}` : ''}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          {isUser ? (
            <div className="message-content font-medium !leading-relaxed whitespace-pre-wrap">{content || ' '}</div>
          ) : (
            <MarkdownMessage content={content || ' '} previewContext={previewContext} />
          )}
        </div>
      )}
    </article>
  )
}

export const MessageBubble = memo(
  MessageBubbleInner,
  (previous, next) =>
    previous.message === next.message &&
    previous.timestamp === next.timestamp &&
    previous.deleteDisabled === next.deleteDisabled &&
    previous.activePreviewKey === next.activePreviewKey &&
    previous.isPreviewRunning === next.isPreviewRunning &&
    previous.sessionId === next.sessionId &&
    Boolean(previous.onDelete) === Boolean(next.onDelete) &&
    Boolean(previous.onRequestPreview) === Boolean(next.onRequestPreview),
)

function getMessageTimestamp(message: ChatMessage) {
  const timestamp =
    message.timestamp ??
    message.created_at ??
    message.updated_at

  return typeof timestamp === 'string' ? timestamp : undefined
}
