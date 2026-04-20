import type { ChatMessage } from '../api/contracts'
import { getRuntimeLocale } from '../i18n/runtimeLocale'


export function formatIsoTime(value?: string | null) {
  if (!value) {
    return '暂无'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(getRuntimeLocale(), {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}


export function formatIsoDateTime(value?: string | null) {
  if (!value) {
    return '暂无'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(getRuntimeLocale(), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}


export function formatCost(value?: number | null) {
  if (typeof value !== 'number') {
    return getRuntimeLocale() === 'zh-CN' ? '未计价' : 'Unpriced'
  }

  const fractionDigits = Math.abs(value) < 0.0001 && value !== 0 ? 6 : 4
  return new Intl.NumberFormat(getRuntimeLocale(), {
    currency: 'USD',
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
    style: 'currency',
  })
    .format(value)
    .replace(/^US\$/, '$')
}


export function formatUsageCount(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString(getRuntimeLocale()) : '0'
}

export function formatCompactUsageCount(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '0'
  }

  const absoluteValue = Math.abs(value)
  if (absoluteValue >= 1_000_000) {
    return `${trimTrailingZero(value / 1_000_000)}M`
  }
  if (absoluteValue >= 1_000) {
    return `${trimTrailingZero(value / 1_000)}K`
  }
  return value.toLocaleString(getRuntimeLocale())
}


function trimTrailingZero(value: number) {
  return value.toFixed(1).replace(/\.0$/, '')
}


export function formatUsageSummary(usage: Record<string, unknown>) {
  const keys = ['total_tokens', 'prompt_tokens', 'completion_tokens']
  const summary = keys
    .filter((key) => key in usage)
    .map((key) => `${key}=${formatUsageCount(usage[key])}`)
  return summary.length ? summary.join(' / ') : getRuntimeLocale() === 'zh-CN' ? '暂无 usage' : 'No usage yet'
}


export function renderMessageContent(message?: ChatMessage | null) {
  const content = message?.content
  if (typeof content === 'string') {
    // API 已经返回了解析后的字符串；这里不能再次反转义，
    // 否则代码块中的 "\\n"、"\\t" 会被改写成真实控制字符，直接破坏可运行代码。
    return content
  }
  if (Array.isArray(content)) {
    return JSON.stringify(content, null, 2)
  }
  return ''
}


export function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2)
}
