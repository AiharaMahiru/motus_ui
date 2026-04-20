import { z } from 'zod'

import { apiJson, apiRequest } from '../../shared/api/client'
import {
  chatMessageSchema,
  interruptResumeRequestSchema,
  messageResponseSchema,
  sessionCreateRequestSchema,
  sessionMessageDeleteRequestSchema,
  sessionMessageDeleteResponseSchema,
  sessionDetailSchema,
  sessionSummarySchema,
  type InterruptResumeRequest,
  type SessionCreateRequest,
  type SessionMessageDeleteRequest,
  type SessionUpdateRequest,
  sessionUpdateRequestSchema,
} from '../../shared/api/contracts'


export const sessionKeys = {
  all: ['sessions'] as const,
  detail: (sessionId: string) => ['sessions', sessionId, 'detail'] as const,
  messages: (sessionId: string) => ['sessions', sessionId, 'messages'] as const,
}


export function listSessions() {
  return apiRequest('/api/sessions', {
    schema: z.array(sessionSummarySchema),
  })
}


export function getSessionDetail(sessionId: string) {
  return apiRequest(`/api/sessions/${sessionId}`, {
    schema: sessionDetailSchema,
  })
}


export function getSessionMessages(sessionId: string) {
  return apiRequest(`/api/sessions/${sessionId}/messages`, {
    schema: z.array(chatMessageSchema),
  })
}


export function createSession(payload: SessionCreateRequest) {
  return apiJson('/api/sessions', 'POST', sessionCreateRequestSchema.parse(payload), sessionDetailSchema)
}

export function updateSession(sessionId: string, payload: SessionUpdateRequest) {
  return apiJson(
    `/api/sessions/${sessionId}`,
    'PATCH',
    sessionUpdateRequestSchema.parse(payload),
    sessionDetailSchema,
  )
}


export function deleteSession(sessionId: string) {
  return apiRequest<void>(`/api/sessions/${sessionId}`, {
    method: 'DELETE',
  })
}

export function deleteSessionMessages(sessionId: string, payload: SessionMessageDeleteRequest) {
  return apiJson(
    `/api/sessions/${sessionId}/messages/delete`,
    'POST',
    sessionMessageDeleteRequestSchema.parse(payload),
    sessionMessageDeleteResponseSchema,
  )
}

export function resumeSessionInterrupt(sessionId: string, payload: InterruptResumeRequest) {
  return apiJson(
    `/api/sessions/${sessionId}/resume`,
    'POST',
    interruptResumeRequestSchema.parse(payload),
    messageResponseSchema,
  )
}
