import { useI18n } from '../../../shared/i18n/I18nContext'
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog'
import { ResizableSidebar } from '../../../shared/components/ResizableSidebar'
import { WorkbenchModeSwitch } from '../../../shared/components/WorkbenchModeSwitch'
import { ChatInspectorPane } from '../components/ChatInspectorPane'
import { ChatWorkspaceMain } from '../components/ChatWorkspaceMain'
import { useChatPageController } from '../hooks/useChatPageController'
import { SessionSidebar, SessionSidebarRail } from '../../sessions/components/SessionSidebar'


export function ChatPage() {
  const controller = useChatPageController()
  const { text } = useI18n()

  return (
    <>
      <div className="workspace-grid">
        <ResizableSidebar
          collapsed={controller.leftSidebarCollapsed}
          collapsedContent={
            <SessionSidebarRail
              onComposeNewSession={controller.handleComposeNewSession}
              onSelectSession={controller.handleSelectSession}
              selectedSessionId={controller.sessionId}
              sessions={controller.filteredSessions}
            />
          }
          collapsedWidth={controller.narrowViewport ? 0 : 64}
          side="left"
          defaultWidth={280}
          minWidth={220}
          maxWidth={450}
        >
          <SessionSidebar
            deletingSessionId={controller.deletingSessionId}
            onComposeNewSession={controller.handleComposeNewSession}
            onDeleteSession={controller.onDeleteSession}
            onSearchChange={controller.setSearchTerm}
            onSelectSession={controller.handleSelectSession}
            searchTerm={controller.searchTerm}
            selectedSessionId={controller.sessionId}
            sessions={controller.filteredSessions}
          />
        </ResizableSidebar>

        <section className="workspace-main">
          <WorkbenchModeSwitch
            activeMode="chat"
            leftSidebarToggle={{
              collapsed: controller.leftSidebarCollapsed,
              onToggle: () => controller.setLeftSidebarCollapsed((current) => !current),
            }}
            moreMenuItems={controller.workbenchMenuItems}
            rightSidebarToggle={{
              collapsed: controller.rightSidebarCollapsed,
              onToggle: () => controller.setRightSidebarCollapsed((current) => !current),
            }}
          />
          <ChatWorkspaceMain
            activeConfig={controller.activeConfig}
            activePreviewError={controller.activePreviewError}
            activePreviewRequest={controller.activePreviewRequest}
            activePreviewResult={controller.activePreviewResult}
            chatScrollRegionClassName={controller.chatScrollRegionClassName}
            chatScrollRegionRef={controller.chatScrollRegionRef}
            composer={controller.composer}
            composerAttachments={controller.composerAttachments}
            composerCanSubmit={controller.composerCanSubmit}
            composerCollapsed={controller.composerCollapsed}
            composerDockHeight={controller.composerDockHeight}
            composerDockPositionClassName={controller.composerDockPositionClassName}
            composerDockRef={controller.composerDockRef}
            composerFooterClassName={controller.composerFooterClassName}
            composerShellClassName={controller.composerShellClassName}
            composerSurfaceClassName={controller.composerSurfaceClassName}
            configSaveState={controller.configSaveState}
            currentSession={controller.currentSession}
            deleteDisabled={controller.deleteDisabled}
            fileAccept={controller.COMPOSER_FILE_ACCEPT}
            fileInputRef={controller.fileInputRef}
            groups={controller.groups}
            isPreviewRunning={controller.isPreviewRunning}
            isStreaming={controller.isStreaming}
            lastTurnMetrics={controller.lastTurnMetrics}
            liveGroup={controller.liveGroup}
            liveTelemetryPreview={controller.liveTelemetryPreview}
            mainPanelClassName={controller.mainPanelClassName}
            previewSplitLayout={controller.previewSplitLayout}
            previewVisible={controller.previewVisible}
            queueButtonDisabled={controller.queueButtonDisabled}
            queueHasCapacity={controller.queueHasCapacity}
            queuePaused={controller.queuePaused}
            queuedMessages={controller.queuedMessages}
            sessionIdForPreview={controller.supportsPreview ? controller.currentSession?.session_id : undefined}
            showComposerUtilityDock={controller.showComposerUtilityDock}
            showEmptyConversation={controller.showEmptyConversation}
            showJumpToLatest={controller.showJumpToLatest}
            streamlinedComposerMode={controller.streamlinedComposerMode}
            streamError={controller.streamError}
            telemetryCounts={controller.telemetryCounts}
            todoItems={controller.todoItems}
            turns={controller.turns}
            pendingInterrupts={controller.pendingInterrupts}
            interruptSubmittingId={controller.interruptSubmittingId}
            updateSessionPending={controller.updateSessionPending}
            onAppendFiles={controller.onAppendFiles}
            onChooseFiles={controller.handleChooseFiles}
            onClosePreviewDock={controller.handleClosePreviewDock}
            onComposerChange={controller.setComposer}
            onDeleteMessages={(indices) => void controller.handleDeleteMessages(indices)}
            onExpandComposer={() => controller.setComposerCollapsed(false)}
            onHideComposer={() => controller.setComposerCollapsed(true)}
            onOpenAdvancedConfig={controller.handleOpenAdvancedConfig}
            onResolveInterrupt={controller.handleResolveInterrupt}
            onQueueMessage={controller.handleQueueMessage}
            onQuickConfigChange={controller.handleQuickConfigChange}
            onRefreshPreviewDock={controller.handleRefreshPreviewDock}
            onRemoveAttachment={controller.onRemoveAttachment}
            onRemoveQueuedMessage={controller.handleRemoveQueuedMessage}
            onRequestPreview={controller.supportsPreview ? controller.handleRequestPreview : undefined}
            onResizePreviewTerminal={controller.handleResizePreviewTerminal}
            onRunPreviewCode={controller.handleRunPreviewCode}
            onScrollToLatest={controller.onScrollToLatest}
            onSendMessage={controller.handleSendMessage}
            onSendPreviewTerminalInput={controller.handleSendPreviewTerminalInput}
            onTerminatePreviewTerminal={controller.handleTerminatePreviewTerminal}
          />
        </section>

        <ResizableSidebar
          collapsed={controller.rightSidebarCollapsed}
          collapsedWidth={0}
          side="right"
          defaultWidth={380}
          minWidth={320}
          maxWidth={600}
        >
          <ChatInspectorPane
            activeConfig={controller.activeConfig}
            activeEnabledTools={controller.activeEnabledTools}
            activeInspectorTab={controller.activeInspectorTab}
            availableToolOptions={controller.availableToolOptions}
            capabilities={{
              supportsInterrupts: controller.supportsInterrupts,
              supportsStructuredResponseFormat: controller.supportsStructuredResponseFormat,
            }}
            configError={controller.configError}
            currentSession={controller.currentSession}
            exportResult={controller.lastTraceExport}
            exporting={controller.exportRuntimeTraceMutation.isPending || controller.exportSessionTraceMutation.isPending}
            isCreating={controller.isCreatingSession}
            isReadOnly={controller.sessionConfigReadOnly}
            isSaving={controller.updateSessionPending}
            isStreaming={controller.isStreaming}
            meta={controller.meta}
            runtimeRequirements={controller.runtimeRequirements}
            runtimeToolCatalog={controller.runtimeToolCatalog}
            runtimeTracingStatus={controller.runtimeTracingStatus}
            runtimeWorkflowCatalog={controller.runtimeWorkflowCatalog}
            sessionId={controller.sessionId}
            sessionTracingStatus={controller.sessionTracingStatus}
            onChangeTab={controller.setActiveInspectorTab}
            onApplyHitlApprovalPreset={controller.handleApplyHitlApprovalPreset}
            onApplyHitlQuestionPreset={controller.handleApplyHitlQuestionPreset}
            onConfigChange={controller.handleConfigChange}
            onCreateSession={controller.handleCreateSession}
            onExportActive={
              controller.sessionId
                ? () => controller.exportSessionTraceMutation.mutate(controller.sessionId as string)
                : undefined
            }
            onExportRuntime={() => controller.exportRuntimeTraceMutation.mutate()}
            onResetConfig={controller.handleResetConfig}
            onSaveCurrentSession={controller.handleSaveCurrentSession}
            onToggleTool={controller.handleToggleTool}
          />
        </ResizableSidebar>
      </div>

      <ConfirmDialog
        busy={controller.deleteSessionConfirming}
        cancelLabel={text('取消', 'Cancel')}
        confirmLabel={text('确认删除', 'Delete session')}
        description={text(
          '会话删除后会同时清理消息、上传文件和追踪记录。这个操作不可恢复。',
          'Deleting the session also removes messages, uploads, and tracing data. This action cannot be undone.',
        )}
        open={Boolean(controller.pendingDeleteSession)}
        title={text('确认删除这个会话？', 'Delete this session?')}
        tone="danger"
        onCancel={controller.handleCancelDeleteSession}
        onConfirm={controller.handleConfirmDeleteSession}
      >
        {controller.pendingDeleteSession ? (
          <div className="confirm-dialog-target">
            <div className="confirm-dialog-target-label">{text('待删除会话', 'Session to delete')}</div>
            <div className="confirm-dialog-target-title">
              {controller.pendingDeleteSession.title?.trim() || controller.pendingDeleteSession.session_id.slice(0, 8)}
            </div>
            <div className="confirm-dialog-target-meta">
              <span>{controller.pendingDeleteSession.model_name}</span>
              <span>·</span>
              <span>{controller.pendingDeleteSession.session_id.slice(0, 8)}</span>
            </div>
          </div>
        ) : null}
      </ConfirmDialog>
    </>
  )
}
