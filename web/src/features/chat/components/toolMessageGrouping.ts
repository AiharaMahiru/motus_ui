import type { ChatMessage } from '../../../shared/api/contracts'


export function toolNameOfMessage(message: ChatMessage) {
  return typeof message.name === 'string' && message.name.trim() ? message.name.trim() : 'tool'
}

export function resolveMessageTimestamp(message: ChatMessage) {
  const timestamp = message.timestamp ?? message.created_at ?? message.updated_at
  return typeof timestamp === 'string' ? timestamp : undefined
}

export function batchToolMessages(messages: ChatMessage[]) {
  const batches: ChatMessage[][] = []
  let currentBatch: ChatMessage[] = []

  for (const message of messages) {
    if (!currentBatch.length) {
      currentBatch = [message]
      continue
    }

    if (toolNameOfMessage(currentBatch[currentBatch.length - 1]) === toolNameOfMessage(message)) {
      currentBatch.push(message)
      continue
    }

    batches.push(currentBatch)
    currentBatch = [message]
  }

  if (currentBatch.length) {
    batches.push(currentBatch)
  }

  return batches
}
