import type { ChatMessage } from '../../../shared/api/contracts'
import { renderMessageContent } from '../../../shared/lib/format'


export type AssistantDisplayItem<TMessage extends ChatMessage = ChatMessage> =
  | {
      message: TMessage
      type: 'message'
    }
  | {
      messages: TMessage[]
      type: 'tool-group'
    }

function isRedundantStreamId(content: string) {
  return content.startsWith('WEBUI_STREAM_') && !content.includes('\n')
}

function isRenderableMessage(message: ChatMessage) {
  const content = renderMessageContent(message).trim()
  return content.length > 0 && !isRedundantStreamId(content)
}

function isToolMessage(message: ChatMessage) {
  return message.role === 'tool' && isRenderableMessage(message)
}

export function groupConsecutiveAssistantMessages<TMessage extends ChatMessage>(messages: TMessage[]): AssistantDisplayItem<TMessage>[] {
  const grouped: AssistantDisplayItem<TMessage>[] = []
  let toolMessages: TMessage[] = []

  function flushTools() {
    if (toolMessages.length === 0) {
      return
    }
    if (toolMessages.length === 1) {
      grouped.push({
        type: 'message',
        message: toolMessages[0],
      })
    } else {
      grouped.push({
        type: 'tool-group',
        messages: [...toolMessages],
      })
    }
    toolMessages = []
  }

  for (const message of messages) {
    if (!isRenderableMessage(message)) {
      continue
    }

    if (isToolMessage(message)) {
      toolMessages.push(message)
      continue
    }

    flushTools()
    grouped.push({
      type: 'message',
      message,
    })
  }

  flushTools()
  return grouped
}
