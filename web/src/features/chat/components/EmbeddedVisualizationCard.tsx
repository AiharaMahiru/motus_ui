import { useState, type ReactNode } from 'react'

import { Check, ChevronDown, Copy, Sparkles, TriangleAlert } from 'lucide-react'

import { copyTextToClipboard } from '../../../shared/lib/clipboard'
import { useI18n } from '../../../shared/i18n/I18nContext'


type EmbeddedVisualizationCardProps = {
  children?: ReactNode
  compactHeader?: boolean
  detailText?: string
  error?: string | null
  kindLabel: string
  rawCode: string
  subtitle?: string
  title?: string
}

export function EmbeddedVisualizationCard({
  children,
  compactHeader = false,
  detailText,
  error,
  kindLabel,
  rawCode,
  subtitle,
  title,
}: EmbeddedVisualizationCardProps) {
  const { text } = useI18n()
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await copyTextToClipboard(rawCode)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  const hasHeadingText = Boolean(title || subtitle)

  return (
    <section className="embedded-visualization">
      <header className={compactHeader ? 'embedded-visualization-header embedded-visualization-header-compact' : 'embedded-visualization-header'}>
        <div className="embedded-visualization-meta">
          <span className="embedded-visualization-chip">{kindLabel}</span>
          {hasHeadingText || error ? (
            <div className="min-w-0">
              <div className="embedded-visualization-title-row">
                {title ? <strong className="embedded-visualization-title">{title}</strong> : null}
                {error ? <TriangleAlert className="text-amber-600" size={14} /> : title ? <Sparkles className="text-sky-600" size={14} /> : null}
              </div>
              {subtitle ? <p className="embedded-visualization-subtitle">{subtitle}</p> : null}
            </div>
          ) : null}
        </div>

        <button
          aria-label={text('复制可视化源码', 'Copy visualization source')}
          className="embedded-visualization-copy"
          type="button"
          onClick={handleCopy}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          <span>{copied ? text('已复制', 'Copied') : text('复制源码', 'Copy source')}</span>
        </button>
      </header>

      <div className={error ? 'embedded-visualization-surface embedded-visualization-surface-error' : 'embedded-visualization-surface'}>
        {error ? (
          <div className="embedded-visualization-error">
            <strong>{text('渲染失败', 'Render failed')}</strong>
            <p>{error}</p>
          </div>
        ) : (
          children
        )}
      </div>

      <details className="embedded-visualization-source">
        <summary>
          <span>{text('查看源码', 'View source')}</span>
          <ChevronDown size={14} />
        </summary>
        {detailText ? <div className="embedded-visualization-source-hint">{detailText}</div> : null}
        <pre>{rawCode}</pre>
      </details>
    </section>
  )
}
