import { apiRequest } from '../../shared/api/client'
import { appMetaSchema } from '../../shared/api/contracts'


export const metaKeys = {
  all: ['meta'] as const,
}


export function getMeta() {
  return apiRequest('/api/meta', {
    schema: appMetaSchema,
  })
}
