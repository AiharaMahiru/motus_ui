import { memo } from 'react'

import { TerminalSquare } from 'lucide-react'

import { useI18n } from '../../../shared/i18n/I18nContext'
import { MessageBubble } from './MessageBubble'
import { groupConsecutiveAssistantMessages } from './messageGroups'
import { StepGroupCard } from './StepGroupCard'
import { ToolMessageGroup } from './ToolMessageGroup'
import { hasRenderableStepGroup } from '../lib/chatTurns'
import type { ChatTurnTimelineProps, IndexedChatMessage } from '../pages/chatPageTypes'

function ChatTurnTimelineInner({
  activePreviewKey,
  deleteDisabled,
  empty,
  groups,
  isPreviewRunning,
  liveGroup,
  onDeleteMessages,
  onRequestPreview,
  sessionId,
  turns,
}: ChatTurnTimelineProps) {
  const { text } = useI18n()
  if (empty) {
    return (
      <div className="empty-state">
        <div className="app-brand-icon mb-6 !h-14 !w-14 !rounded-3xl !bg-zinc-900 shadow-sm">
          <TerminalSquare size={24} />
        </div>
        <h3 className="mb-3 text-center text-2xl font-black tracking-tight" style={{ color: 'var(--app-text)' }}>
          {text('准备开始', 'Ready to start')}
        </h3>
        <p className="max-w-[460px] text-center text-base font-medium leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
          {text('直接输入消息即可开始，也可以从左侧新建一个空白对话。', 'Type a message to start, or create a blank session from the sidebar.')}
        </p>
      </div>
    )
  }

  return (
    <>
      {turns.map((turn, index) => {
        const persistedGroup = groups[index]
        const isLiveTurn = Boolean(liveGroup && index === turns.length - 1)
        const group = isLiveTurn ? liveGroup : persistedGroup
        const shouldRenderTimeline = hasRenderableStepGroup(group)
        const displayItems = groupConsecutiveAssistantMessages(turn.assistants)

        return (
          <div className="turn-block" key={`turn:${index}`}>
            {turn.user ? (
              <MessageBubble
                activePreviewKey={activePreviewKey}
                deleteDisabled={deleteDisabled}
                isPreviewRunning={isPreviewRunning}
                message={turn.user}
                onDelete={() => onDeleteMessages([turn.user!.historyIndex])}
                onRequestPreview={onRequestPreview}
                sessionId={sessionId}
              />
            ) : null}
            {group && shouldRenderTimeline ? (
              <StepGroupCard
                deleteDisabled={deleteDisabled}
                group={group}
                key={group.turnId}
                live={isLiveTurn}
                onDeleteToolBatch={(messages) => onDeleteMessages(messages.map((message) => (message as IndexedChatMessage).historyIndex))}
                toolMessages={turn.toolMessages}
              />
            ) : null}
            {(!group || !shouldRenderTimeline) && turn.toolMessages.length ? (
              <ToolMessageGroup
                deleteDisabled={deleteDisabled}
                messages={turn.toolMessages}
                onDelete={() => onDeleteMessages(turn.toolMessages.map((message) => message.historyIndex))}
                onDeleteBatch={(messages) => onDeleteMessages(messages.map((message) => (message as IndexedChatMessage).historyIndex))}
              />
            ) : null}
            {displayItems.map((item, assistantIndex) =>
              item.type === 'tool-group' ? (
                <ToolMessageGroup
                  deleteDisabled={deleteDisabled}
                  key={`assistant:${index}:${assistantIndex}:tool-group`}
                  messages={item.messages}
                  onDelete={() => onDeleteMessages(item.messages.map((message) => message.historyIndex))}
                  onDeleteBatch={(messages) => onDeleteMessages(messages.map((message) => (message as IndexedChatMessage).historyIndex))}
                />
              ) : (
                <MessageBubble
                  activePreviewKey={activePreviewKey}
                  deleteDisabled={deleteDisabled}
                  isPreviewRunning={isPreviewRunning}
                  key={`assistant:${index}:${assistantIndex}`}
                  message={item.message}
                  onDelete={() => onDeleteMessages([(item.message as IndexedChatMessage).historyIndex])}
                  onRequestPreview={onRequestPreview}
                  sessionId={sessionId}
                />
              ),
            )}
          </div>
        )
      })}

      {liveGroup && turns.length === 0 && hasRenderableStepGroup(liveGroup) ? (
        <StepGroupCard group={liveGroup} key={liveGroup.turnId} live />
      ) : null}
    </>
  )
}

export const ChatTurnTimeline = memo(
  ChatTurnTimelineInner,
  (previous, next) =>
    previous.activePreviewKey === next.activePreviewKey &&
    previous.deleteDisabled === next.deleteDisabled &&
    previous.empty === next.empty &&
    previous.groups === next.groups &&
    previous.isPreviewRunning === next.isPreviewRunning &&
    previous.liveGroup === next.liveGroup &&
    previous.sessionId === next.sessionId &&
    previous.turns === next.turns,
)
