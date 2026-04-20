import type { ZodType } from 'zod'


export class ApiError extends Error {
  readonly status: number
  readonly detail: string
  readonly payload: unknown

  constructor(status: number, detail: string, payload: unknown) {
    super(detail)
    this.status = status
    this.detail = detail
    this.payload = payload
  }
}


type RequestOptions<T> = Omit<RequestInit, 'body'> & {
  body?: BodyInit | null
  schema?: ZodType<T>
}


async function parseResponseBody(response: Response): Promise<unknown> {
  const rawText = await response.text()
  if (!rawText) {
    return null
  }

  try {
    return JSON.parse(rawText)
  } catch {
    return rawText
  }
}


function extractErrorDetail(payload: unknown, fallbackMessage: string) {
  if (typeof payload === 'string' && payload.trim()) {
    return payload
  }
  if (
    payload &&
    typeof payload === 'object' &&
    'detail' in payload &&
    typeof (payload as { detail?: unknown }).detail === 'string'
  ) {
    return (payload as { detail: string }).detail
  }
  return fallbackMessage
}


export async function apiRequest<T>(path: string, options: RequestOptions<T> = {}) {
  const response = await fetch(path, options)
  const payload = await parseResponseBody(response)

  if (!response.ok) {
    throw new ApiError(
      response.status,
      extractErrorDetail(payload, `${response.status} ${response.statusText}`),
      payload,
    )
  }

  if (!options.schema) {
    return payload as T
  }
  return options.schema.parse(payload)
}


export async function apiJson<TBody extends object, TResult>(
  path: string,
  method: 'POST' | 'PUT' | 'PATCH',
  body: TBody,
  schema?: ZodType<TResult>,
) {
  return apiRequest<TResult>(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    schema,
  })
}
