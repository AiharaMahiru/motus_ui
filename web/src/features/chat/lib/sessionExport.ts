import type { ChatMessage, SessionSummary } from '../../../shared/api/contracts'
import { formatIsoDateTime, renderMessageContent } from '../../../shared/lib/format'

export function sessionExportTitle(session?: SessionSummary | null) {
  return session?.title?.trim() || `session-${session?.session_id?.slice(0, 8) || 'draft'}`
}

export function normalizeExportFileName(value: string) {
  const trimmed = value.trim() || 'session'
  return trimmed.replace(/[<>:"/\\|?*\u0000-\u001F]+/g, '-')
}

export function downloadMarkdownFile(fileName: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

function exportMessageContent(message: ChatMessage) {
  const userParams = typeof message.user_params === 'object' && message.user_params ? (message.user_params as Record<string, unknown>) : undefined
  const displayContent =
    typeof userParams?.display_content === 'string'
      ? userParams.display_content
      : renderMessageContent(message)

  const attachments = Array.isArray(userParams?.attachments)
    ? userParams.attachments
        .map((item) => {
          if (!item || typeof item !== 'object') {
            return null
          }
          const record = item as Record<string, unknown>
          const fileName = typeof record.file_name === 'string' ? record.file_name : '附件'
          const sizeLabel = typeof record.size_label === 'string' ? record.size_label : ''
          return sizeLabel ? `- ${fileName} (${sizeLabel})` : `- ${fileName}`
        })
        .filter((item): item is string => Boolean(item))
    : []

  const toolCalls = Array.isArray(message.tool_calls)
    ? message.tool_calls
        .map((toolCall) => {
          if (!toolCall || typeof toolCall !== 'object') {
            return null
          }
          const record = toolCall as Record<string, unknown>
          const fn = typeof record.function === 'object' && record.function ? (record.function as Record<string, unknown>) : undefined
          const name = typeof fn?.name === 'string' ? fn.name : typeof record.name === 'string' ? record.name : 'unknown_tool'
          return `- \`${name}\``
        })
        .filter((item): item is string => Boolean(item))
    : []

  const blocks: string[] = []
  if (displayContent.trim()) {
    blocks.push(displayContent.trim())
  }
  if (attachments.length) {
    blocks.push(`附件：\n${attachments.join('\n')}`)
  }
  if (toolCalls.length) {
    blocks.push(`工具调用：\n${toolCalls.join('\n')}`)
  }

  if (message.role === 'tool') {
    const toolName = typeof message.name === 'string' ? message.name : 'tool'
    return blocks.length
      ? `#### 工具 \`${toolName}\`\n\n\`\`\`text\n${blocks.join('\n\n')}\n\`\`\``
      : `#### 工具 \`${toolName}\``
  }

  const heading =
    message.role === 'user'
      ? '用户'
      : message.role === 'assistant'
        ? '助手'
        : message.role || '消息'

  return `### ${heading}\n\n${blocks.length ? blocks.join('\n\n') : '_空消息_'}`.trim()
}

export function buildSessionMarkdownExport(session: SessionSummary, messages: ChatMessage[]) {
  const sections = [
    `# ${sessionExportTitle(session)}`,
    `- 会话 ID：\`${session.session_id}\``,
    `- 模型：\`${session.model_name}\``,
    `- 状态：\`${session.status}\``,
    `- 导出时间：${formatIsoDateTime(new Date().toISOString())}`,
    `- 更新时间：${formatIsoDateTime(session.updated_at)}`,
    '',
    '## 对话记录',
    '',
  ]

  messages.forEach((message, index) => {
    sections.push(`## ${index + 1}`)
    sections.push('')
    sections.push(exportMessageContent(message))
    sections.push('')
  })

  return sections.join('\n')
}
