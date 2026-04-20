import { z } from 'zod'

import { apiJson, apiRequest } from '../../shared/api/client'
import {
  workflowDefinitionSummarySchema,
  workflowPlannerRequestSchema,
  workflowPlannerResponseSchema,
  workflowRunControlRequestSchema,
  workflowRunDetailSchema,
  workflowRunRequestSchema,
  workflowRunSummarySchema,
} from '../../shared/api/contracts'


export const workflowKeys = {
  definitions: ['workflows', 'definitions'] as const,
  plans: ['workflows', 'plans'] as const,
  runs: ['workflows', 'runs'] as const,
  detail: (runId: string) => ['workflows', 'runs', runId] as const,
}


export function listWorkflowDefinitions() {
  return apiRequest('/api/workflows', {
    schema: z.array(workflowDefinitionSummarySchema),
  })
}


export function listWorkflowRuns() {
  return apiRequest('/api/workflows/runs', {
    schema: z.array(workflowRunSummarySchema),
  })
}


export function planWorkflowRun(payload: { goal: string }) {
  return apiJson(
    '/api/workflows/plans',
    'POST',
    workflowPlannerRequestSchema.parse(payload),
    workflowPlannerResponseSchema,
  )
}


export function startAgentWorkflowRun(payload: { goal: string }) {
  return apiJson(
    '/api/workflows/agent-runs',
    'POST',
    workflowPlannerRequestSchema.parse(payload),
    workflowRunDetailSchema,
  )
}


export function startWorkflowRun(payload: {
  workflow_name: string
  input_payload: Record<string, unknown>
  runtime: {
    timeout_seconds?: number | null
    max_retries: number
    retry_delay_seconds: number
  }
}) {
  return apiJson(
    '/api/workflows/runs',
    'POST',
    workflowRunRequestSchema.parse(payload),
    workflowRunDetailSchema,
  )
}


export function getWorkflowRunDetail(runId: string) {
  return apiRequest(`/api/workflows/runs/${runId}`, {
    schema: workflowRunDetailSchema,
  })
}

export function cancelWorkflowRun(runId: string, reason?: string) {
  return apiJson(
    `/api/workflows/runs/${runId}/cancel`,
    'POST',
    workflowRunControlRequestSchema.parse({
      reason: reason ?? null,
    }),
    workflowRunDetailSchema,
  )
}

export function terminateWorkflowRun(runId: string, reason?: string) {
  return apiJson(
    `/api/workflows/runs/${runId}/terminate`,
    'POST',
    workflowRunControlRequestSchema.parse({
      reason: reason ?? null,
    }),
    workflowRunDetailSchema,
  )
}
