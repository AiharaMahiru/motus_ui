import { useEffect, useMemo, useState } from 'react'

import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { useLayout } from '../../../app/LayoutContext'
import { ApiError } from '../../../shared/api/client'
import type { TraceExportResult } from '../../../shared/api/contracts'
import { copyTextToClipboard } from '../../../shared/lib/clipboard'
import { clearLastSessionId, clearStepGroups, readLastSessionId } from '../../../shared/lib/storage'
import { buildSessionCreatePayload, buildToolOptionsFromCatalog } from '../../sessions/constants'
import { useChatComposerController } from './useChatComposerController'
import { useChatPageQueries } from './useChatPageQueries'
import { useChatSessionState } from './useChatSessionState'
import {
  buildSessionMarkdownExport,
  downloadMarkdownFile,
  normalizeExportFileName,
  sessionExportTitle,
} from '../lib/sessionExport'


export function useChatPageController() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { headerTitle, setHeaderTitle, activeInspectorTab, setActiveInspectorTab } = useLayout()
  const [isStreaming, setIsStreaming] = useState(false)
  const [lastTraceExport, setLastTraceExport] = useState<TraceExportResult>()
  const [queryConfigError, setQueryConfigError] = useState<string>()
  const [pendingDeleteSessionId, setPendingDeleteSessionId] = useState<string>()

  const newSessionMode = searchParams.get('mode') === 'new'
  const queries = useChatPageQueries({
    isStreaming,
    onConfigError: setQueryConfigError,
    onTraceExport: setLastTraceExport,
    sessionId,
  })

  const supportsInterrupts = queries.metaQuery.data?.supports_interrupts ?? false
  const supportsDynamicSessionConfig = queries.metaQuery.data?.supports_dynamic_session_config ?? true
  const supportsPreview = queries.metaQuery.data?.supports_preview ?? true
  const supportsStructuredResponseFormat = queries.metaQuery.data?.supports_structured_response_format ?? false

  const sessionState = useChatSessionState({
    createSession: (payload) => queries.createSessionMutation.mutateAsync(payload),
    currentSession: queries.sessionDetailQuery.data,
    headerTitle,
    navigate,
    newSessionMode,
    runtimeToolCatalog: queries.runtimeToolCatalogQuery.data,
    sessionId,
    setHeaderTitle,
    supportsDynamicSessionConfig,
    updateSession: (activeSessionId, draft) => queries.updateSessionMutation.mutateAsync({ activeSessionId, draft }),
  })

  const filteredSessions = useMemo(() => {
    const source = queries.sessionsQuery.data ?? []
    if (!sessionState.searchTerm.trim()) {
      return source
    }
    const keyword = sessionState.searchTerm.trim().toLowerCase()
    return source.filter((item) => (item.title || item.session_id).toLowerCase().includes(keyword))
  }, [queries.sessionsQuery.data, sessionState.searchTerm])

  const pendingDeleteSession = useMemo(
    () => (queries.sessionsQuery.data ?? []).find((item) => item.session_id === pendingDeleteSessionId),
    [pendingDeleteSessionId, queries.sessionsQuery.data],
  )

  const composerController = useChatComposerController({
    currentSession: queries.sessionDetailQuery.data,
    ensureActiveSessionId: async () => {
      if (sessionId) {
        return sessionId
      }
      const detail = await queries.createSessionMutation.mutateAsync(buildSessionCreatePayload(sessionState.draft))
      return detail.session_id
    },
    isStreaming,
    narrowViewport: sessionState.narrowViewport,
    onConfigError: (message) => {
      if (message) {
        sessionState.setConfigError(message)
      }
    },
    onSetComposerCollapsed: sessionState.setComposerCollapsed,
    onSetRightSidebarCollapsed: sessionState.setRightSidebarCollapsed,
    onStreamingChange: setIsStreaming,
    sessionId,
    sessionMessages: queries.sessionMessagesQuery.data ?? [],
    supportsPreview,
  })

  useEffect(() => {
    if (!sessionId && !newSessionMode && queries.sessionsQuery.data?.length) {
      const rememberedSessionId = readLastSessionId()
      const fallbackSession = queries.sessionsQuery.data.find((item) => item.session_id === rememberedSessionId)
      if (fallbackSession) {
        navigate(`/chat/${fallbackSession.session_id}`, { replace: true })
      }
    }
  }, [navigate, newSessionMode, queries.sessionsQuery.data, sessionId])

  useEffect(() => {
    if (!sessionId) {
      return
    }
    if (!(queries.sessionDetailQuery.error instanceof ApiError) || queries.sessionDetailQuery.error.status !== 404) {
      return
    }

    clearStepGroups(sessionId)

    if (readLastSessionId() === sessionId) {
      clearLastSessionId()
    }

    const fallbackSessions = (queries.sessionsQuery.data ?? []).filter((item) => item.session_id !== sessionId)
    const rememberedSessionId = readLastSessionId()
    const rememberedFallback = fallbackSessions.find((item) => item.session_id === rememberedSessionId)
    const nextSession = rememberedFallback ?? fallbackSessions[0]

    sessionState.setConfigError('当前会话不存在，已切换到可用会话。')
    navigate(nextSession ? `/chat/${nextSession.session_id}` : '/chat?mode=new', { replace: true })
  }, [navigate, queries.sessionDetailQuery.error, queries.sessionsQuery.data, sessionId, sessionState.setConfigError])

  useEffect(() => {
    if (!pendingDeleteSessionId || queries.deleteSessionMutation.isPending) {
      return
    }
    if (pendingDeleteSession) {
      return
    }
    setPendingDeleteSessionId(undefined)
  }, [pendingDeleteSession, pendingDeleteSessionId, queries.deleteSessionMutation.isPending])

  const markdownExportContent = useMemo(() => {
    if (!queries.sessionDetailQuery.data) {
      return ''
    }
    return buildSessionMarkdownExport(queries.sessionDetailQuery.data, queries.sessionMessagesQuery.data ?? [])
  }, [queries.sessionDetailQuery.data, queries.sessionMessagesQuery.data])
  const canExportSession = Boolean(queries.sessionDetailQuery.data)
  const workbenchMenuItems = useMemo(
    () => [
      {
        disabled: !canExportSession,
        id: 'copy-markdown',
        label: '复制 Markdown',
        onSelect: async () => {
          if (!markdownExportContent) {
            return
          }
          try {
            await copyTextToClipboard(markdownExportContent)
          } catch (error) {
            sessionState.setConfigError(error instanceof Error ? error.message : '复制 Markdown 失败')
          }
        },
      },
      {
        disabled: !canExportSession,
        id: 'download-markdown',
        label: '下载 Markdown',
        onSelect: async () => {
          if (!queries.sessionDetailQuery.data || !markdownExportContent) {
            return
          }
          downloadMarkdownFile(
            `${normalizeExportFileName(sessionExportTitle(queries.sessionDetailQuery.data))}.md`,
            markdownExportContent,
          )
        },
      },
    ],
    [canExportSession, markdownExportContent, queries.sessionDetailQuery.data, sessionState.setConfigError],
  )

  return {
    ...composerController,
    ...queries,
    ...sessionState,
    activeInspectorTab,
    canExportSession,
    currentSession: queries.sessionDetailQuery.data,
    exportRuntimeTraceMutation: queries.exportRuntimeTraceMutation,
    exportSessionTraceMutation: queries.exportSessionTraceMutation,
    handleOpenAdvancedConfig: () => setActiveInspectorTab('session'),
    isCreatingSession: queries.createSessionMutation.isPending,
    lastTraceExport,
    mainPanelClassName: composerController.previewSplitLayout ? 'main-panel-preview' : 'main-panel',
    meta: queries.metaQuery.data,
    filteredSessions,
    runtimeRequirements: queries.runtimeRequirementsQuery.data,
    runtimeToolCatalog: queries.runtimeToolCatalogQuery.data,
    runtimeWorkflowCatalog: queries.runtimeWorkflowCatalogQuery.data,
    runtimeTracingStatus: queries.runtimeTracingQuery.data,
    sessionId,
    sessionTracingStatus: queries.sessionTracingQuery.data,
    supportsInterrupts,
    supportsPreview,
    supportsStructuredResponseFormat,
    availableToolOptions: buildToolOptionsFromCatalog(queries.runtimeToolCatalogQuery.data),
    updateSessionPending: queries.updateSessionMutation.isPending || sessionState.sessionConfigReadOnly,
    workbenchMenuItems,
    configError: sessionState.configError || queryConfigError,
    deleteSessionConfirming: queries.deleteSessionMutation.isPending,
    deletingSessionId: queries.deleteSessionMutation.isPending ? queries.deleteSessionMutation.variables : undefined,
    pendingDeleteSession,
    handleCancelDeleteSession: () => {
      if (queries.deleteSessionMutation.isPending) {
        return
      }
      setPendingDeleteSessionId(undefined)
    },
    handleConfirmDeleteSession: async () => {
      if (!pendingDeleteSessionId || queries.deleteSessionMutation.isPending) {
        return
      }
      try {
        await queries.deleteSessionMutation.mutateAsync(pendingDeleteSessionId)
        setPendingDeleteSessionId(undefined)
      } catch {
        // 删除失败时保留弹窗，允许用户重试或取消。
      }
    },
    setActiveInspectorTab,
    onDeleteSession: (activeSessionId: string) => setPendingDeleteSessionId(activeSessionId),
  }
}
