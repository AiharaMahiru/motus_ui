import type {
  GuardrailRule,
  McpServerConfig,
  MemoryConfig,
  ResponseFormatConfig,
  SandboxConfig,
  ToolGuardrailConfig,
} from '../../../../shared/api/contracts'

export type StringListEditorProps = {
  addButtonTestId?: string
  disabled?: boolean
  emptyLabel?: string
  inputTestId?: string
  label: string
  values: string[]
  onChange: (nextValues: string[]) => void
  placeholder?: string
}

export type GuardrailListEditorProps = {
  disabled?: boolean
  label: string
  rules: GuardrailRule[]
  onChange: (rules: GuardrailRule[]) => void
}

export type ToolGuardrailListEditorProps = {
  disabled?: boolean
  rules: ToolGuardrailConfig[]
  onChange: (rules: ToolGuardrailConfig[]) => void
}

export type ResponseFormatEditorProps = {
  disabled?: boolean
  hidden?: boolean
  value: ResponseFormatConfig
  onChange: (nextValue: ResponseFormatConfig) => void
}

export type SandboxEditorProps = {
  disabled?: boolean
  value: SandboxConfig
  onChange: (nextValue: SandboxConfig) => void
}

export type MemoryEditorProps = {
  disabled?: boolean
  value: MemoryConfig
  onChange: (nextValue: MemoryConfig) => void
}

export type McpServerListEditorProps = {
  disabled?: boolean
  servers: McpServerConfig[]
  onChange: (servers: McpServerConfig[]) => void
}

export function toLineText(values: string[]) {
  return values.join('\n')
}

export function fromLineText(text: string) {
  return text
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function mapToLineText(value: Record<string, string>) {
  return Object.entries(value)
    .map(([key, itemValue]) => `${key}=${itemValue}`)
    .join('\n')
}

export function lineTextToMap(text: string) {
  const next: Record<string, string> = {}
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line) {
      continue
    }
    const separatorIndex = line.indexOf('=')
    if (separatorIndex === -1) {
      next[line] = ''
      continue
    }
    const key = line.slice(0, separatorIndex).trim()
    const value = line.slice(separatorIndex + 1).trim()
    if (key) {
      next[key] = value
    }
  }
  return next
}

export function updateItemAtIndex<T>(items: T[], index: number, updater: (item: T) => T) {
  return items.map((item, itemIndex) => (itemIndex === index ? updater(item) : item))
}
