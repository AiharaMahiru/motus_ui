import type { ChangeEvent, ClipboardEvent, KeyboardEvent } from 'react'

import { ChevronDown, ChevronUp, Clock3, Paperclip, Send, X } from 'lucide-react'

import { useI18n } from '../../../shared/i18n/I18nContext'
import { ComposerConfigBar } from './ComposerConfigBar'
import { InterruptResumeCard } from './InterruptResumeCard'
import { ResourceTelemetryBar } from './ResourceTelemetryBar'
import { TodoDock } from './TodoDock'
import { formatAttachmentSize } from '../attachments'
import type { ChatComposerDockProps } from '../pages/chatPageTypes'

function handleComposerEnter(event: KeyboardEvent<HTMLTextAreaElement>, onSend: () => void) {
  if (event.key !== 'Enter' || event.shiftKey) {
    return
  }
  event.preventDefault()
  onSend()
}

function handleComposerPaste(event: ClipboardEvent<HTMLTextAreaElement>, onAppendFiles: (files: File[]) => void) {
  const files = Array.from(event.clipboardData.files ?? [])
  if (files.length === 0) {
    return
  }
  event.preventDefault()
  onAppendFiles(files)
}

export function ChatComposerDock({
  activeConfig,
  composer,
  composerAttachments,
  composerCanSubmit,
  composerCollapsed,
  composerFooterClassName,
  composerShellClassName,
  composerSurfaceClassName,
  configSaveState,
  currentSession,
  fileAccept,
  fileInputRef,
  isStreaming,
  lastTurnMetrics,
  liveTelemetryPreview,
  onAppendFiles,
  onChooseFiles,
  onComposerChange,
  onExpandComposer,
  onHideComposer,
  onOpenAdvancedConfig,
  onResolveInterrupt,
  onQueueMessage,
  onQuickConfigChange,
  onRemoveAttachment,
  onRemoveQueuedMessage,
  onSendMessage,
  pendingInterrupts,
  interruptSubmittingId,
  queueButtonDisabled,
  queueHasCapacity,
  queuePaused,
  queuedMessages,
  showComposerUtilityDock,
  streamlinedComposerMode,
  telemetryCounts,
  todoItems,
  updateSessionPending,
}: ChatComposerDockProps) {
  const { text } = useI18n()
  const composerActionsClassName = streamlinedComposerMode
    ? 'chat-composer-actions chat-composer-actions-streamlined'
    : 'chat-composer-actions'

  return (
    <div className={composerShellClassName}>
      {showComposerUtilityDock ? (
        <>
          <TodoDock className="!rounded-b-none !border-b-0" items={todoItems} />
          <ResourceTelemetryBar
            className="!rounded-none !border-b-0"
            counts={telemetryCounts}
            currentSession={currentSession}
            isStreaming={isStreaming}
            lastTurnMetrics={lastTurnMetrics}
            livePreview={liveTelemetryPreview}
          />
        </>
      ) : null}
      {pendingInterrupts.length ? (
        <div className="flex flex-col gap-2">
          {pendingInterrupts.map((interrupt) => (
            <InterruptResumeCard
              disabled={isStreaming || Boolean(interruptSubmittingId)}
              interrupt={interrupt}
              key={interrupt.interrupt_id}
              submitting={interruptSubmittingId === interrupt.interrupt_id}
              onSubmit={onResolveInterrupt}
            />
          ))}
        </div>
      ) : null}
      <div className={composerSurfaceClassName}>
        {composerCollapsed ? (
          <div className="composer-collapsed-shell">
            <div className="composer-collapsed-copy">
              <span className="composer-collapsed-label">输入框已隐藏</span>
              <span className="composer-collapsed-text">
                {queuedMessages.length
                  ? text(`排队中 ${queuedMessages.length}/2 条，恢复后可继续编辑`, `${queuedMessages.length}/2 queued, expand to continue`)
                  : composerAttachments.length
                    ? text(`已保留 ${composerAttachments.length} 个附件草稿`, `${composerAttachments.length} draft attachments kept`)
                    : composer.trim()
                      ? text(`已保留 ${composer.trim().length} 字草稿`, `${composer.trim().length} draft chars kept`)
                      : text('点击展开继续输入', 'Expand to keep typing')}
              </span>
            </div>
            <button
              className="composer-collapse-button"
              data-testid="expand-composer"
              type="button"
              onClick={onExpandComposer}
            >
              <span>{text('展开输入框', 'Expand composer')}</span>
              <ChevronUp size={14} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <input
              accept={fileAccept}
              className="hidden"
              multiple
              ref={fileInputRef}
              type="file"
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const files = Array.from(event.target.files ?? [])
                onAppendFiles(files)
                event.target.value = ''
              }}
            />

            {composerAttachments.length ? (
              <div className="composer-attachments">
                {composerAttachments.map((attachment) => (
                  <div className="composer-attachment-chip" key={attachment.id}>
                    {attachment.previewUrl ? (
                      <img
                        alt={attachment.name}
                        className="composer-attachment-preview"
                        src={attachment.previewUrl}
                      />
                    ) : (
                      <span className="composer-attachment-kind">{attachment.kind === 'image' ? text('图片', 'Image') : text('文件', 'File')}</span>
                    )}
                    <div className="composer-attachment-copy">
                      <span className="composer-attachment-name">{attachment.name}</span>
                      <span className="composer-attachment-meta">
                        {attachment.kind === 'image' ? text('图片', 'Image') : text('文件', 'File')} · {formatAttachmentSize(attachment.size)}
                      </span>
                    </div>
                    <button
                      aria-label={`${text('移除附件', 'Remove attachment')} ${attachment.name}`}
                      className="composer-attachment-remove"
                      type="button"
                      onClick={() => onRemoveAttachment(attachment.id)}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <textarea
              className="composer-input !min-h-[44px] !border-none !bg-transparent !px-2 !py-1.5 !shadow-none focus:!bg-transparent focus:!ring-0"
              data-testid="composer-input"
              placeholder={streamlinedComposerMode ? text('输入消息...', 'Type a message...') : text('输入消息，Enter 发送，Shift + Enter 换行...', 'Type a message, Enter to send, Shift + Enter for newline...')}
              rows={streamlinedComposerMode ? 2 : 1}
              value={composer}
              onChange={(event) => onComposerChange(event.target.value)}
              onKeyDown={(event) => handleComposerEnter(event, onSendMessage)}
              onPaste={(event) => handleComposerPaste(event, onAppendFiles)}
            />

            {queuedMessages.length ? (
              <div className={queuePaused ? 'composer-queue-shell composer-queue-shell-paused' : 'composer-queue-shell'}>
                <div className="composer-queue-header">
                  <div className="composer-queue-title">
                    <Clock3 size={13} />
                    <span>{text(`排队发送 ${queuedMessages.length}/2`, `Queue ${queuedMessages.length}/2`)}</span>
                  </div>
                  <span className="composer-queue-note">
                    {queuePaused ? text('已暂停，处理后会继续', 'Paused, will continue after current step') : text('当前轮结束后自动继续', 'Will continue after this turn')}
                  </span>
                </div>
                <div className="composer-queue-list">
                  {queuedMessages.map((message, index) => (
                    <div className="composer-queue-item" key={message.id}>
                      <span className="composer-queue-index">{index + 1}</span>
                      <span className="composer-queue-text">{message.content}</span>
                      <button
                        aria-label={`${text('移除排队消息', 'Remove queued message')} ${index + 1}`}
                        className="composer-queue-remove"
                        type="button"
                        onClick={() => onRemoveQueuedMessage(message.id)}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className={composerFooterClassName}>
              <ComposerConfigBar
                compact={false}
                config={activeConfig}
                disabled={isStreaming || updateSessionPending}
                saveState={configSaveState}
                showSaveState={!streamlinedComposerMode}
                visibleFields={streamlinedComposerMode ? ['model'] : ['model', 'thinking', 'maxSteps', 'timeout']}
                onConfigChange={onQuickConfigChange}
                onOpenAdvancedConfig={onOpenAdvancedConfig}
              />
              <div className={composerActionsClassName}>
                {!streamlinedComposerMode ? (
                  <button
                    className="composer-queue-button"
                    data-testid="queue-send-button"
                    disabled={queueButtonDisabled}
                    type="button"
                    onClick={onQueueMessage}
                  >
                    <Clock3 size={13} />
                    <span>{queueHasCapacity ? text(`排队发送 ${queuedMessages.length}/2`, `Queue ${queuedMessages.length}/2`) : text('队列已满', 'Queue full')}</span>
                  </button>
                ) : null}
                <button
                  className="composer-collapse-button composer-upload-button"
                  data-testid="upload-files-button"
                  type="button"
                  onClick={onChooseFiles}
                >
                  <Paperclip size={14} />
                  <span>{streamlinedComposerMode ? text('附件', 'Files') : text('上传附件', 'Upload files')}</span>
                </button>
                {!streamlinedComposerMode ? (
                  <button
                    className="composer-collapse-button composer-hide-button"
                    data-testid="collapse-composer"
                    type="button"
                    onClick={onHideComposer}
                  >
                    <span>{text('隐藏输入框', 'Hide composer')}</span>
                    <ChevronDown size={14} />
                  </button>
                ) : null}
                <button
                  className="primary-button !h-9 !gap-2 !rounded-xl !px-5 !text-[11px]"
                  data-testid="send-button"
                  disabled={!composerCanSubmit || isStreaming || pendingInterrupts.length > 0}
                  type="button"
                  onClick={onSendMessage}
                >
                  <span>
                    {isStreaming
                      ? text('处理中', 'Running')
                      : streamlinedComposerMode
                        ? text('发送', 'Send')
                        : currentSession
                          ? text('发送消息', 'Send message')
                          : text('创建并发送', 'Create & send')}
                  </span>
                  <Send size={13} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
