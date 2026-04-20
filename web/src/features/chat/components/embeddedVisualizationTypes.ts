export type EmbeddedVisualizationLanguage = 'mermaid' | 'viz'

export type EmbeddedVisualizationResult =
  | {
      kind: 'success'
      spec: VizSpec
    }
  | {
      kind: 'error'
      message: string
    }

export type CartesianSeries = {
  color?: string
  data: number[]
  name: string
}

export type PiePoint = {
  name: string
  value: number
}

export type PieSeries = {
  data: PiePoint[]
  name?: string
}

export type ScatterPoint = {
  label?: string
  size?: number
  x: number
  y: number
}

export type ScatterSeries = {
  color?: string
  name: string
  points: ScatterPoint[]
}

export type RadarIndicator = {
  max: number
  name: string
}

export type RadarSeries = {
  color?: string
  data: number[]
  name: string
}

export type HeatmapValue = [number, number, number]

export type FunnelSeries = {
  data: PiePoint[]
  name?: string
}

export type GaugeSeries = {
  detail?: string
  name?: string
  value: number
}

export type SankeyNode = {
  name: string
}

export type SankeyLink = {
  source: string
  target: string
  value: number
}

export type SankeySeries = {
  links: SankeyLink[]
  name?: string
  nodes: SankeyNode[]
}

export type CandlestickSeries = {
  data: Array<[number, number, number, number]>
  name?: string
}

export type VizCartesianSpec = {
  height?: number
  legend?: boolean
  palette?: string[]
  series: CartesianSeries[]
  smooth?: boolean
  stacked?: boolean
  subtitle?: string
  title?: string
  type: 'area' | 'bar' | 'line'
  unit?: string
  x: Array<string | number>
  xName?: string
  yName?: string
}

export type VizPieSpec = {
  height?: number
  legend?: boolean
  palette?: string[]
  series: [PieSeries]
  subtitle?: string
  title?: string
  type: 'doughnut' | 'pie'
}

export type VizScatterSpec = {
  height?: number
  legend?: boolean
  palette?: string[]
  series: ScatterSeries[]
  subtitle?: string
  title?: string
  type: 'scatter'
  unit?: string
  xName?: string
  yName?: string
}

export type VizRadarSpec = {
  height?: number
  legend?: boolean
  palette?: string[]
  indicators: RadarIndicator[]
  series: RadarSeries[]
  subtitle?: string
  title?: string
  type: 'radar'
}

export type VizHeatmapSpec = {
  height?: number
  palette?: string[]
  subtitle?: string
  title?: string
  type: 'heatmap'
  values: HeatmapValue[]
  x: Array<string | number>
  xName?: string
  y: Array<string | number>
  yName?: string
}

export type VizFunnelSpec = {
  height?: number
  legend?: boolean
  palette?: string[]
  series: [FunnelSeries]
  subtitle?: string
  title?: string
  type: 'funnel'
}

export type VizGaugeSpec = {
  height?: number
  max?: number
  min?: number
  palette?: string[]
  series: [GaugeSeries]
  subtitle?: string
  title?: string
  type: 'gauge'
}

export type VizSankeySpec = {
  height?: number
  palette?: string[]
  series: [SankeySeries]
  subtitle?: string
  title?: string
  type: 'sankey'
}

export type VizCandlestickSpec = {
  height?: number
  legend?: boolean
  palette?: string[]
  series: [CandlestickSeries]
  subtitle?: string
  title?: string
  type: 'candlestick'
  unit?: string
  x: Array<string | number>
  xName?: string
  yName?: string
}

export type VizSpec =
  | VizCartesianSpec
  | VizPieSpec
  | VizScatterSpec
  | VizRadarSpec
  | VizHeatmapSpec
  | VizFunnelSpec
  | VizGaugeSpec
  | VizSankeySpec
  | VizCandlestickSpec
