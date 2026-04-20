import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import { ToolExecutionViewer } from './ToolExecutionViewer'
import { parseToolExecutionPayload } from './toolExecution'


describe('ToolExecutionViewer', () => {
  it('renders to_do output as a collapsible execution panel', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })
    const payload = parseToolExecutionPayload(
      JSON.stringify([
        {
          content: 'webui smoke',
          status: 'in_progress',
          active_orm: 'running webui smoke task',
          timestamp: '2026-04-17T01:02:03Z',
        },
      ]),
    )

    expect(payload?.toolName).toBe('to_do')
    expect(payload?.status).toBe('running')

    render(
      <QueryClientProvider client={queryClient}>
        <ToolExecutionViewer payload={payload!} rawContent={JSON.stringify(payload?.raw)} />
      </QueryClientProvider>,
    )

    expect(screen.getByText('to_do')).toBeInTheDocument()
    expect(screen.getByText('执行中')).toBeInTheDocument()
    expect(screen.getAllByText('webui smoke').length).toBeGreaterThan(0)
    expect(screen.getByText('running webui smoke task')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { expanded: true }))
    expect(screen.getAllByText('webui smoke')).toHaveLength(1)
    expect(screen.queryByText('running webui smoke task')).not.toBeInTheDocument()
  })
})
