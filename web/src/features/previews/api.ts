import { apiJson, apiRequest } from '../../shared/api/client'
import {
  type PreviewTerminalInputRequest,
  type PreviewTerminalResizeRequest,
  type PreviewRunRequest,
  previewTerminalInputRequestSchema,
  previewTerminalResizeRequestSchema,
  previewRunRequestSchema,
  previewRunResponseSchema,
} from '../../shared/api/contracts'


export function runSessionPreview(sessionId: string, payload: PreviewRunRequest) {
  return apiJson(
    `/api/sessions/${sessionId}/preview-runs`,
    'POST',
    previewRunRequestSchema.parse(payload),
    previewRunResponseSchema,
  )
}


export function getSessionPreviewRun(sessionId: string, runId: string) {
  return apiRequest(
    `/api/sessions/${sessionId}/preview-runs/${runId}`,
    {
      schema: previewRunResponseSchema,
    },
  )
}


export function sendSessionPreviewTerminalInput(
  sessionId: string,
  runId: string,
  payload: PreviewTerminalInputRequest,
) {
  return apiJson(
    `/api/sessions/${sessionId}/preview-runs/${runId}/terminal-input`,
    'POST',
    previewTerminalInputRequestSchema.parse(payload),
    previewRunResponseSchema,
  )
}


export function terminateSessionPreviewRun(sessionId: string, runId: string) {
  return apiRequest(
    `/api/sessions/${sessionId}/preview-runs/${runId}/terminate`,
    {
      method: 'POST',
      schema: previewRunResponseSchema,
    },
  )
}


export function resizeSessionPreviewTerminal(
  sessionId: string,
  runId: string,
  payload: PreviewTerminalResizeRequest,
) {
  return apiJson(
    `/api/sessions/${sessionId}/preview-runs/${runId}/resize`,
    'POST',
    previewTerminalResizeRequestSchema.parse(payload),
    previewRunResponseSchema,
  )
}
