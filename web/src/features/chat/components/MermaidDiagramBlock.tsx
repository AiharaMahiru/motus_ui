import { memo, useEffect, useMemo, useRef, useState } from 'react'

import mermaid from 'mermaid'

import { useI18n } from '../../../shared/i18n/I18nContext'
import { useTheme, type AppTheme } from '../../../shared/theme/ThemeContext'
import { EmbeddedVisualizationCard } from './EmbeddedVisualizationCard'

type MermaidDiagramBlockProps = {
  source: string
}

let mermaidConfiguredTheme: AppTheme | undefined
let mermaidRenderSequence = 0
const mermaidSvgCache = new Map<string, string>()

function resolveMermaidThemeVariables(theme: AppTheme) {
  if (theme === 'black') {
    return {
      clusterBkg: '#020817',
      clusterBorder: '#243042',
      lineColor: '#64748b',
      primaryBorderColor: '#334155',
      primaryColor: '#0b1220',
      primaryTextColor: '#eff6ff',
      secondaryColor: '#020817',
      tertiaryColor: '#020817',
    }
  }

  if (theme === 'dark') {
    return {
      clusterBkg: '#111827',
      clusterBorder: '#334155',
      lineColor: '#64748b',
      primaryBorderColor: '#334155',
      primaryColor: '#172033',
      primaryTextColor: '#e5eefc',
      secondaryColor: '#111827',
      tertiaryColor: '#111827',
    }
  }

  return {
    clusterBkg: '#f8fafc',
    clusterBorder: '#cbd5e1',
    lineColor: '#64748b',
    primaryBorderColor: '#bfdbfe',
    primaryColor: '#eff6ff',
    primaryTextColor: '#0f172a',
    secondaryColor: '#f8fafc',
    tertiaryColor: '#ffffff',
  }
}

function ensureMermaidConfigured(theme: AppTheme) {
  if (mermaidConfiguredTheme === theme) {
    return
  }

  // 参照 Mermaid 官方初始化方式，关闭自动扫描，统一由 React 组件触发渲染。
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    fontFamily: '"Noto Sans SC", "IBM Plex Sans", "PingFang SC", sans-serif',
    flowchart: {
      useMaxWidth: true,
      htmlLabels: false,
    },
    themeVariables: resolveMermaidThemeVariables(theme),
  })
  mermaidConfiguredTheme = theme
}

function MermaidDiagramBlockInner({ source }: MermaidDiagramBlockProps) {
  const { text } = useI18n()
  const { theme } = useTheme()
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const renderId = useMemo(() => {
    mermaidRenderSequence += 1
    return `chat-mermaid-${mermaidRenderSequence}`
  }, [])

  useEffect(() => {
    if (!hostRef.current) {
      return
    }
    const hostElement = hostRef.current

    let cancelled = false
    setError(null)
    hostElement.innerHTML = ''

    const cacheKey = `${theme}:${source}`
    const cachedSvg = mermaidSvgCache.get(cacheKey)
    if (cachedSvg) {
      hostElement.innerHTML = cachedSvg
      return () => {
        cancelled = true
        hostElement.innerHTML = ''
      }
    }

    async function renderDiagram() {
      try {
        ensureMermaidConfigured(theme)
        const { svg, bindFunctions } = await mermaid.render(renderId, source)
        if (cancelled) {
          return
        }
        mermaidSvgCache.set(cacheKey, svg)
        hostElement.innerHTML = svg
        bindFunctions?.(hostElement)
      } catch (renderError) {
        if (cancelled) {
          return
        }
        setError(renderError instanceof Error ? renderError.message : text('Mermaid 渲染失败', 'Mermaid render failed'))
      }
    }

    void renderDiagram()

    return () => {
      cancelled = true
      hostElement.innerHTML = ''
    }
  }, [renderId, source, theme])

  return (
    <EmbeddedVisualizationCard
      compactHeader
      detailText={text(
        '使用 Mermaid 官方语法。建议优先输出 flowchart、sequenceDiagram、stateDiagram、pie、xychart-beta 等标准块。',
        'Use official Mermaid syntax. Prefer standard blocks such as flowchart, sequenceDiagram, stateDiagram, pie, and xychart-beta.',
      )}
      error={error}
      kindLabel="Mermaid"
      rawCode={source}
    >
      <div className="embedded-visualization-mermaid" ref={hostRef} />
    </EmbeddedVisualizationCard>
  )
}

export const MermaidDiagramBlock = memo(
  MermaidDiagramBlockInner,
  (previous, next) => previous.source === next.source,
)
