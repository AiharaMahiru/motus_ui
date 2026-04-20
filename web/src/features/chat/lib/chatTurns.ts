import type { StepGroup } from '../../../shared/lib/storage'
import { parseTodoToolCall, isTodoToolMessage } from '../components/todoMessage'
import type { ChatTurn, IndexedChatMessage, QueuedComposerMessage } from '../pages/chatPageTypes'
import type { ComposerAttachment } from '../attachments'

export function buildTurns(messages: IndexedChatMessage[]) {
  const turns: ChatTurn[] = []
  let currentTurn: ChatTurn | null = null

  for (const message of messages) {
    if (message.role === 'user') {
      if (currentTurn) {
        turns.push(currentTurn)
      }
      currentTurn = {
        user: message,
        toolMessages: [],
        assistants: [],
      }
      continue
    }

    if (isTodoToolMessage(message)) {
      continue
    }

    if (message.role === 'tool') {
      if (!currentTurn) {
        currentTurn = {
          toolMessages: [message],
          assistants: [],
        }
      } else {
        currentTurn.toolMessages.push(message)
      }
      continue
    }

    if (!currentTurn) {
      currentTurn = {
        toolMessages: [],
        assistants: [message],
      }
    } else {
      currentTurn.assistants.push(message)
    }
  }

  if (currentTurn) {
    turns.push(currentTurn)
  }

  return turns
}

export function hasRenderableStepGroup(group?: StepGroup) {
  if (!group) {
    return false
  }

  return group.steps.some((step) => {
    if (step.content?.trim()) {
      return true
    }

    return step.toolCalls.some((toolCall) => !parseTodoToolCall(toolCall)?.length)
  })
}

export function createQueuedComposerMessage(content: string, attachments: ComposerAttachment[]): QueuedComposerMessage {
  return {
    attachments,
    content,
    id: `${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
  }
}
