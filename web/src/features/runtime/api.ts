import { apiRequest } from '../../shared/api/client'
import {
  runtimeRequirementsResponseSchema,
  runtimeToolCatalogSchema,
  workflowCatalogResponseSchema,
} from '../../shared/api/contracts'


export const runtimeKeys = {
  requirements: ['runtime', 'requirements'] as const,
  toolCatalog: ['runtime', 'tool-catalog'] as const,
  workflowCatalog: ['runtime', 'workflow-catalog'] as const,
}


export function getRuntimeRequirements() {
  return apiRequest('/api/runtime/requirements', {
    schema: runtimeRequirementsResponseSchema,
  })
}

export function getRuntimeToolCatalog() {
  return apiRequest('/api/runtime/tools', {
    schema: runtimeToolCatalogSchema,
  })
}

export function getRuntimeWorkflowCatalog() {
  return apiRequest('/api/runtime/workflow-catalog', {
    schema: workflowCatalogResponseSchema,
  })
}
