export type StepEntry = {
  agentName?: string
  content?: string | null
  toolCalls: Array<Record<string, unknown>>
  timestamp: string
}

export type StepGroup = {
  turnId: string
  userContent: string
  createdAt: string
  completedAt?: string
  finalContent?: string
  errorMessage?: string
  steps: StepEntry[]
}

const STEP_GROUPS_KEY_PREFIX = 'motus-agent:web:step-groups:'
const SESSION_PREVIEW_KEY_PREFIX = 'motus-agent:web:session-preview:'
const LAST_SESSION_KEY = 'motus-agent:web:last-session-id'
const LAST_WORKFLOW_RUN_KEY = 'motus-agent:web:last-workflow-run-id'

export type StoredSessionPreview = {
  request: {
    code: string
    key: string
    language: string
    sessionId: string
  }
  runId?: string
}


function safeRead<T>(key: string, fallback: T) {
  try {
    const rawValue = window.localStorage.getItem(key)
    return rawValue ? (JSON.parse(rawValue) as T) : fallback
  } catch {
    return fallback
  }
}


export function loadStepGroups(sessionId: string | undefined) {
  if (!sessionId) {
    return [] as StepGroup[]
  }
  return safeRead<StepGroup[]>(`${STEP_GROUPS_KEY_PREFIX}${sessionId}`, [])
}


export function saveStepGroups(sessionId: string, groups: StepGroup[]) {
  window.localStorage.setItem(`${STEP_GROUPS_KEY_PREFIX}${sessionId}`, JSON.stringify(groups))
}

export function clearStepGroups(sessionId: string) {
  window.localStorage.removeItem(`${STEP_GROUPS_KEY_PREFIX}${sessionId}`)
}


export function loadSessionPreview(sessionId: string | undefined) {
  if (!sessionId) {
    return undefined as StoredSessionPreview | undefined
  }
  return safeRead<StoredSessionPreview | undefined>(`${SESSION_PREVIEW_KEY_PREFIX}${sessionId}`, undefined)
}


export function saveSessionPreview(sessionId: string, preview: StoredSessionPreview) {
  window.localStorage.setItem(`${SESSION_PREVIEW_KEY_PREFIX}${sessionId}`, JSON.stringify(preview))
}


export function clearSessionPreview(sessionId: string) {
  window.localStorage.removeItem(`${SESSION_PREVIEW_KEY_PREFIX}${sessionId}`)
}


export function readLastSessionId() {
  return window.localStorage.getItem(LAST_SESSION_KEY)
}


export function saveLastSessionId(sessionId: string) {
  window.localStorage.setItem(LAST_SESSION_KEY, sessionId)
}

export function clearLastSessionId() {
  window.localStorage.removeItem(LAST_SESSION_KEY)
}


export function readLastWorkflowRunId() {
  return window.localStorage.getItem(LAST_WORKFLOW_RUN_KEY)
}


export function saveLastWorkflowRunId(runId: string) {
  window.localStorage.setItem(LAST_WORKFLOW_RUN_KEY, runId)
}
