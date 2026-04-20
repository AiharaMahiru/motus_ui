import type { RefObject } from 'react'

import type { ChatMessage, InterruptInfo, SessionDetail, SessionSummary, TraceExportResult, TurnMetrics } from '../../../shared/api/contracts'
import type { StepGroup } from '../../../shared/lib/storage'
import type { PreviewRequestLanguage } from '../../previews/previewCode'
import type { SessionDraft } from '../../sessions/constants'
import type { ComposerAttachment } from '../attachments'
import type { TodoItem } from '../components/todoMessage'

export type IndexedChatMessage = ChatMessage & {
  historyIndex: number
}

export type ChatTurn = {
  user?: IndexedChatMessage
  toolMessages: IndexedChatMessage[]
  assistants: IndexedChatMessage[]
}

export type ConfigSaveState = 'idle' | 'saving' | 'saved' | 'error'

export type LiveTelemetryPreview = {
  turnUsage?: Record<string, unknown>
  sessionUsage?: Record<string, unknown>
  turnCostUsd?: number | null
  sessionCostUsd?: number | null
}

export type QueuedComposerMessage = {
  attachments: ComposerAttachment[]
  content: string
  id: string
}

export type ActivePreviewRequest = {
  code: string
  key: string
  language: PreviewRequestLanguage
  sessionId: string
}

export type ChatComposerDockProps = {
  activeConfig: SessionDraft
  composer: string
  composerAttachments: ComposerAttachment[]
  composerCanSubmit: boolean
  composerCollapsed: boolean
  composerFooterClassName: string
  composerShellClassName: string
  composerSurfaceClassName: string
  configSaveState: ConfigSaveState
  fileAccept: string
  fileInputRef: RefObject<HTMLInputElement | null>
  isStreaming: boolean
  queueButtonDisabled: boolean
  queueHasCapacity: boolean
  queuePaused: boolean
  queuedMessages: QueuedComposerMessage[]
  showComposerUtilityDock: boolean
  streamlinedComposerMode: boolean
  telemetryCounts: {
    messageCount: number
    modelCallCount: number
    toolCallCount: number
  }
  todoItems: TodoItem[]
  pendingInterrupts: InterruptInfo[]
  interruptSubmittingId?: string
  updateSessionPending: boolean
  currentSession?: SessionDetail
  lastTurnMetrics?: TurnMetrics
  liveTelemetryPreview?: LiveTelemetryPreview
  onAppendFiles: (files: File[]) => void
  onChooseFiles: () => void
  onComposerChange: (value: string) => void
  onExpandComposer: () => void
  onHideComposer: () => void
  onOpenAdvancedConfig: () => void
  onResolveInterrupt: (interruptId: string, payload: Record<string, unknown>) => void
  onQueueMessage: () => void
  onQuickConfigChange: (patch: Partial<SessionDraft>) => void
  onRemoveAttachment: (attachmentId: string) => void
  onRemoveQueuedMessage: (messageId: string) => void
  onSendMessage: () => void
}

export type ChatTurnTimelineProps = {
  activePreviewKey?: string
  deleteDisabled: boolean
  empty: boolean
  groups: StepGroup[]
  isPreviewRunning: boolean
  liveGroup?: StepGroup
  sessionId?: string
  turns: ChatTurn[]
  onDeleteMessages: (indices: number[]) => void
  onRequestPreview?: (payload: {
    code: string
    key: string
    language: PreviewRequestLanguage
  }) => void
}

export type SessionExportContext = {
  messages: ChatMessage[]
  session: SessionSummary
  title: string
  trace?: TraceExportResult
}
