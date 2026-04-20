import { useEffect, useMemo, useState } from 'react'
import type { NavigateFunction } from 'react-router-dom'

import type { RuntimeToolCatalog, SessionDetail } from '../../../shared/api/contracts'
import { saveLastSessionId } from '../../../shared/lib/storage'
import {
  applyHitlApprovalPreset,
  applyHitlQuestionPreset,
  buildToolOptionsFromCatalog,
  buildSessionCreatePayload,
  DEFAULT_SESSION_DRAFT,
  ensureHitlDraftSafety,
  getDefaultEnabledTools,
  sessionDetailToDraft,
  type SessionDraft,
} from '../../sessions/constants'
import type { ConfigSaveState } from '../pages/chatPageTypes'


type UseChatSessionStateOptions = {
  createSession: (payload: ReturnType<typeof buildSessionCreatePayload>) => Promise<unknown>
  currentSession?: SessionDetail
  headerTitle: string
  navigate: NavigateFunction
  newSessionMode: boolean
  runtimeToolCatalog?: RuntimeToolCatalog
  sessionId?: string
  setHeaderTitle: (title: string) => void
  supportsDynamicSessionConfig: boolean
  updateSession: (activeSessionId: string, draft: SessionDraft) => Promise<unknown>
}


export function useChatSessionState({
  createSession,
  currentSession,
  headerTitle,
  navigate,
  newSessionMode,
  runtimeToolCatalog,
  sessionId,
  setHeaderTitle,
  supportsDynamicSessionConfig,
  updateSession,
}: UseChatSessionStateOptions) {
  const [searchTerm, setSearchTerm] = useState('')
  const [draft, setDraft] = useState<SessionDraft>(DEFAULT_SESSION_DRAFT)
  const [sessionConfig, setSessionConfig] = useState<SessionDraft>()
  const [configError, setConfigError] = useState<string>()
  const [configSaveState, setConfigSaveState] = useState<ConfigSaveState>('idle')
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(true)
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(true)
  const [composerCollapsed, setComposerCollapsed] = useState(false)
  const [pendingToolCatalogHydration, setPendingToolCatalogHydration] = useState(true)
  const [narrowViewport, setNarrowViewport] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 1024px)').matches : false,
  )

  const activeConfig = useMemo(
    () => (currentSession ? (sessionConfig ?? sessionDetailToDraft(currentSession)) : draft),
    [currentSession, draft, sessionConfig],
  )
  const activeEnabledTools = activeConfig.enabledTools
  const sessionConfigReadOnly = Boolean(currentSession && !supportsDynamicSessionConfig)

  useEffect(() => {
    const title = currentSession?.title || (newSessionMode ? '新会话' : 'Session Monitor')
    if (headerTitle !== title) {
      setHeaderTitle(title)
    }
  }, [currentSession?.title, headerTitle, newSessionMode, setHeaderTitle])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const mediaQuery = window.matchMedia('(max-width: 1024px)')
    const syncViewport = () => {
      setNarrowViewport(mediaQuery.matches)
    }

    syncViewport()
    mediaQuery.addEventListener('change', syncViewport)
    return () => {
      mediaQuery.removeEventListener('change', syncViewport)
    }
  }, [])

  useEffect(() => {
    if (!currentSession) {
      setSessionConfig(undefined)
      return
    }
    setSessionConfig(sessionDetailToDraft(currentSession))
  }, [currentSession?.session_id, currentSession?.updated_at])

  useEffect(() => {
    if (currentSession || !pendingToolCatalogHydration || !runtimeToolCatalog?.tools?.length) {
      return
    }

    const catalogDefaults = getDefaultEnabledTools(buildToolOptionsFromCatalog(runtimeToolCatalog))
    const currentSignature = [...draft.enabledTools].sort().join('|')
    const defaultSignature = [...DEFAULT_SESSION_DRAFT.enabledTools].sort().join('|')

    if (currentSignature === defaultSignature) {
      setDraft((current) =>
        ensureHitlDraftSafety({
          ...current,
          enabledTools: catalogDefaults,
        }),
      )
    }
    setPendingToolCatalogHydration(false)
  }, [currentSession, draft.enabledTools, pendingToolCatalogHydration, runtimeToolCatalog])

  useEffect(() => {
    if (configSaveState !== 'saved') {
      return undefined
    }
    const timer = window.setTimeout(() => setConfigSaveState('idle'), 1500)
    return () => window.clearTimeout(timer)
  }, [configSaveState])

  useEffect(() => {
    if (sessionId) {
      saveLastSessionId(sessionId)
    }
  }, [sessionId])

  function updateCreateDraft(patch: Partial<SessionDraft>) {
    setConfigError(undefined)
    setDraft((current) => ensureHitlDraftSafety({ ...current, ...patch }))
    if (Object.prototype.hasOwnProperty.call(patch, 'enabledTools')) {
      setPendingToolCatalogHydration(false)
    }
  }

  function updateCurrentSessionDraft(patch: Partial<SessionDraft>, { autoSave = false } = {}) {
    if (sessionConfigReadOnly) {
      setConfigError('当前后端不支持会话创建后的动态配置，右侧配置面板仅供查看。')
      return
    }

    const base = sessionConfig ?? (currentSession ? sessionDetailToDraft(currentSession) : DEFAULT_SESSION_DRAFT)
    const nextConfig = ensureHitlDraftSafety({ ...base, ...patch })
    setConfigError(undefined)
    setSessionConfig(nextConfig)
    if (autoSave && currentSession) {
      void persistCurrentSessionConfig(nextConfig)
    }
  }

  function handleConfigChange(patch: Partial<SessionDraft>) {
    if (currentSession) {
      updateCurrentSessionDraft(patch)
      return
    }
    updateCreateDraft(patch)
  }

  function handleQuickConfigChange(patch: Partial<SessionDraft>) {
    if (currentSession) {
      updateCurrentSessionDraft(patch, { autoSave: true })
      return
    }
    updateCreateDraft(patch)
  }

  function handleToggleTool(toolName: string) {
    if (currentSession) {
      const base = sessionConfig ?? sessionDetailToDraft(currentSession)
      setSessionConfig(ensureHitlDraftSafety({
        ...base,
        enabledTools: base.enabledTools.includes(toolName)
          ? base.enabledTools.filter((item) => item !== toolName)
          : [...base.enabledTools, toolName],
      }))
      setConfigError(undefined)
      return
    }

    setDraft((current) => ensureHitlDraftSafety({
      ...current,
      enabledTools: current.enabledTools.includes(toolName)
        ? current.enabledTools.filter((item) => item !== toolName)
        : [...current.enabledTools, toolName],
    }))
    setConfigError(undefined)
  }

  function handleComposeNewSession() {
    setConfigError(undefined)
    setDraft(DEFAULT_SESSION_DRAFT)
    setPendingToolCatalogHydration(true)
    navigate('/chat?mode=new')
  }

  function handleSelectSession(activeSessionId: string) {
    navigate(`/chat/${activeSessionId}`)
  }

  async function persistCurrentSessionConfig(nextConfig: SessionDraft) {
    if (!currentSession) {
      return
    }
    if (sessionConfigReadOnly) {
      setConfigError('当前后端不支持会话创建后的动态配置，无法保存修改。')
      setConfigSaveState('error')
      return
    }

    try {
      setConfigError(undefined)
      setConfigSaveState('saving')
      await updateSession(currentSession.session_id, nextConfig)
      setConfigSaveState('saved')
    } catch (error) {
      setConfigSaveState('error')
      setConfigError(error instanceof Error ? error.message : '保存会话配置失败')
    }
  }

  async function handleCreateSession() {
    try {
      setConfigError(undefined)
      await createSession(buildSessionCreatePayload(draft))
    } catch (error) {
      setConfigError(error instanceof Error ? error.message : '创建失败')
    }
  }

  async function handleSaveCurrentSession() {
    if (!currentSession) {
      return
    }
    await persistCurrentSessionConfig(activeConfig)
  }

  function handleResetConfig() {
    setConfigError(undefined)
    if (currentSession) {
      setSessionConfig(sessionDetailToDraft(currentSession))
      setConfigSaveState('idle')
      return
    }
    setDraft(DEFAULT_SESSION_DRAFT)
    setPendingToolCatalogHydration(true)
  }

  function handleApplyHitlQuestionPreset() {
    if (currentSession) {
      updateCurrentSessionDraft(applyHitlQuestionPreset(activeConfig))
      return
    }
    setDraft(applyHitlQuestionPreset(draft))
    setConfigError(undefined)
  }

  function handleApplyHitlApprovalPreset() {
    if (currentSession) {
      updateCurrentSessionDraft(applyHitlApprovalPreset(activeConfig))
      return
    }
    setDraft(applyHitlApprovalPreset(draft))
    setConfigError(undefined)
  }

  return {
    activeConfig,
    activeEnabledTools,
    composerCollapsed,
    configError,
    configSaveState,
    currentSessionConfig: sessionConfig,
    draft,
    handleComposeNewSession,
    handleApplyHitlApprovalPreset,
    handleApplyHitlQuestionPreset,
    handleConfigChange,
    handleCreateSession,
    handleQuickConfigChange,
    handleResetConfig,
    handleSaveCurrentSession,
    handleSelectSession,
    handleToggleTool,
    leftSidebarCollapsed,
    narrowViewport,
    rightSidebarCollapsed,
    searchTerm,
    sessionConfigReadOnly,
    setComposerCollapsed,
    setConfigError,
    setCurrentSessionConfig: setSessionConfig,
    setDraft,
    setLeftSidebarCollapsed,
    setRightSidebarCollapsed,
    setSearchTerm,
  }
}
