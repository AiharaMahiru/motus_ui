import { apiJson } from '../../shared/api/client'
import {
  toolMessageSummaryRequestSchema,
  toolMessageSummaryResponseSchema,
} from '../../shared/api/contracts'


export function summarizeToolMessage(payload: { tool_name: string; content: string }) {
  return apiJson(
    '/api/tool-messages/summaries',
    'POST',
    toolMessageSummaryRequestSchema.parse(payload),
    toolMessageSummaryResponseSchema,
  )
}
