import type { EChartsOption } from 'echarts'

import type { AppTheme } from '../../../shared/theme/ThemeContext'
import type { VizCartesianSpec, VizSpec } from './embeddedVisualizationTypes'

const DEFAULT_PALETTE = ['#2563eb', '#0f766e', '#7c3aed', '#ea580c', '#dc2626', '#0891b2']
const HEATMAP_PALETTE = ['#eff6ff', '#bfdbfe', '#60a5fa', '#2563eb', '#1d4ed8']

function resolveVizAppearance(theme: AppTheme) {
  if (theme === 'black') {
    return {
      axis: '#94a3b8',
      border: '#243042',
      label: '#dbeafe',
      palette: ['#38bdf8', '#34d399', '#a78bfa', '#f59e0b', '#fb7185', '#22d3ee'],
      panel: '#020817',
      split: '#172033',
      strong: '#eff6ff',
      subtle: '#64748b',
    }
  }

  if (theme === 'dark') {
    return {
      axis: '#94a3b8',
      border: '#334155',
      label: '#d0def4',
      palette: ['#60a5fa', '#34d399', '#a78bfa', '#fb923c', '#f87171', '#22d3ee'],
      panel: '#111827',
      split: '#243042',
      strong: '#e5eefc',
      subtle: '#94a3b8',
    }
  }

  return {
    axis: '#64748b',
    border: '#cbd5e1',
    label: '#334155',
    palette: DEFAULT_PALETTE,
    panel: '#ffffff',
    split: '#e2e8f0',
    strong: '#0f172a',
    subtle: '#64748b',
  }
}

function buildCommonTitle(spec: VizSpec, appearance: ReturnType<typeof resolveVizAppearance>) {
  if (!spec.title) {
    return undefined
  }

  return {
    text: spec.title,
    subtext: spec.subtitle,
    left: 'center',
    top: 12,
    textStyle: {
      color: appearance.strong,
      fontSize: 15,
      fontWeight: 800,
    },
    subtextStyle: {
      color: appearance.subtle,
      fontSize: 11,
      fontWeight: 600,
    },
  }
}

function buildLegend(spec: VizSpec, appearance: ReturnType<typeof resolveVizAppearance>) {
  if ('legend' in spec && spec.legend === false) {
    return undefined
  }

  return {
    top: spec.title ? 40 : 2,
    right: 12,
    textStyle: {
      color: appearance.subtle,
      fontSize: 11,
      fontWeight: 600,
    },
  }
}

function buildGrid(spec: VizSpec) {
  return {
    left: 16,
    right: 16,
    top: spec.title ? 72 : 24,
    bottom: 32,
  }
}

function axisLabelFormatter(unit?: string) {
  return (value: number) => (unit ? `${value}${unit}` : `${value}`)
}

export function formatVizKind(spec: VizSpec) {
  switch (spec.type) {
    case 'line':
      return '折线图'
    case 'bar':
      return '柱状图'
    case 'area':
      return '面积图'
    case 'pie':
      return '饼图'
    case 'doughnut':
      return '环形图'
    case 'scatter':
      return '散点图'
    case 'radar':
      return '雷达图'
    case 'heatmap':
      return '热力图'
    case 'funnel':
      return '漏斗图'
    case 'gauge':
      return '仪表盘'
    case 'sankey':
      return '桑基图'
    case 'candlestick':
      return 'K 线图'
    default:
      return '图表'
  }
}

export function resolveVizHeight(spec: VizSpec) {
  if (spec.type === 'sankey') {
    return spec.height ?? 360
  }
  if (spec.type === 'radar' || spec.type === 'gauge') {
    return spec.height ?? 340
  }
  return spec.height ?? 300
}

export function buildVizOption(spec: VizSpec, theme: AppTheme = 'light'): EChartsOption {
  const appearance = resolveVizAppearance(theme)
  const color = spec.palette ?? appearance.palette
  const title = buildCommonTitle(spec, appearance)

  if (spec.type === 'pie' || spec.type === 'doughnut') {
    const pieSeries = spec.series[0]

    return {
      color,
      animationDuration: 280,
      title,
      tooltip: {
        trigger: 'item',
      },
      legend:
        spec.legend === false
          ? undefined
          : {
              bottom: 8,
              left: 'center',
              textStyle: {
                color: appearance.subtle,
                fontSize: 11,
                fontWeight: 600,
              },
            },
      series: [
        {
          name: pieSeries.name ?? spec.title ?? '占比',
          type: 'pie',
          radius: spec.type === 'doughnut' ? ['46%', '72%'] : '68%',
          center: ['50%', title ? '46%' : '50%'],
          label: {
            color: appearance.subtle,
            fontSize: 11,
            fontWeight: 600,
            formatter: '{b}: {d}%',
          },
          labelLine: {
            lineStyle: {
              color: appearance.border,
            },
          },
          itemStyle: {
            borderColor: appearance.panel,
            borderWidth: 2,
          },
          emphasis: {
            scale: true,
            scaleSize: 6,
          },
          data: pieSeries.data,
        },
      ],
    }
  }

  if (spec.type === 'scatter') {
    return {
      color,
      animationDuration: 280,
      title,
      legend: buildLegend(spec, appearance),
      grid: buildGrid(spec),
      tooltip: {
        trigger: 'item',
      },
      xAxis: {
        type: 'value',
        name: spec.xName,
        axisLine: {
          lineStyle: {
            color: appearance.border,
          },
        },
        axisLabel: {
          color: appearance.axis,
          fontSize: 11,
          fontWeight: 600,
          formatter: axisLabelFormatter(spec.unit),
        },
        splitLine: {
          lineStyle: {
            color: appearance.split,
          },
        },
      },
      yAxis: {
        type: 'value',
        name: spec.yName,
        axisLine: {
          lineStyle: {
            color: appearance.border,
          },
        },
        axisLabel: {
          color: appearance.axis,
          fontSize: 11,
          fontWeight: 600,
          formatter: axisLabelFormatter(spec.unit),
        },
        splitLine: {
          lineStyle: {
            color: appearance.split,
          },
        },
      },
      series: spec.series.map((series) => ({
        type: 'scatter',
        name: series.name,
        itemStyle: series.color ? { color: series.color } : undefined,
        data: series.points.map((point) => ({
          name: point.label ?? series.name,
          value: [point.x, point.y],
          symbolSize: point.size ?? 12,
        })),
        emphasis: {
          focus: 'series',
        },
      })),
    }
  }

  if (spec.type === 'radar') {
    return {
      color,
      animationDuration: 280,
      title,
      legend: buildLegend(spec, appearance),
      tooltip: {
        trigger: 'item',
      },
      radar: {
        radius: '62%',
        center: ['50%', title ? '58%' : '54%'],
        indicator: spec.indicators,
        splitNumber: 4,
        axisName: {
          color: appearance.label,
          fontSize: 11,
          fontWeight: 700,
        },
        splitLine: {
          lineStyle: {
            color: appearance.split,
          },
        },
        splitArea: {
          areaStyle: {
            color: [appearance.panel, appearance.panel],
          },
        },
      },
      series: [
        {
          type: 'radar',
          areaStyle: {
            opacity: 0.12,
          },
          lineStyle: {
            width: 2,
          },
          data: spec.series.map((series) => ({
            name: series.name,
            value: series.data,
            itemStyle: series.color ? { color: series.color } : undefined,
          })),
        },
      ],
    }
  }

  if (spec.type === 'heatmap') {
    const values = spec.values.map((entry) => entry[2])
    const min = Math.min(...values)
    const max = Math.max(...values)

    return {
      animationDuration: 280,
      title,
      tooltip: {
        position: 'top',
      },
      grid: {
        left: 18,
        right: 18,
        top: spec.title ? 72 : 20,
        bottom: 48,
      },
      xAxis: {
        type: 'category',
        data: spec.x,
        name: spec.xName,
        splitArea: { show: true },
        axisLabel: {
          color: appearance.axis,
          fontSize: 11,
          fontWeight: 600,
        },
        axisLine: {
          lineStyle: {
            color: appearance.border,
          },
        },
      },
      yAxis: {
        type: 'category',
        data: spec.y,
        name: spec.yName,
        splitArea: { show: true },
        axisLabel: {
          color: appearance.axis,
          fontSize: 11,
          fontWeight: 600,
        },
        axisLine: {
          lineStyle: {
            color: appearance.border,
          },
        },
      },
      visualMap: {
        min,
        max,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 6,
        textStyle: {
          color: appearance.subtle,
          fontSize: 11,
          fontWeight: 600,
        },
        inRange: {
            color: spec.palette ?? (theme === 'light' ? HEATMAP_PALETTE : ['#172033', '#1d4ed8', '#38bdf8', '#34d399', '#f8fafc']),
          },
        },
      series: [
        {
          type: 'heatmap',
          data: spec.values,
          label: { show: false },
          emphasis: {
            itemStyle: {
              shadowBlur: 8,
              shadowColor: 'rgba(15,23,42,0.16)',
            },
          },
        },
      ],
    }
  }

  if (spec.type === 'funnel') {
    const funnelSeries = spec.series[0]
    const maxValue = Math.max(...funnelSeries.data.map((entry) => entry.value))

    return {
      color,
      animationDuration: 280,
      title,
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c}',
      },
      legend: buildLegend(spec, appearance),
      series: [
        {
          type: 'funnel',
          name: funnelSeries.name ?? spec.title ?? '转化',
          left: '10%',
          top: spec.title ? 72 : 16,
          right: '10%',
          bottom: 16,
          min: 0,
          max: maxValue,
          minSize: '20%',
          maxSize: '90%',
          sort: 'descending',
          gap: 2,
          label: {
            show: true,
            position: 'inside',
            color: '#ffffff',
            fontSize: 11,
            fontWeight: 700,
          },
          itemStyle: {
            borderColor: appearance.panel,
            borderWidth: 2,
          },
          data: funnelSeries.data,
        },
      ],
    }
  }

  if (spec.type === 'gauge') {
    const gaugeSeries = spec.series[0]
    const min = spec.min ?? 0
    const max = spec.max ?? 100

    return {
      color,
      animationDuration: 280,
      title,
      series: [
        {
          type: 'gauge',
          min,
          max,
          startAngle: 210,
          endAngle: -30,
          center: ['50%', title ? '58%' : '54%'],
          progress: {
            show: true,
            roundCap: true,
            width: 18,
          },
          axisLine: {
            lineStyle: {
              width: 18,
            },
          },
          splitLine: {
            distance: -22,
            length: 10,
            lineStyle: {
              width: 2,
              color: appearance.split,
            },
          },
          axisTick: {
            distance: -24,
            length: 4,
            lineStyle: {
              color: appearance.border,
            },
          },
          axisLabel: {
            distance: -42,
            color: appearance.axis,
            fontSize: 10,
            fontWeight: 700,
          },
          pointer: {
            width: 5,
            length: '58%',
          },
          detail: {
            valueAnimation: true,
            formatter: gaugeSeries.detail ?? '{value}',
            color: appearance.strong,
            fontSize: 18,
            fontWeight: 800,
            offsetCenter: [0, '70%'],
          },
          title: {
            color: appearance.axis,
            fontSize: 11,
            fontWeight: 700,
            offsetCenter: [0, '100%'],
          },
          data: [
            {
              value: gaugeSeries.value,
              name: gaugeSeries.name ?? spec.title ?? '当前值',
            },
          ],
        },
      ],
    }
  }

  if (spec.type === 'sankey') {
    const sankeySeries = spec.series[0]

    return {
      color,
      animationDuration: 280,
      title,
      tooltip: {
        trigger: 'item',
      },
      series: [
        {
          type: 'sankey',
          name: sankeySeries.name ?? spec.title ?? '流向',
          left: '4%',
          right: '4%',
          top: spec.title ? 72 : 18,
          bottom: 16,
          nodeWidth: 18,
          nodeGap: 18,
          emphasis: {
            focus: 'adjacency',
          },
          lineStyle: {
            color: 'gradient',
            curveness: 0.5,
          },
          label: {
            color: appearance.label,
            fontSize: 11,
            fontWeight: 700,
          },
          data: sankeySeries.nodes,
          links: sankeySeries.links,
        },
      ],
    }
  }

  if (spec.type === 'candlestick') {
    const candlestickSeries = spec.series[0]

    return {
      color,
      animationDuration: 280,
      title,
      grid: buildGrid(spec),
      tooltip: {
        trigger: 'axis',
      },
      xAxis: {
        type: 'category',
        data: spec.x,
        name: spec.xName,
        boundaryGap: true,
        axisLine: {
          lineStyle: {
            color: appearance.border,
          },
        },
        axisLabel: {
          color: appearance.axis,
          fontSize: 11,
          fontWeight: 600,
        },
        axisTick: {
          show: false,
        },
      },
      yAxis: {
        type: 'value',
        name: spec.yName,
        scale: true,
        axisLabel: {
          color: '#64748b',
          fontSize: 11,
          fontWeight: 600,
          formatter: axisLabelFormatter(spec.unit),
        },
        splitLine: {
          lineStyle: {
            color: appearance.split,
          },
        },
      },
      series: [
        {
          type: 'candlestick',
          name: candlestickSeries.name ?? spec.title ?? 'K 线',
          data: candlestickSeries.data,
          itemStyle: {
            color: '#ef4444',
            color0: '#10b981',
            borderColor: '#ef4444',
            borderColor0: '#10b981',
          },
        },
      ],
    }
  }

  const seriesType = spec.type === 'area' ? 'line' : spec.type
  const cartesianSpec = spec as VizCartesianSpec

  return {
    color,
    animationDuration: 280,
    title,
    grid: buildGrid(spec),
    tooltip: {
      trigger: 'axis',
    },
    legend: buildLegend(spec, appearance),
    xAxis: {
      type: 'category',
      data: cartesianSpec.x,
      name: cartesianSpec.xName,
      boundaryGap: cartesianSpec.type === 'bar',
      axisLine: {
        lineStyle: {
          color: appearance.border,
        },
      },
      axisLabel: {
        color: appearance.axis,
        fontSize: 11,
        fontWeight: 600,
      },
      axisTick: {
        show: false,
      },
    },
    yAxis: {
      type: 'value',
      name: cartesianSpec.yName,
      axisLabel: {
        color: appearance.axis,
        fontSize: 11,
        fontWeight: 600,
        formatter: axisLabelFormatter(cartesianSpec.unit),
      },
      splitLine: {
        lineStyle: {
          color: appearance.split,
        },
      },
    },
    series: cartesianSpec.series.map((series) => ({
      name: series.name,
      type: seriesType,
      data: series.data,
      smooth: cartesianSpec.type === 'bar' ? false : cartesianSpec.smooth ?? true,
      stack: cartesianSpec.stacked ? 'total' : undefined,
      showSymbol: cartesianSpec.type === 'bar' ? false : true,
      symbolSize: 7,
      barMaxWidth: cartesianSpec.type === 'bar' ? 28 : undefined,
      lineStyle: cartesianSpec.type === 'bar' ? undefined : { width: 3 },
      areaStyle: cartesianSpec.type === 'area' ? { opacity: 0.16 } : undefined,
      itemStyle: series.color ? { color: series.color } : undefined,
      emphasis: {
        focus: 'series',
      },
    })),
  }
}
