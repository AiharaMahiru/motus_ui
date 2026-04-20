import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'

import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import python from 'highlight.js/lib/languages/python'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import {
  Check,
  Code2,
  Copy,
  Eye,
  LoaderCircle,
  Ratio,
  RefreshCcw,
  Send,
  Square,
  TriangleAlert,
  X,
} from 'lucide-react'

import { copyTextToClipboard } from '../../../shared/lib/clipboard'
import type { PreviewRunResponse } from '../../../shared/api/contracts'
import { useI18n } from '../../../shared/i18n/I18nContext'
import { formatPreviewLanguageLabel, type PreviewRequestLanguage } from '../previewCode'
import { PreviewTerminalConsole } from './PreviewTerminalConsole'


type PreviewDockProps = {
  activeRequest?: {
    code: string
    key: string
    language: PreviewRequestLanguage
    sessionId: string
  }
  error?: string
  isRunning: boolean
  onClose: () => void
  onRefresh: () => void
  onRunCode?: (code: string) => void
  onResizeTerminal?: (cols: number, rows: number) => Promise<void> | void
  onSendTerminalInput?: (text: string, appendNewline?: boolean) => Promise<void> | void
  onTerminateTerminal?: () => Promise<void> | void
  response?: PreviewRunResponse
  variant?: 'overlay' | 'split'
}

type PreviewAspectRatio = '16:9' | '4:3' | '3:4' | '9:16'
type PreviewDockView = 'preview' | 'code'

type PreviewViewportSize = {
  height: number
  width: number
}

const PREVIEW_ASPECT_RATIO_OPTIONS: Array<{
  label: PreviewAspectRatio
  value: PreviewAspectRatio
}> = [
  { label: '16:9', value: '16:9' },
  { label: '4:3', value: '4:3' },
  { label: '3:4', value: '3:4' },
  { label: '9:16', value: '9:16' },
]

const PREVIEW_ASPECT_RATIO_VALUES: Record<PreviewAspectRatio, number> = {
  '16:9': 16 / 9,
  '4:3': 4 / 3,
  '3:4': 3 / 4,
  '9:16': 9 / 16,
}

function registerPreviewHighlightLanguages() {
  if (!hljs.getLanguage('xml')) {
    hljs.registerLanguage('xml', xml)
  }
  if (!hljs.getLanguage('html')) {
    hljs.registerLanguage('html', xml)
  }
  if (!hljs.getLanguage('javascript')) {
    hljs.registerLanguage('javascript', javascript)
  }
  if (!hljs.getLanguage('typescript')) {
    hljs.registerLanguage('typescript', typescript)
  }
  if (!hljs.getLanguage('python')) {
    hljs.registerLanguage('python', python)
  }
}

registerPreviewHighlightLanguages()

function fitPreviewViewport(bounds: PreviewViewportSize, aspectRatio: number): PreviewViewportSize {
  if (!bounds.width || !bounds.height) {
    return { height: 0, width: 0 }
  }

  let width = bounds.width
  let height = width / aspectRatio

  if (height > bounds.height) {
    height = bounds.height
    width = height * aspectRatio
  }

  return {
    height: Math.max(0, Math.floor(height)),
    width: Math.max(0, Math.floor(width)),
  }
}

function resolvePreviewHighlightLanguage(language: PreviewRequestLanguage) {
  switch (language) {
    case 'html':
      return 'html'
    case 'react':
    case 'jsx':
      return 'javascript'
    case 'tsx':
      return 'typescript'
    case 'python':
    case 'py':
      return 'python'
    default:
      return 'javascript'
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function highlightPreviewCode(code: string, language: PreviewRequestLanguage) {
  const source = code || ' '
  try {
    return hljs.highlight(source, {
      ignoreIllegals: true,
      language: resolvePreviewHighlightLanguage(language),
    }).value
  } catch {
    return escapeHtml(source)
  }
}

function PreviewCodeEditor({
  code,
  language,
  onChange,
  onRun,
}: {
  code: string
  language: PreviewRequestLanguage
  onChange: (value: string) => void
  onRun?: () => void
}) {
  const { text } = useI18n()
  const gutterRef = useRef<HTMLDivElement | null>(null)
  const highlightScrollRef = useRef<HTMLDivElement | null>(null)

  const highlightedHtml = useMemo(() => highlightPreviewCode(code, language), [code, language])
  const lineNumbers = useMemo(() => {
    const totalLines = Math.max(1, code.split('\n').length)
    return Array.from({ length: totalLines }, (_, index) => index + 1).join('\n')
  }, [code])

  function syncScroll(target: HTMLTextAreaElement) {
    if (gutterRef.current) {
      gutterRef.current.scrollTop = target.scrollTop
    }
    if (highlightScrollRef.current) {
      highlightScrollRef.current.scrollTop = target.scrollTop
      highlightScrollRef.current.scrollLeft = target.scrollLeft
    }
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      onRun?.()
      return
    }

    if (event.key !== 'Tab') {
      return
    }

    event.preventDefault()
    const target = event.currentTarget
    const start = target.selectionStart
    const end = target.selectionEnd
    const nextValue = `${code.slice(0, start)}  ${code.slice(end)}`
    onChange(nextValue)

    window.requestAnimationFrame(() => {
      target.selectionStart = start + 2
      target.selectionEnd = start + 2
      syncScroll(target)
    })
  }

  return (
    <div className="preview-code-editor">
      <div className="preview-code-gutter" ref={gutterRef}>
        <pre>{lineNumbers}</pre>
      </div>

      <div className="preview-code-editor-body">
        <div aria-hidden="true" className="preview-code-highlight-scroll" ref={highlightScrollRef}>
          <pre className="preview-code-highlight">
            <code
              dangerouslySetInnerHTML={{
                __html: highlightedHtml,
              }}
            />
          </pre>
        </div>

        <textarea
          aria-label={text('预览代码编辑器', 'Preview code editor')}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          className="preview-code-textarea"
          spellCheck={false}
          value={code}
          wrap="off"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onScroll={(event) => syncScroll(event.currentTarget)}
        />
      </div>
    </div>
  )
}

export function PreviewDock({
  activeRequest,
  error,
  isRunning,
  onClose,
  onRefresh,
  onRunCode,
  onResizeTerminal,
  onSendTerminalInput,
  onTerminateTerminal,
  response,
  variant = 'overlay',
}: PreviewDockProps) {
  const { text } = useI18n()
  const [aspectRatio, setAspectRatio] = useState<PreviewAspectRatio>('16:9')
  const [view, setView] = useState<PreviewDockView>('preview')
  const [draftCode, setDraftCode] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!activeRequest) {
      setDraftCode('')
      return
    }
    setDraftCode(activeRequest.code)
  }, [activeRequest?.code, activeRequest?.key, activeRequest?.language, activeRequest?.sessionId])

  useEffect(() => {
    if (!activeRequest) {
      return
    }
    setView('preview')
  }, [activeRequest?.key, activeRequest?.language, activeRequest?.sessionId])

  useEffect(() => {
    if (!activeRequest || !onRunCode || view !== 'code') {
      return
    }
    if (draftCode === activeRequest.code) {
      return
    }

    const timer = window.setTimeout(() => {
      onRunCode(draftCode)
    }, 800)

    return () => {
      window.clearTimeout(timer)
    }
  }, [activeRequest, draftCode, onRunCode, view])

  if (!activeRequest) {
    return null
  }

  const currentRequest = activeRequest

  const previewLabel = formatPreviewLanguageLabel(currentRequest.language)
  const terminalState = response?.terminal
  const hasTerminal = Boolean(terminalState)
  const hasRenderableArtifact = Boolean(response?.artifact?.url)
  const hasTextOutputStage = Boolean(!hasTerminal && !hasRenderableArtifact && (response?.stdout || response?.stderr || response?.error || error))
  const hasLogs = Boolean(response?.command || (!hasTextOutputStage && (response?.stdout || response?.stderr || response?.error || error)))
  const shouldExpandLogs = false
  const hasPendingChanges = draftCode !== currentRequest.code
  const hasError = response?.status === 'error' || Boolean(error)
  const isLiveTerminal = response?.mode === 'terminal' && response.status === 'running'
  const dockClassName = variant === 'split' ? 'preview-dock preview-dock-split' : 'preview-dock preview-dock-overlay'
  const syncStateLabel = isLiveTerminal
    ? text('运行中', 'Running')
    : isRunning
      ? text('同步中', 'Syncing')
      : hasPendingChanges
        ? text('待同步', 'Pending')
        : hasError
          ? text('失败', 'Failed')
          : text('已同步', 'Synced')
  const syncStateClassName = isRunning
    ? 'preview-dock-state-pill preview-dock-state-pill-running'
    : hasPendingChanges
      ? 'preview-dock-state-pill preview-dock-state-pill-pending'
      : hasError
        ? 'preview-dock-state-pill preview-dock-state-pill-error'
        : 'preview-dock-state-pill preview-dock-state-pill-ready'

  function handleRunDraftCode() {
    if (!onRunCode) {
      return
    }
    onRunCode(draftCode)
  }

  async function handleCopyCode() {
    await copyTextToClipboard(draftCode)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  function handleSwitchView(nextView: PreviewDockView) {
    setView(nextView)
    if (nextView === 'preview' && hasPendingChanges && onRunCode) {
      onRunCode(draftCode)
    }
  }

  function handleRefreshCurrent() {
    if (view === 'code' && onRunCode) {
      onRunCode(draftCode)
      return
    }
    onRefresh()
  }

  return (
    <aside className={dockClassName}>
      <div className="preview-dock-header">
        <div className="preview-dock-tabs" role="tablist" aria-label={text('预览工作台视图', 'Preview workspace tabs')}>
          <button
            aria-selected={view === 'code'}
            className={view === 'code' ? 'preview-dock-tab preview-dock-tab-active' : 'preview-dock-tab'}
            role="tab"
            type="button"
            onClick={() => handleSwitchView('code')}
          >
            <Code2 size={13} />
            <span>{text('代码', 'Code')}</span>
          </button>
          <button
            aria-selected={view === 'preview'}
            className={view === 'preview' ? 'preview-dock-tab preview-dock-tab-active' : 'preview-dock-tab'}
            role="tab"
            type="button"
            onClick={() => handleSwitchView('preview')}
          >
            <Eye size={13} />
            <span>{text('预览', 'Preview')}</span>
          </button>
        </div>

        <div className="preview-dock-header-center">
          <span className="preview-dock-language-chip">{previewLabel}</span>
          {view === 'preview' && hasRenderableArtifact ? (
            <div className="preview-dock-ratio-group" role="tablist" aria-label={text('预览画布比例', 'Preview aspect ratio')}>
              <span className="preview-dock-ratio-label">
                <Ratio size={12} />
              </span>
              {PREVIEW_ASPECT_RATIO_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  aria-selected={aspectRatio === option.value}
                  className={
                    aspectRatio === option.value
                      ? 'preview-dock-ratio-button preview-dock-ratio-button-active'
                      : 'preview-dock-ratio-button'
                  }
                  role="tab"
                  type="button"
                  onClick={() => setAspectRatio(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : view === 'preview' && hasTerminal ? (
            <span className="preview-dock-editor-hint">{text('终端输出会持续同步，支持直接写入 stdin', 'Terminal output stays in sync and supports stdin input')}</span>
          ) : view === 'preview' && hasTextOutputStage ? (
            <span className="preview-dock-editor-hint">{text('当前脚本未生成可视产物，展示本次运行输出', 'No visual artifact was produced, showing runtime output')}</span>
          ) : (
            <span className="preview-dock-editor-hint">{text('支持修改、复制并自动刷新预览', 'Edit, copy, and auto-refresh preview')}</span>
          )}
        </div>

        <div className="preview-dock-actions">
          <span className={syncStateClassName}>
            {isRunning ? <LoaderCircle className="animate-spin" size={12} /> : hasError ? <TriangleAlert size={12} /> : null}
            <span>{syncStateLabel}</span>
          </span>

          <button
            aria-label={copied ? text('代码已复制', 'Code copied') : text('复制代码', 'Copy code')}
            className="preview-dock-icon-button"
            type="button"
            onClick={() => void handleCopyCode()}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>

          <button
            aria-label={text('刷新预览', 'Refresh preview')}
            className="preview-dock-icon-button"
            disabled={isRunning}
            type="button"
            onClick={handleRefreshCurrent}
          >
            <RefreshCcw size={14} />
          </button>

          <button
            aria-label={text('关闭预览', 'Close preview')}
            className="preview-dock-icon-button preview-dock-icon-button-danger"
            type="button"
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="preview-dock-body">
        {view === 'code' ? (
          <section className="preview-code-stage">
            <PreviewCodeEditor code={draftCode} language={currentRequest.language} onChange={setDraftCode} onRun={handleRunDraftCode} />
          </section>
        ) : hasTerminal && terminalState ? (
          <section className="preview-dock-stage">
            <PreviewTerminalPanel
              isRunning={response?.status === 'running'}
              onResize={onResizeTerminal}
              terminal={terminalState}
              onSendInput={onSendTerminalInput}
              onTerminate={onTerminateTerminal}
            />
          </section>
        ) : hasRenderableArtifact ? (
          <section className="preview-dock-stage">
            <PreviewArtifactPanel aspectRatio={aspectRatio} isRunning={isRunning} response={response!} />
          </section>
        ) : hasTextOutputStage ? (
          <section className="preview-dock-stage">
            <PreviewOutputPanel error={error} response={response} />
          </section>
        ) : null}

        {hasLogs ? (
          <PreviewLogsPanel
            error={error}
            expanded={shouldExpandLogs}
            hideRuntimeOutput={hasTextOutputStage}
            response={response}
          />
        ) : null}

        {!isRunning && !hasRenderableArtifact && !hasLogs && view === 'preview' ? (
          <div className="code-preview-empty !mt-0">{text('当前运行没有生成可展示的预览或日志输出。', 'This run did not produce a preview or log output.')}</div>
        ) : null}
      </div>
    </aside>
  )
}

function PreviewOutputPanel({
  response,
  error,
}: {
  response?: PreviewRunResponse
  error?: string
}) {
  const { text } = useI18n()
  return (
    <div className="preview-output-stage">
      <div className="preview-output-header">
        <span className="preview-output-title">{text('运行输出', 'Runtime output')}</span>
        {response?.command ? <span className="preview-output-command">{response.command}</span> : null}
      </div>

      {response?.stdout ? (
        <div className="preview-output-block">
          <span className="preview-output-label">{text('标准输出', 'Stdout')}</span>
          <pre>{response.stdout}</pre>
        </div>
      ) : null}

      {response?.stderr ? (
        <div className="preview-output-block preview-output-block-error">
          <span className="preview-output-label">{text('标准错误', 'Stderr')}</span>
          <pre>{response.stderr}</pre>
        </div>
      ) : null}

      {response?.error || error ? (
        <div className="preview-output-block preview-output-block-error">
          <span className="preview-output-label">{text('错误信息', 'Error')}</span>
          <pre>{response?.error || error}</pre>
        </div>
      ) : null}
    </div>
  )
}

function PreviewTerminalPanel({
  terminal,
  isRunning,
  onResize,
  onSendInput,
  onTerminate,
}: {
  terminal: NonNullable<PreviewRunResponse['terminal']>
  isRunning: boolean
  onResize?: (cols: number, rows: number) => Promise<void> | void
  onSendInput?: (text: string, appendNewline?: boolean) => Promise<void> | void
  onTerminate?: () => Promise<void> | void
}) {
  const { text } = useI18n()
  const [input, setInput] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (!onSendInput || submitting) {
      return
    }

    setSubmitting(true)
    try {
      await onSendInput(input, true)
      setInput('')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleTerminate() {
    if (!onTerminate || submitting) {
      return
    }
    setSubmitting(true)
    try {
      await onTerminate()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="preview-terminal-stage">
      <div className="preview-terminal-meta">
        <span className="preview-terminal-pill">{terminal.cols}x{terminal.rows}</span>
        <span className={isRunning ? 'preview-terminal-pill preview-terminal-pill-running' : 'preview-terminal-pill'}>
          {isRunning ? text('运行中', 'Running') : terminal.exit_code === 0 ? text('已结束', 'Exited') : `${text('退出', 'Exit')} ${terminal.exit_code ?? '-'}`}
        </span>
      </div>

      <div className="preview-terminal-shell">
        <PreviewTerminalConsole
          cols={terminal.cols}
          rows={terminal.rows}
          rawOutput={terminal.transcript_tail}
          screenText={terminal.screen_text || text('终端已启动，等待输出...', 'Terminal started, waiting for output...')}
          onResize={onResize}
          onSendData={(data) => {
            void onSendInput?.(data, false)
          }}
        />
      </div>

      <div className="preview-terminal-inputbar">
        <input
          className="preview-terminal-input"
          disabled={!terminal.can_write_stdin || submitting}
          placeholder={terminal.can_write_stdin ? text('输入内容并回车发送到 stdin...', 'Type and press Enter to write to stdin...') : text('终端会话已结束', 'Terminal session ended')}
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void handleSubmit()
            }
          }}
        />

        <div className="preview-terminal-actions">
          {terminal.can_write_stdin ? (
            <button
              className="preview-code-toolbar-button"
              disabled={submitting}
              type="button"
              onClick={() => void handleTerminate()}
            >
              <Square size={12} />
              <span>{text('停止', 'Stop')}</span>
            </button>
          ) : null}
          <button
            className="preview-code-toolbar-button preview-code-toolbar-button-primary"
            disabled={!terminal.can_write_stdin || submitting}
            type="button"
            onClick={() => void handleSubmit()}
          >
            {submitting ? <LoaderCircle className="animate-spin" size={12} /> : <Send size={12} />}
            <span>{text('发送回车', 'Send newline')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function PreviewArtifactPanel({
  response,
  aspectRatio,
  isRunning,
}: {
  response: PreviewRunResponse
  aspectRatio: PreviewAspectRatio
  isRunning: boolean
}) {
  const { text } = useI18n()
  const fitBoxRef = useRef<HTMLDivElement | null>(null)
  const [viewportSize, setViewportSize] = useState<PreviewViewportSize>()
  const aspectRatioValue = useMemo(() => PREVIEW_ASPECT_RATIO_VALUES[aspectRatio], [aspectRatio])

  useEffect(() => {
    const fitBox = fitBoxRef.current
    if (!fitBox) {
      return
    }

    let frameId = 0

    const syncViewportSize = () => {
      const rect = fitBox.getBoundingClientRect()
      const nextSize = fitPreviewViewport(
        {
          height: Math.max(0, rect.height),
          width: Math.max(0, rect.width),
        },
        aspectRatioValue,
      )

      setViewportSize((currentSize) => {
        if (
          currentSize &&
          currentSize.width === nextSize.width &&
          currentSize.height === nextSize.height
        ) {
          return currentSize
        }

        return nextSize
      })
    }

    const requestSync = () => {
      if (frameId) {
        cancelAnimationFrame(frameId)
      }
      frameId = requestAnimationFrame(syncViewportSize)
    }

    requestSync()

    const observer = new ResizeObserver(() => {
      requestSync()
    })
    observer.observe(fitBox)

    return () => {
      observer.disconnect()
      if (frameId) {
        cancelAnimationFrame(frameId)
      }
    }
  }, [aspectRatioValue])

  const canvasStyle =
    viewportSize && viewportSize.width > 0 && viewportSize.height > 0
      ? {
          height: `${viewportSize.height}px`,
          width: `${viewportSize.width}px`,
        }
      : undefined

  if (!response.artifact?.url) {
    return null
  }

  const renderableContent =
    response.artifact.kind === 'image' ? (
      <img alt={response.artifact.file_name} className="preview-dock-image" src={response.artifact.url} />
    ) : response.artifact.kind === 'text' ? null : (
      <iframe
        className="preview-dock-iframe"
        sandbox="allow-scripts allow-same-origin"
        scrolling="no"
        src={response.artifact.url}
        title={`${response.normalized_language}-preview-${response.run_id}`}
      />
    )

  if (response.artifact.kind === 'text') {
    return (
      <div className="preview-dock-log-block">
        <pre>{response.artifact.text_content || ''}</pre>
      </div>
    )
  }

  return (
    <div className="preview-dock-canvas-shell">
      <div ref={fitBoxRef} className="preview-dock-canvas-fitbox">
        <div
          className={`preview-dock-canvas preview-dock-canvas-${aspectRatio.replace(':', '-')}`}
          style={canvasStyle}
        >
          {renderableContent}
        </div>
      </div>

      {isRunning ? (
        <div className="preview-dock-canvas-overlay">
          <LoaderCircle className="animate-spin" size={14} />
          <span>{text('正在重新渲染预览', 'Re-rendering preview')}</span>
        </div>
      ) : null}
    </div>
  )
}

function PreviewLogsPanel({
  response,
  error,
  expanded = false,
  hideRuntimeOutput = false,
}: {
  response?: PreviewRunResponse
  error?: string
  expanded?: boolean
  hideRuntimeOutput?: boolean
}) {
  const { text } = useI18n()
  return (
    <div className={expanded ? 'preview-dock-logs preview-dock-logs-expanded' : 'preview-dock-logs'}>
      {response?.command ? (
        <div className="preview-dock-log-group">
          <span className="preview-dock-log-label">{text('执行命令', 'Command')}</span>
          <pre>{response.command}</pre>
        </div>
      ) : null}

      {!hideRuntimeOutput && response?.stdout ? (
        <div className="preview-dock-log-group">
          <span className="preview-dock-log-label">{text('标准输出', 'Stdout')}</span>
          <pre>{response.stdout}</pre>
        </div>
      ) : null}

      {!hideRuntimeOutput && response?.stderr ? (
        <div className="preview-dock-log-group preview-dock-log-group-error">
          <span className="preview-dock-log-label">{text('标准错误', 'Stderr')}</span>
          <pre>{response.stderr}</pre>
        </div>
      ) : null}

      {!hideRuntimeOutput && (response?.error || error) ? (
        <div className="preview-dock-log-group preview-dock-log-group-error">
          <span className="preview-dock-log-label">{text('错误信息', 'Error')}</span>
          <pre>{response?.error || error}</pre>
        </div>
      ) : null}
    </div>
  )
}
