import { memo, useLayoutEffect, useMemo, useRef } from 'react'

import * as echarts from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { BarChart, CandlestickChart, FunnelChart, GaugeChart, HeatmapChart, LineChart, PieChart, RadarChart, SankeyChart, ScatterChart } from 'echarts/charts'
import { AriaComponent, GridComponent, LegendComponent, RadarComponent, TitleComponent, TooltipComponent, VisualMapComponent } from 'echarts/components'

import { useI18n } from '../../../shared/i18n/I18nContext'
import { useTheme } from '../../../shared/theme/ThemeContext'
import { EmbeddedVisualizationCard } from './EmbeddedVisualizationCard'
import { buildVizOption, parseVizSpec, resolveVizHeight } from './embeddedVisualization'

type StructuredChartBlockProps = {
  source: string
}

echarts.use([
  SVGRenderer,
  LineChart,
  BarChart,
  PieChart,
  ScatterChart,
  RadarChart,
  HeatmapChart,
  FunnelChart,
  GaugeChart,
  SankeyChart,
  CandlestickChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  RadarComponent,
  VisualMapComponent,
  AriaComponent,
])

function StructuredChartBlockInner({ source }: StructuredChartBlockProps) {
  const { text } = useI18n()
  const { theme } = useTheme()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const lastResizeWidthRef = useRef<number>(0)
  const parsed = useMemo(() => parseVizSpec(source), [source])

  useLayoutEffect(() => {
    if (parsed.kind !== 'success') {
      return
    }

    const container = containerRef.current
    if (!container) {
      return
    }

    const height = resolveVizHeight(parsed.spec)

    // 会话内嵌图表以 SVG 为主，缩放更稳，也更适合聊天面板这种中小画布。
    const chart = echarts.init(container, undefined, {
      renderer: 'svg',
      width: container.clientWidth || 640,
      height,
    })
    lastResizeWidthRef.current = Math.round(container.clientWidth || 640)
    chart.setOption(buildVizOption(parsed.spec, theme), true)

    let resizeObserver: ResizeObserver | null = null

    if (typeof window !== 'undefined' && 'ResizeObserver' in window) {
      resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0]
        if (!entry) {
          return
        }
        const nextWidth = Math.round(entry.contentRect.width || container.clientWidth || 640)
        if (nextWidth <= 0 || nextWidth === lastResizeWidthRef.current) {
          return
        }
        lastResizeWidthRef.current = nextWidth
        chart.resize({
          width: nextWidth,
          height,
        })
      })
      resizeObserver.observe(container)
    }

    return () => {
      resizeObserver?.disconnect()
      chart.dispose()
    }
  }, [parsed, theme])

  if (parsed.kind !== 'success') {
    return (
      <EmbeddedVisualizationCard
        detailText={text(
          'viz 代码块必须是合法 JSON，且字段需符合当前支持的 line / bar / area / pie / doughnut / scatter / radar / heatmap / funnel / gauge / sankey / candlestick 结构。',
          'The viz block must be valid JSON and match one of the supported line / bar / area / pie / doughnut / scatter / radar / heatmap / funnel / gauge / sankey / candlestick schemas.',
        )}
        error={parsed.message}
        kindLabel="Viz"
        rawCode={source}
        subtitle={text('当前仅支持结构化 JSON 图表配置。', 'Only structured JSON chart configs are supported right now.')}
        title={text('图表配置', 'Chart config')}
      />
    )
  }

  const chartHeight = resolveVizHeight(parsed.spec)

  return (
    <EmbeddedVisualizationCard
      compactHeader
      detailText={text(
        '支持 line / bar / area / pie / doughnut / scatter / radar / heatmap / funnel / gauge / sankey / candlestick。推荐优先使用当前 schema，而不是直接塞任意 ECharts option。',
        'Supports line / bar / area / pie / doughnut / scatter / radar / heatmap / funnel / gauge / sankey / candlestick. Prefer the current schema over arbitrary ECharts options.',
      )}
      kindLabel="Viz"
      rawCode={source}
      title={parsed.spec.title}
    >
      <div className="embedded-visualization-chart" ref={containerRef} style={{ height: `${chartHeight}px` }} />
    </EmbeddedVisualizationCard>
  )
}

export const StructuredChartBlock = memo(
  StructuredChartBlockInner,
  (previous, next) => previous.source === next.source,
)
