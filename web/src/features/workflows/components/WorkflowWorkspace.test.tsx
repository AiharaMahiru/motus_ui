import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { WorkflowWorkspace } from './WorkflowWorkspace'

const baseProps = {
  definitions: [
    {
      name: 'summarize',
      description: '摘要工作流',
      input_schema: {
        properties: {
          text: {
            type: 'string',
            description: '原始文本',
          },
        },
        required: ['text'],
      },
    },
  ],
  selectedDefinitionName: 'summarize',
  goalText: '帮我总结一段内容',
  inputText: '{\n  "text": "hello"\n}',
  runtimeConfig: {
    timeoutSeconds: '600',
    maxRetries: '2',
    retryDelaySeconds: '1.5',
  },
  latestPlan: undefined,
  onGoalChange: vi.fn(),
  onInputChange: vi.fn(),
  onRuntimeConfigChange: vi.fn(),
  onUseStarterInput: vi.fn(),
  onFormatInput: vi.fn(),
  onPlanGoal: vi.fn(),
  onPlanAndRun: vi.fn(),
  onStartRun: vi.fn(),
  onCancelRun: vi.fn(),
  onTerminateRun: vi.fn(),
  onSelectRun: vi.fn(),
  isStarting: false,
  isPlanning: false,
  isAgentRunning: false,
  isCancelling: false,
  isTerminating: false,
  runs: [],
  selectedRun: undefined,
  errorMessage: undefined,
}

describe('WorkflowWorkspace', () => {
  it('renders runtime controls and forwards changes', () => {
    const onRuntimeConfigChange = vi.fn()

    render(
      <WorkflowWorkspace
        {...baseProps}
        onRuntimeConfigChange={onRuntimeConfigChange}
      />,
    )

    expect(screen.getByText('timeout_seconds')).toBeInTheDocument()
    expect(screen.getByText('max_retries')).toBeInTheDocument()
    expect(screen.getByText('retry_delay_seconds')).toBeInTheDocument()

    fireEvent.change(screen.getByDisplayValue('2'), {
      target: { value: '3' },
    })

    expect(onRuntimeConfigChange).toHaveBeenCalledWith({ maxRetries: '3' })
  })

  it('shows attempt count and runtime summary in result view', () => {
    render(
      <WorkflowWorkspace
        {...baseProps}
        selectedRun={{
          run_id: 'run-1',
          workflow_name: 'summarize',
          status: 'completed',
          created_at: '2026-04-18T00:00:00Z',
          updated_at: '2026-04-18T00:00:03Z',
          launch_mode: 'manual',
          user_goal: '帮我总结一段内容',
          planner_generated_at: '2026-04-18T00:00:01Z',
          planner_reason: '需要文本摘要',
          planner_confidence: 'high',
          planner_warnings: [],
          planner_missing_information: [],
          planner_candidate_workflows: ['summarize'],
          runtime: {
            timeout_seconds: 30,
            max_retries: 2,
            retry_delay_seconds: 1.5,
          },
          attempt_count: 2,
          project_root: '/opt/Agent',
          trace_log_dir: null,
          input_payload: { text: 'hello' },
          output_payload: { summary: 'world' },
          error: null,
        }}
      />,
    )

    expect(screen.getByText('尝试 2 次')).toBeInTheDocument()
    expect(screen.getByText('30s')).toBeInTheDocument()
    expect(screen.getByText('2 次 / 间隔 1.5s')).toBeInTheDocument()
  })

  it('shows workflow control buttons for running runs', () => {
    render(
      <WorkflowWorkspace
        {...baseProps}
        selectedRun={{
          run_id: 'run-2',
          workflow_name: 'summarize',
          status: 'running',
          created_at: '2026-04-18T00:00:00Z',
          updated_at: '2026-04-18T00:00:03Z',
          launch_mode: 'manual',
          user_goal: null,
          planner_generated_at: null,
          planner_reason: null,
          planner_confidence: null,
          planner_warnings: [],
          planner_missing_information: [],
          planner_candidate_workflows: [],
          runtime: {
            timeout_seconds: 30,
            max_retries: 0,
            retry_delay_seconds: 0,
          },
          attempt_count: 1,
          project_root: '/opt/Agent',
          trace_log_dir: null,
          input_payload: { text: 'hello' },
          output_payload: null,
          error: null,
        }}
      />,
    )

    expect(screen.getByText('取消运行')).toBeInTheDocument()
    expect(screen.getByText('强制终止')).toBeInTheDocument()
  })
})
