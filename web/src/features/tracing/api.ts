import { apiJson, apiRequest } from '../../shared/api/client'
import { traceExportResultSchema, tracingStatusSchema } from '../../shared/api/contracts'


export const tracingKeys = {
  runtime: ['tracing', 'runtime'] as const,
  session: (sessionId: string) => ['tracing', 'session', sessionId] as const,
  workflow: (runId: string) => ['tracing', 'workflow', runId] as const,
}


export function getRuntimeTracingStatus() {
  return apiRequest('/api/tracing', {
    schema: tracingStatusSchema,
  })
}


export function exportRuntimeTrace() {
  return apiJson('/api/tracing/export', 'POST', {}, traceExportResultSchema)
}


export function getSessionTracingStatus(sessionId: string) {
  return apiRequest(`/api/sessions/${sessionId}/tracing`, {
    schema: tracingStatusSchema,
  })
}


export function exportSessionTrace(sessionId: string) {
  return apiJson(`/api/sessions/${sessionId}/tracing/export`, 'POST', {}, traceExportResultSchema)
}


export function getWorkflowTracingStatus(runId: string) {
  return apiRequest(`/api/workflows/runs/${runId}/tracing`, {
    schema: tracingStatusSchema,
  })
}


export function exportWorkflowTrace(runId: string) {
  return apiJson(`/api/workflows/runs/${runId}/tracing/export`, 'POST', {}, traceExportResultSchema)
}
