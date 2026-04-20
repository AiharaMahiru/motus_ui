import { startTransition, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'

import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { ChatMessage, InterruptInfo, SessionDetail, TurnMetrics } from '../../../shared/api/contracts'
import { clearStepGroups, loadStepGroups, saveStepGroups, type StepGroup } from '../../../shared/lib/storage'
import { streamSessionMessage, streamSessionResume } from '../../../shared/stream/sse'
import { deleteSessionMessages, sessionKeys } from '../../sessions/api'
import { tracingKeys } from '../../tracing/api'
import { formatAttachmentSize, releaseComposerAttachment, type ComposerAttachment } from '../attachments'
import { resolveTodoItems } from '../components/todoMessage'
import { useComposerAttachments } from './useComposerAttachments'
import { usePreviewController } from './usePreviewController'
import { buildTurns, createQueuedComposerMessage } from '../lib/chatTurns'
import type { LiveTelemetryPreview, QueuedComposerMessage } from '../pages/chatPageTypes'
import { useChatScroll } from './useChatScroll'
const COMPOSER_ATTACHMENT_LIMIT = 8
const COMPOSER_FILE_ACCEPT = 'image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.md,.json,.py,.js,.ts,.tsx,.jsx,.zip'

type UseChatComposerControllerOptions = {
  currentSession?: SessionDetail
  ensureActiveSessionId: () => Promise<string>
  isStreaming: boolean
  narrowViewport: boolean
  onConfigError: (message: string) => void
  onSetComposerCollapsed: (value: boolean) => void
  onSetRightSidebarCollapsed: (updater: (value: boolean) => boolean) => void
  onStreamingChange: (value: boolean) => void
  sessionId?: string
  sessionMessages: ChatMessage[]
  supportsPreview: boolean
}


export function useChatComposerController({
  currentSession,
  ensureActiveSessionId,
  isStreaming,
  narrowViewport,
  onConfigError,
  onSetComposerCollapsed,
  onSetRightSidebarCollapsed,
  onStreamingChange,
  sessionId,
  sessionMessages,
  supportsPreview,
}: UseChatComposerControllerOptions) {
  const queryClient = useQueryClient()
  const [composer, setComposer] = useState('')
  const [streamError, setStreamError] = useState<string>()
  const [lastTurnMetrics, setLastTurnMetrics] = useState<TurnMetrics>()
  const [stepGroups, setStepGroups] = useState<StepGroup[]>([])
  const [liveGroup, setLiveGroup] = useState<StepGroup>()
  const [liveTelemetryPreview, setLiveTelemetryPreview] = useState<LiveTelemetryPreview>()
  const [pendingInterrupts, setPendingInterrupts] = useState<InterruptInfo[]>([])
  const [interruptSubmittingId, setInterruptSubmittingId] = useState<string>()
  const [queuedMessages, setQueuedMessages] = useState<QueuedComposerMessage[]>([])
  const [queuePaused, setQueuePaused] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queueDrainRef = useRef(false)
  const stepGroupsRef = useRef<StepGroup[]>([])
  const persistTimeoutRef = useRef<number | undefined>(undefined)
  const pendingPersistRef = useRef<{ groups: StepGroup[]; sessionId: string } | null>(null)

  const {
    clearComposerAttachments,
    composerAttachments,
    appendComposerFiles,
    removeComposerAttachment,
    setComposerAttachments,
  } = useComposerAttachments({ limit: COMPOSER_ATTACHMENT_LIMIT })

  const indexedMessages = useMemo(
    () =>
      (sessionMessages ?? []).map((message, historyIndex) => ({
        ...message,
        historyIndex,
      })),
    [sessionMessages],
  )
  const turns = useMemo(() => buildTurns(indexedMessages), [indexedMessages])
  const todoItems = useMemo(
    () => resolveTodoItems(sessionMessages ?? [], stepGroups, liveGroup),
    [liveGroup, sessionMessages, stepGroups],
  )
  const telemetryCounts = useMemo(() => {
    const persistedGroups = stepGroups
    const groups = liveGroup ? [...persistedGroups, liveGroup] : persistedGroups
    const toolCallCount = groups.reduce(
      (total, group) => total + group.steps.reduce((stepTotal, step) => stepTotal + step.toolCalls.length, 0),
      0,
    )
    const modelCallCount = groups.reduce((total, group) => total + group.steps.length, 0)
    const messageCount = (sessionMessages ?? []).filter((message) => message.role === 'user').length

    return {
      messageCount,
      modelCallCount,
      toolCallCount,
    }
  }, [liveGroup, sessionMessages, stepGroups])
  const showEmptyConversation = !turns.length && !liveGroup
  const composerCanSubmit = Boolean(composer.trim() || composerAttachments.length)
  const queueHasCapacity = queuedMessages.length < 2
  const queueButtonDisabled = !composer.trim() || composerAttachments.length > 0 || !isStreaming || !queueHasCapacity
  const contentVersion = useMemo(
    () =>
      [
        turns.length,
        liveGroup?.steps.length ?? 0,
        liveGroup?.completedAt ?? '',
        liveGroup?.errorMessage ?? '',
        streamError ?? '',
      ].join(':'),
    [liveGroup?.completedAt, liveGroup?.errorMessage, liveGroup?.steps.length, streamError, turns.length],
  )
  const {
    chatScrollRegionRef,
    composerDockHeight,
    composerDockRef,
    scrollToLatest,
    setFollowLatest,
    showJumpToLatest,
  } = useChatScroll({
    contentVersion,
    isStreaming,
    sessionId,
  })
  const {
    activePreviewError,
    activePreviewRequest,
    activePreviewResult,
    handleClosePreviewDock,
    handleRefreshPreviewDock,
    handleRequestPreview,
    handleResizePreviewTerminal,
    handleRunPreviewCode,
    handleSendPreviewTerminalInput,
    handleTerminatePreviewTerminal,
    previewBusy,
    previewVisible,
  } = usePreviewController({
    currentSessionId: currentSession?.session_id,
    onPreviewWillOpen: () => onSetRightSidebarCollapsed(() => true),
    onReportError: onConfigError,
    sessionId,
    supportsPreview,
  })

  const deleteSessionMessagesMutation = useMutation({
    mutationFn: ({
      activeSessionId,
      indices,
    }: {
      activeSessionId: string
      indices: number[]
    }) => deleteSessionMessages(activeSessionId, { indices }),
    onSuccess: (_, variables) => {
      clearStepGroups(variables.activeSessionId)
      setStepGroups([])
      setLiveGroup(undefined)
      setLastTurnMetrics(undefined)
      setPendingInterrupts([])
      setInterruptSubmittingId(undefined)
      setStreamError(undefined)
      queryClient.invalidateQueries({ queryKey: sessionKeys.messages(variables.activeSessionId) })
      queryClient.invalidateQueries({ queryKey: sessionKeys.detail(variables.activeSessionId) })
      queryClient.invalidateQueries({ queryKey: sessionKeys.all })
      queryClient.invalidateQueries({ queryKey: tracingKeys.session(variables.activeSessionId) })
    },
    onError: (error) => {
      onConfigError(error instanceof Error ? error.message : '删除消息失败')
    },
  })

  function handleChooseFiles() {
    fileInputRef.current?.click()
  }

  useEffect(() => {
    stepGroupsRef.current = stepGroups
  }, [stepGroups])

  function updateSessionDetailCache(
    activeSessionId: string,
    updater: (current: SessionDetail) => SessionDetail,
  ) {
    queryClient.setQueryData<SessionDetail | undefined>(
      sessionKeys.detail(activeSessionId),
      (current) => (current ? updater(current) : current),
    )
  }

  function persistStepGroups(activeSessionId: string, groups: StepGroup[]) {
    stepGroupsRef.current = groups
    pendingPersistRef.current = { groups, sessionId: activeSessionId }
    if (persistTimeoutRef.current) {
      window.clearTimeout(persistTimeoutRef.current)
    }
    persistTimeoutRef.current = window.setTimeout(() => {
      if (pendingPersistRef.current) {
        saveStepGroups(pendingPersistRef.current.sessionId, pendingPersistRef.current.groups)
        pendingPersistRef.current = null
      }
      persistTimeoutRef.current = undefined
    }, 180)
    startTransition(() => {
      setStepGroups(groups)
    })
  }

  function appendStepGroup(activeSessionId: string, group: StepGroup) {
    persistStepGroups(activeSessionId, [...stepGroupsRef.current, group])
  }

  function replaceLastStepGroup(activeSessionId: string, group: StepGroup) {
    if (stepGroupsRef.current.length === 0) {
      persistStepGroups(activeSessionId, [group])
      return
    }
    persistStepGroups(activeSessionId, [...stepGroupsRef.current.slice(0, -1), group])
  }

  useEffect(() => {
    if (persistTimeoutRef.current) {
      window.clearTimeout(persistTimeoutRef.current)
      persistTimeoutRef.current = undefined
    }
    pendingPersistRef.current = null
    setStepGroups(loadStepGroups(sessionId))
    setLiveGroup(undefined)
    setLiveTelemetryPreview(undefined)
    setLastTurnMetrics(undefined)
    setPendingInterrupts([])
    setInterruptSubmittingId(undefined)
    setStreamError(undefined)
    clearComposerAttachments()
    setQueuedMessages([])
    setQueuePaused(false)
    queueDrainRef.current = false
    onSetComposerCollapsed(false)
    setFollowLatest(true)
  }, [clearComposerAttachments, onSetComposerCollapsed, sessionId, setFollowLatest])

  useEffect(() => {
    if (narrowViewport || activePreviewRequest) {
      onSetComposerCollapsed(false)
    }
  }, [activePreviewRequest, narrowViewport, onSetComposerCollapsed])

  useEffect(() => {
    const nextInterrupts = currentSession?.status === 'interrupted' ? currentSession.interrupts ?? [] : []
    startTransition(() => {
      setPendingInterrupts(nextInterrupts)
    })
    if (!nextInterrupts.length && !isStreaming) {
      setInterruptSubmittingId(undefined)
    }
  }, [currentSession?.interrupts, currentSession?.session_id, currentSession?.status, isStreaming])

  useEffect(() => {
    return () => {
      if (persistTimeoutRef.current) {
        window.clearTimeout(persistTimeoutRef.current)
      }
      if (pendingPersistRef.current) {
        saveStepGroups(pendingPersistRef.current.sessionId, pendingPersistRef.current.groups)
      }
    }
  }, [])

  function buildComposerDisplayContent(rawContent: string, attachments: ComposerAttachment[]) {
    const trimmed = rawContent.trim()
    if (trimmed) {
      return trimmed
    }
    if (attachments.length > 0) {
      return `已上传 ${attachments.length} 个附件`
    }
    return ''
  }

  async function sendMessageContent(
    rawContent: string,
    {
      attachments = [],
      clearComposerOnStart = false,
    }: {
      attachments?: ComposerAttachment[]
      clearComposerOnStart?: boolean
    } = {},
  ) {
    const content = rawContent.trim()
    const displayContent = buildComposerDisplayContent(rawContent, attachments)
    if ((!content && attachments.length === 0) || isStreaming || pendingInterrupts.length > 0) {
      return false
    }

    let activeSessionIdForRefresh: string | undefined
    let sendSucceeded = false

    try {
      onConfigError('')
      setStreamError(undefined)
      setQueuePaused(false)

      const activeSessionId = await ensureActiveSessionId()
      activeSessionIdForRefresh = activeSessionId
      if (clearComposerOnStart) {
        setComposer('')
        clearComposerAttachments({ release: false })
      }
      setFollowLatest(true)
      queryClient.setQueryData<ChatMessage[]>(sessionKeys.messages(activeSessionId), (current = []) => [
        ...current,
        {
          role: 'user',
          content: displayContent,
          user_params: attachments.length
            ? {
                attachments: attachments.map((attachment) => ({
                  file_name: attachment.name,
                  kind: attachment.kind,
                  mime_type: attachment.mimeType,
                  size_bytes: attachment.size,
                  size_label: formatAttachmentSize(attachment.size),
                })),
                display_content: displayContent,
              }
            : undefined,
        },
      ])

      const workingGroup: StepGroup = {
        turnId: `${activeSessionId}:${Date.now()}`,
        userContent: displayContent,
        createdAt: new Date().toISOString(),
        steps: [],
      }
      setLiveGroup(workingGroup)
      setLiveTelemetryPreview(undefined)
      setPendingInterrupts([])
      setInterruptSubmittingId(undefined)
      onStreamingChange(true)

      await streamSessionMessage(
        activeSessionId,
        {
          content,
          files: attachments.map((attachment) => attachment.file),
        },
        (event) => {
          switch (event.event) {
            case 'assistant.step':
              workingGroup.steps = [
                ...workingGroup.steps,
                {
                  agentName: event.data.agent_name,
                  content: event.data.content,
                  toolCalls: event.data.tool_calls,
                  timestamp: event.data.timestamp,
                },
              ]
              setLiveTelemetryPreview({
                turnUsage: event.data.turn_usage as Record<string, unknown> | undefined,
                sessionUsage: event.data.session_usage as Record<string, unknown> | undefined,
                turnCostUsd: event.data.turn_cost_usd,
                sessionCostUsd: event.data.session_cost_usd,
              })
              setLiveGroup({ ...workingGroup })
              break
            case 'session.telemetry':
              setLastTurnMetrics(event.data.metrics)
              setLiveTelemetryPreview({
                turnUsage: event.data.metrics.turn_usage as Record<string, unknown> | undefined,
                sessionUsage: event.data.metrics.session_usage as Record<string, unknown> | undefined,
                turnCostUsd: event.data.metrics.turn_cost_usd,
                sessionCostUsd: event.data.metrics.session_cost_usd,
              })
              break
            case 'session.interrupted':
              workingGroup.completedAt = event.data.timestamp
              const nextInterrupts =
                event.data.interrupts.length > 0
                  ? event.data.interrupts
                  : event.data.interrupt
                    ? [event.data.interrupt]
                    : []
              if (event.data.metrics) {
                setLastTurnMetrics(event.data.metrics)
                setLiveTelemetryPreview({
                  turnUsage: event.data.metrics.turn_usage as Record<string, unknown> | undefined,
                  sessionUsage: event.data.metrics.session_usage as Record<string, unknown> | undefined,
                  turnCostUsd: event.data.metrics.turn_cost_usd,
                  sessionCostUsd: event.data.metrics.session_cost_usd,
                })
              }
              setPendingInterrupts(nextInterrupts)
              setInterruptSubmittingId(undefined)
              setQueuePaused(true)
              updateSessionDetailCache(activeSessionId, (current) => ({
                ...current,
                interrupts: nextInterrupts,
                last_error: null,
                status: 'interrupted',
              }))
              setLiveGroup({ ...workingGroup })
              break
            case 'assistant.final':
              workingGroup.completedAt = event.data.timestamp
              if (typeof event.data.assistant?.content === 'string') {
                workingGroup.finalContent = event.data.assistant.content
              }
              if (event.data.assistant) {
                const assistantMessage = event.data.assistant
                queryClient.setQueryData<ChatMessage[]>(sessionKeys.messages(activeSessionId), (current = []) => [
                  ...current,
                  assistantMessage,
                ])
              }
              if (event.data.metrics) {
                setLastTurnMetrics(event.data.metrics)
              }
              setPendingInterrupts([])
              setInterruptSubmittingId(undefined)
              setQueuePaused(false)
              updateSessionDetailCache(activeSessionId, (current) => ({
                ...current,
                interrupts: [],
                last_error: null,
                last_response: event.data.assistant ?? current.last_response,
                status: 'idle',
              }))
              setLiveTelemetryPreview(undefined)
              setLiveGroup({ ...workingGroup })
              break
            case 'session.error':
              workingGroup.errorMessage = event.data.message
              setStreamError(event.data.message)
              setPendingInterrupts([])
              setInterruptSubmittingId(undefined)
              setLiveTelemetryPreview(undefined)
              updateSessionDetailCache(activeSessionId, (current) => ({
                ...current,
                interrupts: [],
                last_error: event.data.message,
                status: 'error',
              }))
              setLiveGroup({ ...workingGroup })
              break
            default:
              break
          }
        },
      )

      appendStepGroup(activeSessionId, workingGroup)
      sendSucceeded = true
      return true
    } catch (error) {
      const detail = error instanceof Error ? error.message : '消息发送失败'
      setStreamError(detail)
      if (clearComposerOnStart) {
        setComposer(rawContent)
        setComposerAttachments(attachments)
      }
      return false
    } finally {
      onStreamingChange(false)
      setLiveGroup(undefined)
      setLiveTelemetryPreview(undefined)
      if (sendSucceeded && clearComposerOnStart) {
        attachments.forEach(releaseComposerAttachment)
      }
      if (activeSessionIdForRefresh) {
        queryClient.invalidateQueries({ queryKey: sessionKeys.detail(activeSessionIdForRefresh) })
        queryClient.invalidateQueries({ queryKey: sessionKeys.messages(activeSessionIdForRefresh) })
        queryClient.invalidateQueries({ queryKey: tracingKeys.session(activeSessionIdForRefresh) })
      }
      queryClient.invalidateQueries({ queryKey: sessionKeys.all })
    }
  }

  function handleSendMessage() {
    void sendMessageContent(composer, {
      attachments: composerAttachments,
      clearComposerOnStart: true,
    })
  }

  function handleQueueMessage() {
    const content = composer.trim()
    if (!content || !isStreaming || !queueHasCapacity || pendingInterrupts.length > 0) {
      return
    }

    setStreamError(undefined)
    setQueuePaused(false)
    setQueuedMessages((current) => [...current, createQueuedComposerMessage(content, [])].slice(0, 2))
    setComposer('')
  }

  function handleRemoveQueuedMessage(messageId: string) {
    setQueuePaused(false)
    setQueuedMessages((current) => current.filter((message) => message.id !== messageId))
  }

  async function handleDeleteMessages(indices: number[]) {
    if (!sessionId || indices.length === 0 || isStreaming) {
      return
    }

    const normalizedIndices = [...new Set(indices)].sort((left, right) => left - right)
    const targetLabel = normalizedIndices.length === 1 ? '这条消息' : `这 ${normalizedIndices.length} 条消息`
    if (!window.confirm(`确认删除${targetLabel}？删除后会同步更新会话历史。`)) {
      return
    }

    await deleteSessionMessagesMutation.mutateAsync({
      activeSessionId: sessionId,
      indices: normalizedIndices,
    })
  }

  async function handleResolveInterrupt(interruptId: string, value: Record<string, unknown>) {
    if (!sessionId || isStreaming || pendingInterrupts.length === 0) {
      return
    }

    const targetInterrupt = pendingInterrupts.find((item) => item.interrupt_id === interruptId)
    if (!targetInterrupt) {
      return
    }
    const remainingInterrupts = pendingInterrupts.filter((item) => item.interrupt_id !== interruptId)

    const latestPersistedGroup = stepGroupsRef.current.at(-1)
    const resumeGroup: StepGroup =
      latestPersistedGroup != null
        ? {
            ...latestPersistedGroup,
            steps: [...latestPersistedGroup.steps],
            errorMessage: undefined,
          }
        : {
            turnId: `${sessionId}:resume:${Date.now()}`,
            userContent: '人工确认恢复执行',
            createdAt: new Date().toISOString(),
            steps: [],
          }

    try {
      setStreamError(undefined)
      setInterruptSubmittingId(interruptId)
      setQueuePaused(true)
      setFollowLatest(true)
      setPendingInterrupts(remainingInterrupts)
      updateSessionDetailCache(sessionId, (current) => ({
        ...current,
        interrupts: remainingInterrupts,
        last_error: null,
        status: remainingInterrupts.length > 0 ? 'interrupted' : 'running',
      }))
      setLiveGroup(resumeGroup)
      setLiveTelemetryPreview(undefined)
      onStreamingChange(true)

      await streamSessionResume(
        sessionId,
        {
          interrupt_id: interruptId,
          value,
        },
        (event) => {
          switch (event.event) {
            case 'assistant.step':
              resumeGroup.steps = [
                ...resumeGroup.steps,
                {
                  agentName: event.data.agent_name,
                  content: event.data.content,
                  toolCalls: event.data.tool_calls,
                  timestamp: event.data.timestamp,
                },
              ]
              setLiveTelemetryPreview({
                turnUsage: event.data.turn_usage as Record<string, unknown> | undefined,
                sessionUsage: event.data.session_usage as Record<string, unknown> | undefined,
                turnCostUsd: event.data.turn_cost_usd,
                sessionCostUsd: event.data.session_cost_usd,
              })
              setLiveGroup({ ...resumeGroup })
              break
            case 'session.telemetry':
              setLastTurnMetrics(event.data.metrics)
              setLiveTelemetryPreview({
                turnUsage: event.data.metrics.turn_usage as Record<string, unknown> | undefined,
                sessionUsage: event.data.metrics.session_usage as Record<string, unknown> | undefined,
                turnCostUsd: event.data.metrics.turn_cost_usd,
                sessionCostUsd: event.data.metrics.session_cost_usd,
              })
              break
            case 'session.interrupted':
              resumeGroup.completedAt = event.data.timestamp
              const nextInterrupts =
                event.data.interrupts.length > 0
                  ? event.data.interrupts
                  : event.data.interrupt
                    ? [event.data.interrupt]
                    : []
              if (event.data.metrics) {
                setLastTurnMetrics(event.data.metrics)
              }
              setPendingInterrupts(nextInterrupts)
              setInterruptSubmittingId(undefined)
              setQueuePaused(true)
              updateSessionDetailCache(sessionId, (current) => ({
                ...current,
                interrupts: nextInterrupts,
                last_error: null,
                status: 'interrupted',
              }))
              setLiveGroup({ ...resumeGroup })
              break
            case 'assistant.final':
              resumeGroup.completedAt = event.data.timestamp
              if (typeof event.data.assistant?.content === 'string') {
                resumeGroup.finalContent = event.data.assistant.content
              }
              const assistantMessage = event.data.assistant
              if (assistantMessage) {
                queryClient.setQueryData<ChatMessage[]>(
                  sessionKeys.messages(sessionId),
                  (current = []) => [...current, assistantMessage],
                )
              }
              if (event.data.metrics) {
                setLastTurnMetrics(event.data.metrics)
              }
              setPendingInterrupts([])
              setInterruptSubmittingId(undefined)
              setQueuePaused(false)
              updateSessionDetailCache(sessionId, (current) => ({
                ...current,
                interrupts: [],
                last_error: null,
                last_response: event.data.assistant ?? current.last_response,
                status: 'idle',
              }))
              setLiveTelemetryPreview(undefined)
              setLiveGroup({ ...resumeGroup })
              break
            case 'session.error':
              resumeGroup.errorMessage = event.data.message
              setStreamError(event.data.message)
              setPendingInterrupts([])
              setInterruptSubmittingId(undefined)
              setQueuePaused(false)
              updateSessionDetailCache(sessionId, (current) => ({
                ...current,
                interrupts: [],
                last_error: event.data.message,
                status: 'error',
              }))
              setLiveTelemetryPreview(undefined)
              setLiveGroup({ ...resumeGroup })
              break
            default:
              break
          }
        },
      )

      replaceLastStepGroup(sessionId, resumeGroup)
    } catch (error) {
      const detail = error instanceof Error ? error.message : '提交 interrupt 恢复失败'
      setStreamError(detail)
      setPendingInterrupts((current) => {
        if (current.some((item) => item.interrupt_id === targetInterrupt.interrupt_id)) {
          return current
        }
        return [targetInterrupt, ...current]
      })
      updateSessionDetailCache(sessionId, (current) => ({
        ...current,
        interrupts: current.interrupts?.some((item) => item.interrupt_id === targetInterrupt.interrupt_id)
          ? current.interrupts
          : [targetInterrupt, ...(current.interrupts ?? [])],
        last_error: detail,
        status: 'interrupted',
      }))
    } finally {
      setInterruptSubmittingId(undefined)
      onStreamingChange(false)
      setLiveGroup(undefined)
      setLiveTelemetryPreview(undefined)
      queryClient.invalidateQueries({ queryKey: sessionKeys.detail(sessionId) })
      queryClient.invalidateQueries({ queryKey: sessionKeys.messages(sessionId) })
      queryClient.invalidateQueries({ queryKey: tracingKeys.session(sessionId) })
      queryClient.invalidateQueries({ queryKey: sessionKeys.all })
    }
  }

  const drainQueuedMessage = useEffectEvent(async (nextMessage: QueuedComposerMessage) => {
    const success = await sendMessageContent(nextMessage.content, { attachments: nextMessage.attachments })
    if (!success) {
      setQueuedMessages((current) => [nextMessage, ...current].slice(0, 2))
      setQueuePaused(true)
    }
    queueDrainRef.current = false
  })

  useEffect(() => {
    if (isStreaming || queuePaused || pendingInterrupts.length > 0 || queuedMessages.length === 0 || queueDrainRef.current) {
      return
    }

    const nextMessage = queuedMessages[0]
    queueDrainRef.current = true
    setQueuedMessages((current) => current.filter((message) => message.id !== nextMessage.id))
    void drainQueuedMessage(nextMessage)
  }, [drainQueuedMessage, isStreaming, pendingInterrupts.length, queuePaused, queuedMessages])

  const previewSplitLayout = previewVisible && !narrowViewport
  const streamlinedComposerMode = narrowViewport || previewVisible
  const showComposerUtilityDock = !streamlinedComposerMode
  const chatScrollRegionClassName = previewSplitLayout
    ? 'chat-scroll-region chat-scroll-region-preview'
    : 'chat-scroll-region chat-scroll-region-default'
  const composerShellClassName = streamlinedComposerMode
    ? 'chat-composer-shell chat-composer-shell-streamlined'
    : 'chat-composer-shell'
  const composerDockPositionClassName = streamlinedComposerMode
    ? 'chat-composer-dock chat-composer-dock-streamlined'
    : 'chat-composer-dock'
  const composerSurfaceClassName = streamlinedComposerMode
    ? 'chat-composer-surface chat-composer-surface-streamlined'
    : 'chat-composer-surface'
  const composerFooterClassName = streamlinedComposerMode
    ? 'chat-composer-footer chat-composer-footer-streamlined'
    : 'chat-composer-footer'

  return {
    COMPOSER_FILE_ACCEPT,
    activePreviewError,
    activePreviewRequest,
    activePreviewResult,
    chatScrollRegionClassName,
    chatScrollRegionRef,
    clearComposerAttachments,
    composer,
    composerAttachments,
    composerCanSubmit,
    composerDockHeight,
    composerDockPositionClassName,
    composerDockRef,
    composerFooterClassName,
    composerShellClassName,
    composerSurfaceClassName,
    contentVersion,
    deleteDisabled: deleteSessionMessagesMutation.isPending || isStreaming,
    fileInputRef,
    groups: stepGroups,
    handleChooseFiles,
    handleClosePreviewDock,
    handleDeleteMessages,
    handleResolveInterrupt,
    handleQueueMessage,
    handleRefreshPreviewDock,
    handleRemoveQueuedMessage,
    handleRequestPreview,
    handleResizePreviewTerminal,
    handleRunPreviewCode,
    handleSendMessage,
    handleSendPreviewTerminalInput,
    handleTerminatePreviewTerminal,
    interruptSubmittingId,
    isPreviewRunning: previewBusy,
    isStreaming,
    lastTurnMetrics,
    liveGroup,
    liveTelemetryPreview,
    onAppendFiles: appendComposerFiles,
    onRemoveAttachment: removeComposerAttachment,
    onScrollToLatest: () => scrollToLatest('smooth'),
    pendingInterrupts,
    previewSplitLayout,
    previewVisible,
    queueButtonDisabled,
    queueHasCapacity,
    queuePaused,
    queuedMessages,
    setComposer,
    showComposerUtilityDock,
    showEmptyConversation,
    showJumpToLatest,
    streamlinedComposerMode,
    streamError,
    telemetryCounts,
    todoItems,
    turns,
  }
}
