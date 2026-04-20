import { useQuery } from '@tanstack/react-query'

import { summarizeToolMessage } from '../api'


function hashString(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0
  }
  return String(hash >>> 0)
}

export function useToolMessageSummary(
  toolName: string,
  content: string,
  fallback?: string,
  enabled = true,
) {
  const normalizedContent = content.trim()
  return useQuery({
    queryKey: ['tool-message-summary', toolName, hashString(normalizedContent)],
    queryFn: () => summarizeToolMessage({ tool_name: toolName, content: normalizedContent }),
    enabled: Boolean(toolName && normalizedContent && enabled),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
    retry: 0,
    select: (result) => result.summary || fallback || '',
  })
}
