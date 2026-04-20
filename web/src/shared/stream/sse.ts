import { z } from 'zod'

import {
  chatMessageSchema,
  interruptInfoSchema,
  turnMetricsSchema,
  usageSchema,
} from '../api/contracts'


const toolCallSchema = z.record(z.string(), z.unknown())

export const sessionStartedEventSchema = z.object({
  session_id: z.string(),
  content: z.string().optional(),
  timestamp: z.string(),
})

export const assistantStepEventSchema = z.object({
  session_id: z.string(),
  agent_name: z.string().optional(),
  content: z.string().nullable().optional(),
  tool_calls: z.array(toolCallSchema).default([]),
  turn_usage: usageSchema.optional(),
  session_usage: usageSchema.optional(),
  turn_cost_usd: z.number().nullable().optional(),
  session_cost_usd: z.number().nullable().optional(),
  timestamp: z.string(),
})

export const assistantFinalEventSchema = z.object({
  session_id: z.string(),
  assistant: chatMessageSchema.optional(),
  metrics: turnMetricsSchema.optional(),
  timestamp: z.string(),
})

export const sessionTelemetryEventSchema = z.object({
  session_id: z.string(),
  metrics: turnMetricsSchema,
  timestamp: z.string(),
})

export const sessionInterruptedEventSchema = z.object({
  session_id: z.string(),
  interrupt: interruptInfoSchema.optional(),
  interrupts: z.array(interruptInfoSchema).default([]),
  metrics: turnMetricsSchema.nullable().optional(),
  timestamp: z.string(),
})

export const sessionErrorEventSchema = z.object({
  session_id: z.string(),
  message: z.string(),
  timestamp: z.string(),
})

export const doneEventSchema = z.object({
  session_id: z.string(),
  timestamp: z.string(),
})

export type ParsedSseEvent =
  | { event: 'session.started'; data: z.infer<typeof sessionStartedEventSchema> }
  | { event: 'assistant.step'; data: z.infer<typeof assistantStepEventSchema> }
  | { event: 'assistant.final'; data: z.infer<typeof assistantFinalEventSchema> }
  | { event: 'session.telemetry'; data: z.infer<typeof sessionTelemetryEventSchema> }
  | { event: 'session.interrupted'; data: z.infer<typeof sessionInterruptedEventSchema> }
  | { event: 'session.error'; data: z.infer<typeof sessionErrorEventSchema> }
  | { event: 'done'; data: z.infer<typeof doneEventSchema> }


const eventSchemaMap = {
  'session.started': sessionStartedEventSchema,
  'assistant.step': assistantStepEventSchema,
  'assistant.final': assistantFinalEventSchema,
  'session.telemetry': sessionTelemetryEventSchema,
  'session.interrupted': sessionInterruptedEventSchema,
  'session.error': sessionErrorEventSchema,
  done: doneEventSchema,
} as const


export function extractSseFrames(input: string) {
  const normalized = input.replace(/\r\n/g, '\n')
  const chunks = normalized.split('\n\n')
  const remainder = chunks.pop() ?? ''
  const frames = chunks.filter((item) => item.trim().length > 0)
  return { frames, remainder }
}


export function parseSseFrame(frame: string): ParsedSseEvent | null {
  let eventName = ''
  const dataLines: string[] = []

  for (const rawLine of frame.split('\n')) {
    const line = rawLine.trim()
    if (!line) {
      continue
    }
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim()
      continue
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim())
    }
  }

  if (!eventName || !(eventName in eventSchemaMap)) {
    return null
  }

  const payload = dataLines.length ? JSON.parse(dataLines.join('\n')) : {}
  const schema = eventSchemaMap[eventName as keyof typeof eventSchemaMap]
  return {
    event: eventName as ParsedSseEvent['event'],
    data: schema.parse(payload),
  } as ParsedSseEvent
}


async function streamSseRequest(
  path: string,
  requestInit: RequestInit,
  onEvent: (event: ParsedSseEvent) => void,
) {
  const response = await fetch(path, requestInit)

  if (!response.ok) {
    const fallbackMessage = `${response.status} ${response.statusText}`
    let detail = fallbackMessage
    try {
      const payload = (await response.json()) as { detail?: string }
      if (payload.detail) {
        detail = payload.detail
      }
    } catch {
      // 保持 fallback 文本即可。
    }
    throw new Error(detail)
  }

  if (!response.body) {
    throw new Error('浏览器没有返回可读的 SSE 流')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const { frames, remainder } = extractSseFrames(buffer)
    buffer = remainder

    for (const frame of frames) {
      const parsedEvent = parseSseFrame(frame)
      if (parsedEvent) {
        onEvent(parsedEvent)
      }
    }
  }

  const trailing = buffer.trim()
  if (trailing) {
    const parsedEvent = parseSseFrame(trailing)
    if (parsedEvent) {
      onEvent(parsedEvent)
    }
  }
}


export async function streamSessionMessage(
  sessionId: string,
  payload: {
    content: string
    files?: File[]
  },
  onEvent: (event: ParsedSseEvent) => void,
) {
  const requestInit: RequestInit = {
    method: 'POST',
  }

  if (payload.files?.length) {
    const formData = new FormData()
    formData.set('content', payload.content)
    for (const file of payload.files) {
      formData.append('files', file)
    }
    requestInit.body = formData
  } else {
    requestInit.headers = {
      'Content-Type': 'application/json',
    }
    requestInit.body = JSON.stringify({ content: payload.content })
  }

  await streamSseRequest(`/api/sessions/${sessionId}/messages/stream`, requestInit, onEvent)
}


export async function streamSessionResume(
  sessionId: string,
  payload: {
    interrupt_id: string
    value: Record<string, unknown>
  },
  onEvent: (event: ParsedSseEvent) => void,
) {
  await streamSseRequest(
    `/api/sessions/${sessionId}/resume/stream`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
    onEvent,
  )
}
