import { describe, expect, it } from 'vitest'

import { buildVizOption, parseVizSpec } from './embeddedVisualization'


describe('embeddedVisualization', () => {
  it('parses scatter spec', () => {
    const parsed = parseVizSpec(
      JSON.stringify({
        type: 'scatter',
        title: '相关性分析',
        xName: '延迟',
        yName: '成功率',
        series: [
          {
            name: '服务 A',
            points: [
              { x: 120, y: 0.91 },
              { x: 180, y: 0.86, label: '峰值时段' },
            ],
          },
        ],
      }),
    )

    expect(parsed.kind).toBe('success')
    if (parsed.kind === 'success') {
      expect(parsed.spec.type).toBe('scatter')
    }
  })

  it('rejects out-of-range heatmap indexes', () => {
    const parsed = parseVizSpec(
      JSON.stringify({
        type: 'heatmap',
        x: ['周一', '周二'],
        y: ['上午', '下午'],
        values: [
          [0, 0, 12],
          [3, 1, 8],
        ],
      }),
    )

    expect(parsed.kind).toBe('error')
    if (parsed.kind === 'error') {
      expect(parsed.message).toContain('索引越界')
    }
  })

  it('builds sankey option', () => {
    const parsed = parseVizSpec(
      JSON.stringify({
        type: 'sankey',
        title: '用户流向',
        series: [
          {
            nodes: [{ name: '访问' }, { name: '注册' }, { name: '付费' }],
            links: [
              { source: '访问', target: '注册', value: 120 },
              { source: '注册', target: '付费', value: 36 },
            ],
          },
        ],
      }),
    )

    expect(parsed.kind).toBe('success')
    if (parsed.kind !== 'success') {
      return
    }

    const option = buildVizOption(parsed.spec)
    expect(option.series).toBeDefined()
    expect(Array.isArray(option.series)).toBe(true)
    expect((option.series as Array<{ type?: string }>)[0]?.type).toBe('sankey')
  })
})
