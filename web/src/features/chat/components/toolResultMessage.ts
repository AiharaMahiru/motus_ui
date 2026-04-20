import type { ChatMessage } from '../../../shared/api/contracts'


export type ToolResultPayload = {
  toolName: string
  status: 'info' | 'success' | 'error'
  summary: string
  content: string
}

function stripWrappedQuotes(value: string) {
  return value.replace(/^"+|"+$/g, '').trim()
}

function firstMeaningfulLine(content: string) {
  return (
    content
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean) || '工具返回结果'
  )
}

export function parseToolResultMessage(message: ChatMessage, content: string): ToolResultPayload | null {
  if (message.role !== 'tool') {
    return null
  }

  const toolName = typeof message.name === 'string' && message.name.trim() ? message.name.trim() : 'tool'
  const normalizedContent = stripWrappedQuotes(content)
  if (!normalizedContent) {
    return null
  }

  const lowered = normalizedContent.toLowerCase()
  const status =
    lowered.includes('failed') || lowered.includes('error') || lowered.includes('not ready')
      ? 'error'
      : lowered.startsWith('created:') || lowered.startsWith('added ') || lowered.startsWith('updated ')
        ? 'success'
        : 'info'

  return {
    content: normalizedContent,
    status,
    summary: firstMeaningfulLine(normalizedContent),
    toolName,
  }
}
