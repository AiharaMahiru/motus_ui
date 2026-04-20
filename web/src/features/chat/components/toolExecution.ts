export type ToolExecutionStatus = 'running' | 'completed' | 'failed'

export type ToolExecutionTask = {
  content: string
  status?: string
  activeOrm?: string
  timestamp?: string
  detail?: string
}

export type ToolExecutionPayload = {
  toolName: string
  status: ToolExecutionStatus
  tasks: ToolExecutionTask[]
  raw: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringifyValue(value: unknown) {
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (value == null) {
    return ''
  }
  return JSON.stringify(value, null, 2)
}

function pickString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) {
      return value
    }
  }
  return undefined
}

function omitKnownFields(record: Record<string, unknown>) {
  const ignored = new Set([
    'content',
    'title',
    'description',
    'name',
    'status',
    'active_orm',
    'activeOrm',
    'command',
    'action',
    'url',
    'timestamp',
    'created_at',
    'updated_at',
  ])

  return Object.fromEntries(Object.entries(record).filter(([key]) => !ignored.has(key)))
}

function normalizeTask(value: unknown, index: number): ToolExecutionTask {
  if (!isRecord(value)) {
    return {
      content: stringifyValue(value) || `任务 ${index + 1}`,
    }
  }

  const content =
    pickString(value, ['content', 'title', 'description', 'name', 'url']) ||
    `任务 ${index + 1}`
  const activeOrm = pickString(value, ['active_orm', 'activeOrm', 'command', 'action', 'url'])
  const timestamp = pickString(value, ['timestamp', 'created_at', 'updated_at'])
  const status = pickString(value, ['status'])
  const extra = omitKnownFields(value)

  return {
    content,
    status,
    activeOrm,
    timestamp,
    detail: Object.keys(extra).length ? JSON.stringify(extra, null, 2) : undefined,
  }
}

function collectTasks(value: unknown): ToolExecutionTask[] {
  if (Array.isArray(value)) {
    return value.map((item, index) => normalizeTask(item, index))
  }

  if (isRecord(value)) {
    if ('content' in value || 'active_orm' in value || 'activeOrm' in value) {
      return [normalizeTask(value, 0)]
    }

    const nestedTasks = Object.entries(value).flatMap(([key, nestedValue]) => {
      if (!Array.isArray(nestedValue)) {
        return []
      }
      return nestedValue.map((item, index) => {
        const task = normalizeTask(item, index)
        return {
          ...task,
          content: task.content || key,
        }
      })
    })

    if (nestedTasks.length > 0) {
      return nestedTasks
    }

    return Object.entries(value).map(([key, nestedValue], index) =>
      normalizeTask(
        {
          content: key,
          active_orm: stringifyValue(nestedValue),
        },
        index,
      ),
    )
  }

  return [normalizeTask(value, 0)]
}

function inferToolName(value: unknown) {
  if (Array.isArray(value) && value.some((item) => isRecord(item) && ('active_orm' in item || 'status' in item))) {
    return 'to_do'
  }

  if (isRecord(value)) {
    const explicitName = pickString(value, ['tool_name', 'tool', 'name'])
    if (explicitName) {
      return explicitName
    }
    if ('web' in value || 'news' in value || 'images' in value) {
      return 'web_search'
    }
  }

  return 'tool'
}

function inferStatus(tasks: ToolExecutionTask[]): ToolExecutionStatus {
  const normalizedStatuses = tasks.map((task) => task.status?.toLowerCase() ?? '')
  if (normalizedStatuses.some((status) => status.includes('error') || status.includes('fail'))) {
    return 'failed'
  }
  if (normalizedStatuses.some((status) => status.includes('progress') || status.includes('running') || status.includes('pending'))) {
    return 'running'
  }
  return 'completed'
}

export function parseToolExecutionPayload(content: string): ToolExecutionPayload | null {
  const trimmed = content.trim()
  if (!trimmed || !/^[[{]/.test(trimmed)) {
    return null
  }

  try {
    const raw = JSON.parse(trimmed) as unknown
    if (Array.isArray(raw)) {
      const tasks = collectTasks(raw)
      return {
        raw,
        tasks,
        toolName: inferToolName(raw),
        status: inferStatus(tasks),
      }
    }
    if (
      !isRecord(raw) ||
      !(
        'web' in raw ||
        'news' in raw ||
        'images' in raw ||
        'content' in raw ||
        'active_orm' in raw ||
        'activeOrm' in raw ||
        'status' in raw ||
        'tool_name' in raw ||
        'tool' in raw ||
        'name' in raw
      )
    ) {
      return null
    }
    const tasks = collectTasks(raw)
    return {
      raw,
      tasks,
      toolName: inferToolName(raw),
      status: inferStatus(tasks),
    }
  } catch {
    return null
  }
}
