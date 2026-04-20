import { useEffect, useRef, useState } from 'react'

import type { PreviewRunResponse } from '../../../shared/api/contracts'
import { clearSessionPreview, loadSessionPreview, saveSessionPreview } from '../../../shared/lib/storage'
import {
  getSessionPreviewRun,
  resizeSessionPreviewTerminal,
  runSessionPreview,
  sendSessionPreviewTerminalInput,
  terminateSessionPreviewRun,
} from '../../previews/api'
import type { PreviewRequestLanguage } from '../../previews/previewCode'
import type { ActivePreviewRequest } from '../pages/chatPageTypes'

type UsePreviewControllerOptions = {
  currentSessionId?: string
  onPreviewWillOpen?: () => void
  onReportError: (message: string) => void
  sessionId?: string
  supportsPreview: boolean
}

export function usePreviewController({
  currentSessionId,
  onPreviewWillOpen,
  onReportError,
  sessionId,
  supportsPreview,
}: UsePreviewControllerOptions) {
  const [activePreviewRequest, setActivePreviewRequest] = useState<ActivePreviewRequest>()
  const [activePreviewResult, setActivePreviewResult] = useState<PreviewRunResponse>()
  const [activePreviewError, setActivePreviewError] = useState<string>()
  const [isSubmittingPreview, setIsSubmittingPreview] = useState(false)
  const previewTerminalInputQueueRef = useRef<string[]>([])
  const previewTerminalInputSendingRef = useRef(false)

  const previewBusy = isSubmittingPreview || activePreviewResult?.status === 'running'

  async function terminateActiveTerminalPreview() {
    if (
      !activePreviewRequest?.sessionId ||
      !activePreviewResult?.run_id ||
      activePreviewResult.mode !== 'terminal' ||
      activePreviewResult.status !== 'running'
    ) {
      return
    }

    try {
      await terminateSessionPreviewRun(activePreviewRequest.sessionId, activePreviewResult.run_id)
    } catch {
      // 这里是清理型调用，不阻塞新预览或会话切换。
    }
  }

  function resetPreviewState() {
    setActivePreviewRequest(undefined)
    setActivePreviewResult(undefined)
    setActivePreviewError(undefined)
    setIsSubmittingPreview(false)
  }

  async function executePreviewRequest(
    request: ActivePreviewRequest,
    options?: { preserveResult?: boolean },
  ) {
    await terminateActiveTerminalPreview()
    onPreviewWillOpen?.()
    setActivePreviewRequest(request)
    if (!options?.preserveResult) {
      setActivePreviewResult(undefined)
    }
    setActivePreviewError(undefined)
    setIsSubmittingPreview(true)

    try {
      const result = await runSessionPreview(request.sessionId, {
        code: request.code,
        language: request.language,
      })
      setActivePreviewResult(result)
      setActivePreviewError(undefined)
    } catch (error) {
      setActivePreviewResult(undefined)
      setActivePreviewError(error instanceof Error ? error.message : '预览运行失败')
    } finally {
      setIsSubmittingPreview(false)
    }
  }

  function handleRequestPreview(payload: {
    code: string
    key: string
    language: PreviewRequestLanguage
  }) {
    if (!supportsPreview) {
      onReportError('当前后端未开启预览能力，无法运行代码预览。')
      return
    }

    if (!currentSessionId) {
      onReportError('当前会话尚未加载完成，暂时无法运行预览')
      return
    }

    void executePreviewRequest({
      ...payload,
      sessionId: currentSessionId,
    })
  }

  function handleClosePreviewDock() {
    void terminateActiveTerminalPreview()

    if (sessionId) {
      clearSessionPreview(sessionId)
    }
    resetPreviewState()
  }

  function handleRefreshPreviewDock() {
    if (!activePreviewRequest) {
      return
    }

    if (activePreviewResult?.run_id && activePreviewResult.mode === 'terminal') {
      void getSessionPreviewRun(activePreviewRequest.sessionId, activePreviewResult.run_id)
        .then((nextResult) => {
          setActivePreviewResult(nextResult)
          setActivePreviewError(undefined)
        })
        .catch((error) => {
          setActivePreviewError(error instanceof Error ? error.message : '刷新终端预览失败')
        })
      return
    }

    void executePreviewRequest(activePreviewRequest, { preserveResult: true })
  }

  function handleRunPreviewCode(nextCode: string) {
    if (!activePreviewRequest) {
      return
    }

    if (nextCode === activePreviewRequest.code && !activePreviewError) {
      void executePreviewRequest(activePreviewRequest, { preserveResult: true })
      return
    }

    void executePreviewRequest(
      {
        ...activePreviewRequest,
        code: nextCode,
      },
      { preserveResult: true },
    )
  }

  async function flushPreviewTerminalInputQueue() {
    if (!activePreviewRequest?.sessionId || !activePreviewResult?.run_id) {
      return
    }
    if (previewTerminalInputSendingRef.current) {
      return
    }

    previewTerminalInputSendingRef.current = true
    try {
      while (previewTerminalInputQueueRef.current.length > 0) {
        const text = previewTerminalInputQueueRef.current.join('')
        previewTerminalInputQueueRef.current = []

        const nextResult = await sendSessionPreviewTerminalInput(activePreviewRequest.sessionId, activePreviewResult.run_id, {
          append_newline: false,
          text,
        })
        setActivePreviewResult(nextResult)
        setActivePreviewError(undefined)
      }
    } catch (error) {
      setActivePreviewError(error instanceof Error ? error.message : '终端输入发送失败')
    } finally {
      previewTerminalInputSendingRef.current = false
    }
  }

  async function handleSendPreviewTerminalInput(text: string, appendNewline = true) {
    if (!text && !appendNewline) {
      return
    }

    previewTerminalInputQueueRef.current.push(text + (appendNewline ? '\n' : ''))
    await flushPreviewTerminalInputQueue()
  }

  async function handleTerminatePreviewTerminal() {
    if (!activePreviewRequest?.sessionId || !activePreviewResult?.run_id) {
      return
    }

    try {
      const nextResult = await terminateSessionPreviewRun(activePreviewRequest.sessionId, activePreviewResult.run_id)
      setActivePreviewResult(nextResult)
      setActivePreviewError(undefined)
    } catch (error) {
      setActivePreviewError(error instanceof Error ? error.message : '终止终端预览失败')
    }
  }

  async function handleResizePreviewTerminal(cols: number, rows: number) {
    if (!activePreviewRequest?.sessionId || !activePreviewResult?.run_id) {
      return
    }

    try {
      const nextResult = await resizeSessionPreviewTerminal(activePreviewRequest.sessionId, activePreviewResult.run_id, {
        cols,
        rows,
      })
      setActivePreviewResult(nextResult)
      setActivePreviewError(undefined)
    } catch (error) {
      setActivePreviewError(error instanceof Error ? error.message : '同步终端尺寸失败')
    }
  }

  useEffect(() => {
    resetPreviewState()
    previewTerminalInputQueueRef.current = []
    previewTerminalInputSendingRef.current = false

    const storedPreview = loadSessionPreview(sessionId)
    if (!sessionId || !storedPreview?.runId) {
      return
    }

    const restoredRequest = storedPreview.request
    if (!restoredRequest || restoredRequest.sessionId !== sessionId) {
      clearSessionPreview(sessionId)
      return
    }

    queueMicrotask(() => {
      setActivePreviewRequest({
        ...restoredRequest,
        language: restoredRequest.language as PreviewRequestLanguage,
      })

      void getSessionPreviewRun(sessionId, storedPreview.runId!)
        .then((result) => {
          setActivePreviewResult(result)
          setActivePreviewError(result.error || undefined)
        })
        .catch(() => {
          clearSessionPreview(sessionId)
          resetPreviewState()
        })
    })
  }, [sessionId])

  useEffect(() => {
    if (!sessionId || !activePreviewRequest || activePreviewRequest.sessionId !== sessionId) {
      return
    }

    saveSessionPreview(sessionId, {
      request: activePreviewRequest,
      runId: activePreviewResult?.run_id,
    })
  }, [activePreviewRequest, activePreviewResult?.run_id, sessionId])

  useEffect(() => {
    if (
      !activePreviewRequest?.sessionId ||
      !activePreviewResult?.run_id ||
      activePreviewResult.status !== 'running'
    ) {
      return undefined
    }

    let cancelled = false
    let timer = 0

    const pollPreviewRun = async () => {
      try {
        const nextResult = await getSessionPreviewRun(activePreviewRequest.sessionId, activePreviewResult.run_id)
        if (cancelled) {
          return
        }
        setActivePreviewResult(nextResult)
        setActivePreviewError(nextResult.error || undefined)
        if (nextResult.status === 'running') {
          timer = window.setTimeout(() => {
            void pollPreviewRun()
          }, 360)
        }
      } catch (error) {
        if (!cancelled) {
          setActivePreviewError(error instanceof Error ? error.message : '同步预览状态失败')
        }
      }
    }

    timer = window.setTimeout(() => {
      void pollPreviewRun()
    }, 360)

    return () => {
      cancelled = true
      if (timer) {
        window.clearTimeout(timer)
      }
    }
  }, [activePreviewRequest?.sessionId, activePreviewResult?.run_id, activePreviewResult?.status])

  useEffect(() => {
    if (supportsPreview || !activePreviewRequest) {
      return
    }

    void terminateActiveTerminalPreview()

    if (sessionId) {
      clearSessionPreview(sessionId)
    }
    resetPreviewState()
  }, [
    activePreviewRequest,
    activePreviewResult?.mode,
    activePreviewResult?.run_id,
    activePreviewResult?.status,
    sessionId,
    supportsPreview,
  ])

  return {
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
    previewVisible: supportsPreview && Boolean(activePreviewRequest),
  }
}
