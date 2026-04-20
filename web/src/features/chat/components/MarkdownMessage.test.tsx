import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { MarkdownMessage } from './MarkdownMessage'


describe('MarkdownMessage', () => {
  it('renders common LLM markdown features', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <MarkdownMessage
          content={[
            '## 标题',
            '',
            '**重点** 内容',
            '',
            '- [x] 已完成',
            '- 普通列表',
            '',
            '| A | B |',
            '| - | - |',
            '| 1 | 2 |',
            '',
            '```ts',
            'const value = 1',
            '```',
          ].join('\n')}
        />
      </QueryClientProvider>,
    )

    expect(screen.getByRole('heading', { name: '标题' })).toBeInTheDocument()
    expect(screen.getByText('重点')).toBeInTheDocument()
    expect(screen.getByText('已完成')).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('const value = 1')).toBeInTheDocument()
  })

  it('shows runnable preview action for supported code blocks inside sessions', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <MarkdownMessage
          content={[
            '```html',
            '<div>hello preview</div>',
            '```',
          ].join('\n')}
          previewContext={{ sessionId: 'session-demo' }}
        />
      </QueryClientProvider>,
    )

    expect(screen.getByRole('button', { name: '运行预览' })).toBeInTheDocument()
    expect(screen.getByText('HTML 预览')).toBeInTheDocument()
  })

  it('renders mermaid blocks as embedded diagrams', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <MarkdownMessage
          content={[
            '```mermaid',
            'flowchart LR',
            'A[用户问题] --> B[Agent 规划]',
            'B --> C[工具调用]',
            '```',
          ].join('\n')}
        />
      </QueryClientProvider>,
    )

    expect(await screen.findByText('Mermaid')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: '复制可视化源码' })).toBeInTheDocument()
  })

  it('renders viz blocks as embedded charts', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <MarkdownMessage
          content={[
            '```viz',
            '{',
            '  "type": "line",',
            '  "title": "近 7 天调用量",',
            '  "x": ["04-12", "04-13", "04-14"],',
            '  "series": [',
            '    { "name": "tool_calls", "data": [12, 18, 9] }',
            '  ]',
            '}',
            '```',
          ].join('\n')}
        />
      </QueryClientProvider>,
    )

    expect(await screen.findByText('Viz')).toBeInTheDocument()
    expect((await screen.findAllByText('近 7 天调用量')).length).toBeGreaterThan(0)
    expect(await screen.findByRole('button', { name: '复制可视化源码' })).toBeInTheDocument()
  })
})
