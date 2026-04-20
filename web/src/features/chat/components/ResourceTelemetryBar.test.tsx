import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ResourceTelemetryBar } from './ResourceTelemetryBar'


describe('ResourceTelemetryBar', () => {
  it('splits token usage into total, prompt, and output metrics', () => {
    render(
      <ResourceTelemetryBar
        counts={{
          messageCount: 3,
          modelCallCount: 5,
          toolCallCount: 8,
        }}
        isStreaming={false}
        lastTurnMetrics={{
          turn_usage: {},
          session_usage: {
            total_tokens: 4172,
            prompt_tokens: 4157,
            completion_tokens: 15,
          },
          context_window: {},
          agent_metrics: [],
        }}
      />,
    )

    expect(screen.getByText('发送')).toBeInTheDocument()
    expect(screen.getByText('工具')).toBeInTheDocument()
    expect(screen.getByText('模型')).toBeInTheDocument()
    expect(screen.getByText('Total')).toBeInTheDocument()
    expect(screen.getByText('Prompt')).toBeInTheDocument()
    expect(screen.getAllByText('4.2K')).toHaveLength(2)
    expect(screen.getByText('Output')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('estimates cost from usage and model when backend cost is missing', () => {
    render(
      <ResourceTelemetryBar
        currentSession={{
          model_name: 'gpt-4o',
          pricing_model: null,
          total_usage: {
            total_tokens: 4172,
            prompt_tokens: 4157,
            completion_tokens: 15,
          },
          total_cost_usd: null,
        } as never}
        isStreaming={false}
        lastTurnMetrics={{
          turn_usage: {
            total_tokens: 4172,
            prompt_tokens: 4157,
            completion_tokens: 15,
          },
          session_usage: {
            total_tokens: 4172,
            prompt_tokens: 4157,
            completion_tokens: 15,
          },
          turn_cost_usd: null,
          session_cost_usd: null,
          context_window: {},
          agent_metrics: [],
        }}
      />,
    )

    expect(screen.getAllByText('≈$0.0105')).toHaveLength(2)
  })
})
