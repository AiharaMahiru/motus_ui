import type { ChatMessage } from '../../../shared/api/contracts'


export type WebSearchResultItem = {
  description?: string
  title: string
  url: string
}

export type WebSearchMessagePayload = {
  raw: unknown
  results: WebSearchResultItem[]
  toolName: string
}

export function parseWebSearchMessage(message: ChatMessage, content: string): WebSearchMessagePayload | null {
  const toolName = typeof message.name === 'string' ? message.name : undefined
  if (toolName !== 'web_search') {
    return null
  }

  try {
    const payload = JSON.parse(content) as unknown
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return null
    }

    const webItems = (payload as { web?: unknown }).web
    if (!Array.isArray(webItems)) {
      return null
    }

    const results = webItems
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
      .map((item) => ({
        title: String(item.title ?? '').trim(),
        url: String(item.url ?? '').trim(),
        description: String(item.description ?? '').trim() || undefined,
      }))
      .filter((item) => item.title && item.url)

    return {
      raw: payload,
      results,
      toolName: toolName || 'web_search',
    }
  } catch {
    return null
  }
}
