import { z } from 'zod'

import type { EmbeddedVisualizationResult, VizSpec } from './embeddedVisualizationTypes'

const baseVizSchema = {
  title: z.string().trim().min(1).optional(),
  subtitle: z.string().trim().min(1).optional(),
  height: z.number().int().min(220).max(720).optional(),
  palette: z.array(z.string().trim().min(1)).min(1).optional(),
}

const cartesianSeriesSchema = z.object({
  name: z.string().trim().min(1, 'series.name 不能为空'),
  data: z.array(z.number()).min(1, 'series.data 不能为空'),
  color: z.string().trim().min(1).optional(),
})

const piePointSchema = z.object({
  name: z.string().trim().min(1, '数据项必须有 name'),
  value: z.number(),
})

const pieSeriesSchema = z.object({
  name: z.string().trim().min(1).optional(),
  data: z.array(piePointSchema).min(1, 'pie data 不能为空'),
})

const scatterPointSchema = z.object({
  x: z.number(),
  y: z.number(),
  label: z.string().trim().min(1).optional(),
  size: z.number().min(4).max(40).optional(),
})

const scatterSeriesSchema = z.object({
  name: z.string().trim().min(1, 'series.name 不能为空'),
  color: z.string().trim().min(1).optional(),
  points: z.array(scatterPointSchema).min(1, 'scatter points 不能为空'),
})

const radarIndicatorSchema = z.object({
  name: z.string().trim().min(1, 'indicator.name 不能为空'),
  max: z.number().positive('indicator.max 必须大于 0'),
})

const radarSeriesSchema = z.object({
  name: z.string().trim().min(1, 'series.name 不能为空'),
  color: z.string().trim().min(1).optional(),
  data: z.array(z.number()).min(1, 'series.data 不能为空'),
})

const heatmapValueSchema = z.tuple([z.number().int().min(0), z.number().int().min(0), z.number()])

const funnelSeriesSchema = z.object({
  name: z.string().trim().min(1).optional(),
  data: z.array(piePointSchema).min(1, 'funnel data 不能为空'),
})

const gaugeSeriesSchema = z.object({
  name: z.string().trim().min(1).optional(),
  value: z.number(),
  detail: z.string().trim().min(1).optional(),
})

const sankeyNodeSchema = z.object({
  name: z.string().trim().min(1, 'node.name 不能为空'),
})

const sankeyLinkSchema = z.object({
  source: z.string().trim().min(1, 'link.source 不能为空'),
  target: z.string().trim().min(1, 'link.target 不能为空'),
  value: z.number().positive('link.value 必须大于 0'),
})

const sankeySeriesSchema = z.object({
  name: z.string().trim().min(1).optional(),
  nodes: z.array(sankeyNodeSchema).min(2, 'sankey 至少需要两个节点'),
  links: z.array(sankeyLinkSchema).min(1, 'sankey 至少需要一条连接'),
})

const candlestickSeriesSchema = z.object({
  name: z.string().trim().min(1).optional(),
  data: z.array(z.tuple([z.number(), z.number(), z.number(), z.number()])).min(1, 'candlestick data 不能为空'),
})

const cartesianSpecSchema = z
  .object({
    ...baseVizSchema,
    type: z.enum(['line', 'bar', 'area']),
    x: z.array(z.union([z.string(), z.number()])).min(1, 'x 轴数据不能为空'),
    xName: z.string().trim().min(1).optional(),
    yName: z.string().trim().min(1).optional(),
    unit: z.string().trim().min(1).optional(),
    smooth: z.boolean().optional(),
    stacked: z.boolean().optional(),
    legend: z.boolean().optional(),
    series: z.array(cartesianSeriesSchema).min(1, '至少需要一组 series'),
  })
  .superRefine((value, context) => {
    value.series.forEach((series, index) => {
      if (series.data.length !== value.x.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `series[${index}] 的 data 长度必须与 x 一致`,
          path: ['series', index, 'data'],
        })
      }
    })
  })

const pieSpecSchema = z.object({
  ...baseVizSchema,
  type: z.enum(['pie', 'doughnut']),
  legend: z.boolean().optional(),
  series: z.tuple([pieSeriesSchema]),
})

const scatterSpecSchema = z.object({
  ...baseVizSchema,
  type: z.literal('scatter'),
  xName: z.string().trim().min(1).optional(),
  yName: z.string().trim().min(1).optional(),
  unit: z.string().trim().min(1).optional(),
  legend: z.boolean().optional(),
  series: z.array(scatterSeriesSchema).min(1, '至少需要一组 scatter series'),
})

const radarSpecSchema = z
  .object({
    ...baseVizSchema,
    type: z.literal('radar'),
    legend: z.boolean().optional(),
    indicators: z.array(radarIndicatorSchema).min(3, 'radar 至少需要 3 个指标'),
    series: z.array(radarSeriesSchema).min(1, '至少需要一组 radar series'),
  })
  .superRefine((value, context) => {
    value.series.forEach((series, index) => {
      if (series.data.length !== value.indicators.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `series[${index}] 的 data 长度必须与 indicators 一致`,
          path: ['series', index, 'data'],
        })
      }
    })
  })

const heatmapSpecSchema = z
  .object({
    ...baseVizSchema,
    type: z.literal('heatmap'),
    x: z.array(z.union([z.string(), z.number()])).min(1, 'heatmap x 轴不能为空'),
    y: z.array(z.union([z.string(), z.number()])).min(1, 'heatmap y 轴不能为空'),
    xName: z.string().trim().min(1).optional(),
    yName: z.string().trim().min(1).optional(),
    values: z.array(heatmapValueSchema).min(1, 'heatmap values 不能为空'),
  })
  .superRefine((value, context) => {
    value.values.forEach((entry, index) => {
      const [xIndex, yIndex] = entry
      if (xIndex >= value.x.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `values[${index}] 的 x 索引越界`,
          path: ['values', index, 0],
        })
      }
      if (yIndex >= value.y.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `values[${index}] 的 y 索引越界`,
          path: ['values', index, 1],
        })
      }
    })
  })

const funnelSpecSchema = z.object({
  ...baseVizSchema,
  type: z.literal('funnel'),
  legend: z.boolean().optional(),
  series: z.tuple([funnelSeriesSchema]),
})

const gaugeSpecSchema = z
  .object({
    ...baseVizSchema,
    type: z.literal('gauge'),
    min: z.number().optional(),
    max: z.number().optional(),
    series: z.tuple([gaugeSeriesSchema]),
  })
  .superRefine((value, context) => {
    const min = value.min ?? 0
    const max = value.max ?? 100
    const currentValue = value.series[0].value
    if (max <= min) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'gauge.max 必须大于 gauge.min',
        path: ['max'],
      })
    }
    if (currentValue < min || currentValue > max) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'gauge 当前值必须位于 min 和 max 之间',
        path: ['series', 0, 'value'],
      })
    }
  })

const sankeySpecSchema = z
  .object({
    ...baseVizSchema,
    type: z.literal('sankey'),
    series: z.tuple([sankeySeriesSchema]),
  })
  .superRefine((value, context) => {
    const nodeNames = new Set(value.series[0].nodes.map((node) => node.name))
    value.series[0].links.forEach((link, index) => {
      if (!nodeNames.has(link.source)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `links[${index}].source 未在 nodes 中定义`,
          path: ['series', 0, 'links', index, 'source'],
        })
      }
      if (!nodeNames.has(link.target)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `links[${index}].target 未在 nodes 中定义`,
          path: ['series', 0, 'links', index, 'target'],
        })
      }
    })
  })

const candlestickSpecSchema = z
  .object({
    ...baseVizSchema,
    type: z.literal('candlestick'),
    x: z.array(z.union([z.string(), z.number()])).min(1, 'candlestick x 轴不能为空'),
    xName: z.string().trim().min(1).optional(),
    yName: z.string().trim().min(1).optional(),
    unit: z.string().trim().min(1).optional(),
    legend: z.boolean().optional(),
    series: z.tuple([candlestickSeriesSchema]),
  })
  .superRefine((value, context) => {
    if (value.series[0].data.length !== value.x.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'candlestick data 长度必须与 x 一致',
        path: ['series', 0, 'data'],
      })
    }
  })

const vizSchema = z.discriminatedUnion('type', [
  cartesianSpecSchema,
  pieSpecSchema,
  scatterSpecSchema,
  radarSpecSchema,
  heatmapSpecSchema,
  funnelSpecSchema,
  gaugeSpecSchema,
  sankeySpecSchema,
  candlestickSpecSchema,
])

function formatZodError(error: z.ZodError) {
  return error.issues.map((issue) => issue.message).join('；')
}

export function resolveEmbeddedVisualizationLanguage(className?: string) {
  const language = /language-([a-z0-9-]+)/i.exec(className ?? '')?.[1]?.toLowerCase()

  if (language === 'mermaid') {
    return 'mermaid' as const
  }

  if (language === 'viz' || language === 'chart') {
    return 'viz' as const
  }

  return null
}

export function parseVizSpec(source: string): EmbeddedVisualizationResult {
  try {
    const payload = JSON.parse(source) as unknown
    const spec = vizSchema.parse(payload) as VizSpec
    return {
      kind: 'success',
      spec,
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        kind: 'error',
        message: formatZodError(error),
      }
    }
    if (error instanceof Error) {
      return {
        kind: 'error',
        message: error.message,
      }
    }
    return {
      kind: 'error',
      message: '图表配置解析失败',
    }
  }
}
