import type { ChatMessage } from '../../../shared/api/contracts'
import type { StepGroup } from '../../../shared/lib/storage'


export type TodoItem = {
  activeForm?: string
  content: string
  status: string
}

type ToolCallLike = Record<string, unknown>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseTodoArray(value: unknown): TodoItem[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter(isRecord)
    .map((item) => ({
      activeForm:
        typeof item.activeForm === 'string'
          ? item.activeForm
          : typeof item.active_orm === 'string'
            ? item.active_orm
            : undefined,
      content: typeof item.content === 'string' ? item.content : '',
      status: typeof item.status === 'string' ? item.status : 'pending',
    }))
    .filter((item) => item.content.trim().length > 0)
}

export function parseTodoToolMessage(message: ChatMessage, content: string): TodoItem[] | null {
  if (message.role !== 'tool' || message.name !== 'to_do') {
    return null
  }

  try {
    return parseTodoArray(JSON.parse(content))
  } catch {
    return null
  }
}

function extractToolCallName(toolCall: ToolCallLike) {
  const nested = toolCall.function
  if (isRecord(nested) && typeof nested.name === 'string') {
    return nested.name
  }
  return typeof toolCall.name === 'string' ? toolCall.name : undefined
}

function extractToolCallArguments(toolCall: ToolCallLike) {
  const nested = toolCall.function
  if (isRecord(nested) && typeof nested.arguments === 'string') {
    return nested.arguments
  }
  return typeof toolCall.arguments === 'string' ? toolCall.arguments : undefined
}

export function parseTodoToolCall(toolCall: ToolCallLike): TodoItem[] | null {
  if (extractToolCallName(toolCall) !== 'to_do') {
    return null
  }

  const rawArguments = extractToolCallArguments(toolCall)
  if (!rawArguments) {
    return null
  }

  try {
    const parsedArguments = JSON.parse(rawArguments) as unknown
    if (!isRecord(parsedArguments)) {
      return null
    }
    return parseTodoArray(parsedArguments.todos)
  } catch {
    return null
  }
}

export function isTodoToolMessage(message: ChatMessage) {
  return message.role === 'tool' && message.name === 'to_do'
}

export function resolveTodoItems(messages: ChatMessage[], stepGroups: StepGroup[], liveGroup?: StepGroup) {
  if (liveGroup) {
    for (const step of [...liveGroup.steps].reverse()) {
      for (const toolCall of [...step.toolCalls].reverse()) {
        const todoItems = parseTodoToolCall(toolCall)
        if (todoItems?.length) {
          return todoItems
        }
      }
    }
  }

  for (const message of [...messages].reverse()) {
    const todoItems = parseTodoToolMessage(message, typeof message.content === 'string' ? message.content : '')
    if (todoItems?.length) {
      return todoItems
    }
  }

  for (const group of [...stepGroups].reverse()) {
    for (const step of [...group.steps].reverse()) {
      for (const toolCall of [...step.toolCalls].reverse()) {
        const todoItems = parseTodoToolCall(toolCall)
        if (todoItems?.length) {
          return todoItems
        }
      }
    }
  }

  return [] as TodoItem[]
}
