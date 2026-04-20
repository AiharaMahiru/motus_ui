import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { StepGroupCard } from './StepGroupCard'


describe('StepGroupCard', () => {
  it('renders the step summary and tool call title', () => {
    render(
      <StepGroupCard
        group={{
          turnId: 's1:1',
          userContent: '请读取 README',
          createdAt: '2026-04-16T00:00:00Z',
          steps: [
            {
              agentName: 'researcher',
              content: '正在读取 README',
              toolCalls: [{ name: 'read_file' }],
              timestamp: '2026-04-16T00:00:01Z',
            },
          ],
        }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /执行时间线/i }))

    expect(screen.getByText(/请读取 README/)).toBeInTheDocument()
    expect(screen.getAllByText('正在读取 README')).toHaveLength(2)
    expect(screen.getByText('read_file')).toBeInTheDocument()
  })
})
