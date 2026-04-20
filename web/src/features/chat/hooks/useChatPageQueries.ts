import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import type { TraceExportResult, SessionSummary } from '../../../shared/api/contracts'
import { clearSessionPreview, clearLastSessionId, clearStepGroups, readLastSessionId, saveLastSessionId } from '../../../shared/lib/storage'
import { getMeta, metaKeys } from '../../meta/api'
import {
  getRuntimeRequirements,
  getRuntimeToolCatalog,
  getRuntimeWorkflowCatalog,
  runtimeKeys,
} from '../../runtime/api'
import {
  createSession,
  deleteSession,
  getSessionDetail,
  getSessionMessages,
  listSessions,
  sessionKeys,
  updateSession,
} from '../../sessions/api'
import { exportRuntimeTrace, exportSessionTrace, getRuntimeTracingStatus, getSessionTracingStatus, tracingKeys } from '../../tracing/api'
import { buildSessionUpdatePayload, type SessionDraft } from '../../sessions/constants'


type UseChatPageQueriesOptions = {
  isStreaming: boolean
  onConfigError: (message: string) => void
  onTraceExport: (payload: TraceExportResult) => void
  sessionId?: string
}

function documentHidden() {
  return typeof document !== 'undefined' && document.visibilityState !== 'visible'
}


export function useChatPageQueries({
  isStreaming,
  onConfigError,
  onTraceExport,
  sessionId,
}: UseChatPageQueriesOptions) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const sessionsQuery = useQuery({
    queryKey: sessionKeys.all,
    queryFn: listSessions,
    staleTime: 5_000,
    refetchInterval: (query) => {
      const sessions = query.state.data as SessionSummary[] | undefined
      if (isStreaming) {
        return documentHidden() ? 2_500 : 1_200
      }
      if (sessions?.some((item) => item.status === 'running' || item.status === 'interrupted')) {
        return documentHidden() ? 6_000 : 3_000
      }
      return documentHidden() ? 20_000 : 10_000
    },
  })
  const metaQuery = useQuery({
    queryKey: metaKeys.all,
    queryFn: getMeta,
    staleTime: 60_000,
  })
  const runtimeRequirementsQuery = useQuery({
    queryKey: runtimeKeys.requirements,
    queryFn: getRuntimeRequirements,
    staleTime: 60_000,
  })
  const runtimeToolCatalogQuery = useQuery({
    queryKey: runtimeKeys.toolCatalog,
    queryFn: getRuntimeToolCatalog,
    staleTime: 60_000,
  })
  const runtimeWorkflowCatalogQuery = useQuery({
    queryKey: runtimeKeys.workflowCatalog,
    queryFn: getRuntimeWorkflowCatalog,
    staleTime: 60_000,
  })
  const runtimeTracingQuery = useQuery({
    queryKey: tracingKeys.runtime,
    queryFn: getRuntimeTracingStatus,
    staleTime: 5_000,
  })
  const sessionDetailQuery = useQuery({
    queryKey: sessionId ? sessionKeys.detail(sessionId) : ['sessions', 'detail', 'empty'],
    queryFn: () => getSessionDetail(sessionId!),
    enabled: Boolean(sessionId),
    refetchInterval: (query) => {
      const detail = query.state.data as SessionSummary | undefined
      if (isStreaming) {
        return documentHidden() ? 2_500 : 1_200
      }
      if (detail?.status === 'running' || detail?.status === 'interrupted') {
        return documentHidden() ? 5_000 : 2_000
      }
      return sessionId ? (documentHidden() ? 15_000 : 8_000) : false
    },
  })
  const sessionMessagesQuery = useQuery({
    queryKey: sessionId ? sessionKeys.messages(sessionId) : ['sessions', 'messages', 'empty'],
    queryFn: () => getSessionMessages(sessionId!),
    enabled: Boolean(sessionId),
    refetchInterval: sessionId ? (isStreaming ? (documentHidden() ? 2_500 : 1_200) : documentHidden() ? 12_000 : 6_000) : false,
  })
  const sessionTracingQuery = useQuery({
    queryKey: sessionId ? tracingKeys.session(sessionId) : ['tracing', 'session', 'empty'],
    queryFn: () => getSessionTracingStatus(sessionId!),
    enabled: Boolean(sessionId),
  })

  const createSessionMutation = useMutation({
    mutationFn: createSession,
    onSuccess: (detail) => {
      queryClient.setQueryData(sessionKeys.detail(detail.session_id), detail)
      queryClient.setQueryData(sessionKeys.messages(detail.session_id), [])
      queryClient.invalidateQueries({ queryKey: sessionKeys.all })
      saveLastSessionId(detail.session_id)
      navigate(`/chat/${detail.session_id}`)
    },
  })
  const updateSessionMutation = useMutation({
    mutationFn: ({
      activeSessionId,
      draft,
    }: {
      activeSessionId: string
      draft: SessionDraft
    }) => updateSession(activeSessionId, buildSessionUpdatePayload(draft)),
    onSuccess: (detail) => {
      queryClient.setQueryData(sessionKeys.detail(detail.session_id), detail)
      queryClient.invalidateQueries({ queryKey: sessionKeys.all })
    },
  })
  const deleteSessionMutation = useMutation({
    mutationFn: deleteSession,
    onError: (error) => {
      onConfigError(error instanceof Error ? error.message : '删除会话失败')
    },
    onSuccess: (_, deletedSessionId) => {
      queryClient.setQueryData<SessionSummary[]>(sessionKeys.all, (current = []) =>
        current.filter((item) => item.session_id !== deletedSessionId),
      )
      queryClient.invalidateQueries({ queryKey: sessionKeys.all })
      queryClient.removeQueries({ queryKey: sessionKeys.detail(deletedSessionId) })
      queryClient.removeQueries({ queryKey: sessionKeys.messages(deletedSessionId) })
      clearStepGroups(deletedSessionId)
      clearSessionPreview(deletedSessionId)

      if (readLastSessionId() === deletedSessionId) {
        clearLastSessionId()
      }
      if (sessionId === deletedSessionId) {
        navigate('/chat?mode=new')
      }
    },
  })
  const exportSessionTraceMutation = useMutation({
    mutationFn: (activeSessionId: string) => exportSessionTrace(activeSessionId),
    onSuccess: (payload) => {
      onTraceExport(payload)
      if (sessionId) {
        queryClient.invalidateQueries({ queryKey: tracingKeys.session(sessionId) })
      }
    },
  })
  const exportRuntimeTraceMutation = useMutation({
    mutationFn: exportRuntimeTrace,
    onSuccess: (payload) => {
      onTraceExport(payload)
      queryClient.invalidateQueries({ queryKey: tracingKeys.runtime })
    },
  })

  return {
    createSessionMutation,
    deleteSessionMutation,
    exportRuntimeTraceMutation,
    exportSessionTraceMutation,
    metaQuery,
    runtimeRequirementsQuery,
    runtimeToolCatalogQuery,
    runtimeWorkflowCatalogQuery,
    runtimeTracingQuery,
    sessionDetailQuery,
    sessionMessagesQuery,
    sessionTracingQuery,
    sessionsQuery,
    updateSessionMutation,
  }
}
