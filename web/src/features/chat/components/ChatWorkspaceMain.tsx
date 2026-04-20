import { lazy, Suspense, type RefObject } from 'react'

import { ChevronsDown } from 'lucide-react'

import type { InterruptInfo, PreviewRunResponse, SessionDetail, TurnMetrics } from '../../../shared/api/contracts'
import type { StepGroup } from '../../../shared/lib/storage'
import type { PreviewRequestLanguage } from '../../previews/previewCode'
import type { SessionDraft } from '../../sessions/constants'
import { ChatComposerDock } from './ChatComposerDock'
import { ChatTurnTimeline } from './ChatTurnTimeline'
import type { ChatTurn, ConfigSaveState, LiveTelemetryPreview, QueuedComposerMessage } from '../pages/chatPageTypes'
import type { ComposerAttachment } from '../attachments'
import type { TodoItem } from './todoMessage'

const PreviewDock = lazy(() =>
  import('../../previews/components/PreviewDock').then((module) => ({ default: module.PreviewDock })),
)

type ChatWorkspaceMainProps = {
  activeConfig: SessionDraft
  activePreviewError?: string
  activePreviewRequest?: {
    code: string
    key: string
    language: PreviewRequestLanguage
    sessionId: string
  }
  activePreviewResult?: PreviewRunResponse
  chatScrollRegionClassName: string
  chatScrollRegionRef: RefObject<HTMLDivElement | null>
  composer: string
  composerAttachments: ComposerAttachment[]
  composerCanSubmit: boolean
  composerCollapsed: boolean
  composerDockHeight: number
  composerDockPositionClassName: string
  composerDockRef: RefObject<HTMLDivElement | null>
  composerFooterClassName: string
  composerShellClassName: string
  composerSurfaceClassName: string
  configSaveState: ConfigSaveState
  currentSession?: SessionDetail
  deleteDisabled: boolean
  fileAccept: string
  fileInputRef: RefObject<HTMLInputElement | null>
  groups: StepGroup[]
  isPreviewRunning: boolean
  isStreaming: boolean
  lastTurnMetrics?: TurnMetrics
  liveGroup?: StepGroup
  liveTelemetryPreview?: LiveTelemetryPreview
  mainPanelClassName: string
  previewSplitLayout: boolean
  previewVisible: boolean
  queueButtonDisabled: boolean
  queueHasCapacity: boolean
  queuePaused: boolean
  queuedMessages: QueuedComposerMessage[]
  sessionIdForPreview?: string
  showComposerUtilityDock: boolean
  showEmptyConversation: boolean
  showJumpToLatest: boolean
  streamlinedComposerMode: boolean
  streamError?: string
  telemetryCounts: {
    messageCount: number
    modelCallCount: number
    toolCallCount: number
  }
  todoItems: TodoItem[]
  turns: ChatTurn[]
  pendingInterrupts: InterruptInfo[]
  interruptSubmittingId?: string
  updateSessionPending: boolean
  onAppendFiles: (files: File[]) => void
  onChooseFiles: () => void
  onClosePreviewDock: () => void
  onComposerChange: (value: string) => void
  onDeleteMessages: (indices: number[]) => void
  onExpandComposer: () => void
  onHideComposer: () => void
  onOpenAdvancedConfig: () => void
  onResolveInterrupt: (interruptId: string, payload: Record<string, unknown>) => void
  onQueueMessage: () => void
  onQuickConfigChange: (patch: Partial<SessionDraft>) => void
  onRefreshPreviewDock: () => void
  onRemoveAttachment: (attachmentId: string) => void
  onRemoveQueuedMessage: (messageId: string) => void
  onRequestPreview?: (payload: {
    code: string
    key: string
    language: PreviewRequestLanguage
  }) => void
  onResizePreviewTerminal: (cols: number, rows: number) => Promise<void> | void
  onRunPreviewCode: (code: string) => void
  onScrollToLatest: () => void
  onSendMessage: () => void
  onSendPreviewTerminalInput: (text: string, appendNewline?: boolean) => Promise<void> | void
  onTerminatePreviewTerminal: () => Promise<void> | void
}

export function ChatWorkspaceMain({
  activeConfig,
  activePreviewError,
  activePreviewRequest,
  activePreviewResult,
  chatScrollRegionClassName,
  chatScrollRegionRef,
  composer,
  composerAttachments,
  composerCanSubmit,
  composerCollapsed,
  composerDockHeight,
  composerDockPositionClassName,
  composerDockRef,
  composerFooterClassName,
  composerShellClassName,
  composerSurfaceClassName,
  configSaveState,
  currentSession,
  deleteDisabled,
  fileAccept,
  fileInputRef,
  groups,
  isPreviewRunning,
  isStreaming,
  lastTurnMetrics,
  liveGroup,
  liveTelemetryPreview,
  mainPanelClassName,
  previewSplitLayout,
  previewVisible,
  queueButtonDisabled,
  queueHasCapacity,
  queuePaused,
  queuedMessages,
  sessionIdForPreview,
  showComposerUtilityDock,
  showEmptyConversation,
  showJumpToLatest,
  streamlinedComposerMode,
  streamError,
  telemetryCounts,
  todoItems,
  turns,
  pendingInterrupts,
  interruptSubmittingId,
  updateSessionPending,
  onAppendFiles,
  onChooseFiles,
  onClosePreviewDock,
  onComposerChange,
  onDeleteMessages,
  onExpandComposer,
  onHideComposer,
  onOpenAdvancedConfig,
  onResolveInterrupt,
  onQueueMessage,
  onQuickConfigChange,
  onRefreshPreviewDock,
  onRemoveAttachment,
  onRemoveQueuedMessage,
  onRequestPreview,
  onResizePreviewTerminal,
  onRunPreviewCode,
  onScrollToLatest,
  onSendMessage,
  onSendPreviewTerminalInput,
  onTerminatePreviewTerminal,
}: ChatWorkspaceMainProps) {
  return (
    <section className={mainPanelClassName}>
      <section className={previewSplitLayout ? 'chat-workspace chat-workspace-preview' : 'chat-workspace'}>
        <div
          className={chatScrollRegionClassName}
          ref={chatScrollRegionRef}
          style={{
            paddingBottom: composerDockHeight + 32,
            scrollPaddingBottom: composerDockHeight + 32,
          }}
        >
          <ChatTurnTimeline
            activePreviewKey={activePreviewRequest?.key}
            deleteDisabled={deleteDisabled}
            empty={showEmptyConversation}
            groups={groups}
            isPreviewRunning={isPreviewRunning}
            liveGroup={liveGroup}
            sessionId={sessionIdForPreview}
            turns={turns}
            onDeleteMessages={onDeleteMessages}
            onRequestPreview={onRequestPreview}
          />
          {streamError ? <div className="panel-error">{streamError}</div> : null}
        </div>

        <div className={composerDockPositionClassName}>
          {showJumpToLatest ? (
            <div className="pointer-events-none mb-2 flex justify-end">
              <button
                className="chat-jump-button pointer-events-auto"
                data-testid="jump-to-latest"
                type="button"
                onClick={onScrollToLatest}
              >
                <span>回到最新</span>
                <ChevronsDown size={14} />
              </button>
            </div>
          ) : null}
          <div ref={composerDockRef}>
            <ChatComposerDock
              activeConfig={activeConfig}
              composer={composer}
              composerAttachments={composerAttachments}
              composerCanSubmit={composerCanSubmit}
              composerCollapsed={composerCollapsed}
              composerFooterClassName={composerFooterClassName}
              composerShellClassName={composerShellClassName}
              composerSurfaceClassName={composerSurfaceClassName}
              configSaveState={configSaveState}
              currentSession={currentSession}
              fileAccept={fileAccept}
              fileInputRef={fileInputRef}
              isStreaming={isStreaming}
              lastTurnMetrics={lastTurnMetrics}
              liveTelemetryPreview={liveTelemetryPreview}
              queueButtonDisabled={queueButtonDisabled}
              queueHasCapacity={queueHasCapacity}
              queuePaused={queuePaused}
              queuedMessages={queuedMessages}
              showComposerUtilityDock={showComposerUtilityDock}
              streamlinedComposerMode={streamlinedComposerMode}
              telemetryCounts={telemetryCounts}
              todoItems={todoItems}
              pendingInterrupts={pendingInterrupts}
              interruptSubmittingId={interruptSubmittingId}
              updateSessionPending={updateSessionPending}
              onAppendFiles={onAppendFiles}
              onChooseFiles={onChooseFiles}
              onComposerChange={onComposerChange}
              onExpandComposer={onExpandComposer}
              onHideComposer={onHideComposer}
              onOpenAdvancedConfig={onOpenAdvancedConfig}
              onResolveInterrupt={onResolveInterrupt}
              onQueueMessage={onQueueMessage}
              onQuickConfigChange={onQuickConfigChange}
              onRemoveAttachment={onRemoveAttachment}
              onRemoveQueuedMessage={onRemoveQueuedMessage}
              onSendMessage={onSendMessage}
            />
          </div>
        </div>
      </section>
      {previewVisible ? (
        <Suspense fallback={<div className="preview-dock preview-dock-loading">正在加载预览面板…</div>}>
          <PreviewDock
            activeRequest={activePreviewRequest}
            error={activePreviewError}
            isRunning={isPreviewRunning}
            onClose={onClosePreviewDock}
            onRefresh={onRefreshPreviewDock}
            onRunCode={onRunPreviewCode}
            onResizeTerminal={onResizePreviewTerminal}
            onSendTerminalInput={onSendPreviewTerminalInput}
            onTerminateTerminal={onTerminatePreviewTerminal}
            response={activePreviewResult}
            variant={previewSplitLayout ? 'split' : 'overlay'}
          />
        </Suspense>
      ) : null}
    </section>
  )
}
