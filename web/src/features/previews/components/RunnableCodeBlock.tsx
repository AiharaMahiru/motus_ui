import { useMemo, useState } from 'react'

import { Check, Copy, LoaderCircle, Play, RefreshCcw } from 'lucide-react'

import { useI18n } from '../../../shared/i18n/I18nContext'
import { copyTextToClipboard } from '../../../shared/lib/clipboard'
import { buildPreviewRequestKey, formatPreviewLanguageLabel, resolvePreviewLanguage, type PreviewRequestLanguage } from '../previewCode'


type RunnableCodeBlockProps = {
  children: string
  className?: string
  activePreviewKey?: string
  isPreviewRunning?: boolean
  onRequestPreview?: (payload: {
    code: string
    key: string
    language: PreviewRequestLanguage
  }) => void
  sessionId?: string
}


export function RunnableCodeBlock({
  children,
  className,
  activePreviewKey,
  isPreviewRunning = false,
  onRequestPreview,
  sessionId,
}: RunnableCodeBlockProps) {
  const { text } = useI18n()
  const [copied, setCopied] = useState(false)

  const previewLanguage = useMemo(
    () => (sessionId ? resolvePreviewLanguage(className, children) : null),
    [className, children, sessionId],
  )
  const previewLabel = previewLanguage ? formatPreviewLanguageLabel(previewLanguage) : null
  const previewKey = previewLanguage ? buildPreviewRequestKey(previewLanguage, children) : undefined
  const isPreviewSelected = Boolean(previewKey && activePreviewKey === previewKey)
  const isBlockPreviewRunning = isPreviewSelected && isPreviewRunning

  async function handleCopy() {
    await copyTextToClipboard(children)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  function handleRunPreview() {
    if (!previewLanguage || !onRequestPreview) {
      return
    }
    onRequestPreview({
      code: children,
      key: previewKey!,
      language: previewLanguage,
    })
  }

  return (
    <div className="markdown-codeblock">
      <div className="markdown-codeblock-toolbar">
        {previewLanguage ? (
          <div className="markdown-codeblock-preview-meta">
            <span className="markdown-codeblock-preview-chip">{previewLabel} {text('预览', 'preview')}</span>
          </div>
        ) : (
          <div />
        )}

        <div className="markdown-codeblock-toolbar-actions">
          {previewLanguage ? (
            <button
              aria-label={isPreviewSelected ? text('重新运行预览', 'Re-run preview') : text('运行预览', 'Run preview')}
              className="markdown-codeblock-run"
              disabled={isBlockPreviewRunning}
              type="button"
              onClick={handleRunPreview}
            >
              {isBlockPreviewRunning ? (
                <LoaderCircle className="animate-spin" size={12} />
              ) : isPreviewSelected ? (
                <RefreshCcw size={12} />
              ) : (
                <Play size={12} />
              )}
              <span>
                {isBlockPreviewRunning
                  ? text('运行中', 'Running')
                  : isPreviewSelected
                    ? text('刷新预览', 'Refresh preview')
                    : text('运行预览', 'Run preview')}
              </span>
            </button>
          ) : null}
          <button
            aria-label={text('复制代码块', 'Copy code block')}
            className="markdown-codeblock-copy"
            type="button"
            onClick={handleCopy}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            <span>{copied ? text('已复制', 'Copied') : text('复制代码', 'Copy code')}</span>
          </button>
        </div>
      </div>

      <pre>
        <code className={className}>
          {children}
        </code>
      </pre>
    </div>
  )
}
