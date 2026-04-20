import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { DEFAULT_SESSION_DRAFT } from '../constants'
import { SessionConfigPanel } from './SessionConfigPanel'

const baseProps = {
  capabilities: {
    supportsInterrupts: true,
    supportsStructuredResponseFormat: true,
  },
  config: DEFAULT_SESSION_DRAFT,
  currentSession: undefined,
  isCreating: false,
  isReadOnly: false,
  isSaving: false,
  isStreaming: false,
  availableToolOptions: undefined,
  onConfigChange: vi.fn(),
  onCreateSession: vi.fn(),
  onResetConfig: vi.fn(),
  onSaveCurrentSession: vi.fn(),
  onToggleTool: vi.fn(),
}

describe('SessionConfigPanel', () => {
  it('renders grouped advanced sections from the new session draft', () => {
    render(<SessionConfigPanel {...baseProps} />)

    expect(screen.getByText('模型与运行策略')).toBeInTheDocument()
    expect(screen.getByText('工具能力')).toBeInTheDocument()
    expect(screen.getByText('MCP')).toBeInTheDocument()
    expect(screen.getByText('多代理')).toBeInTheDocument()
    expect(screen.getByText('护栏规则')).toBeInTheDocument()
    expect(screen.getByText('结构化输出')).toBeInTheDocument()
    expect(screen.getByText('记忆')).toBeInTheDocument()
    expect(screen.getByText('沙盒')).toBeInTheDocument()
    expect(screen.queryByText(/当前页面所有配置都直接对应这个 session/)).not.toBeInTheDocument()
    expect(screen.queryByText(/新会话默认启用全部 tools/)).not.toBeInTheDocument()
    expect(screen.queryByText(/完整表达主管\/专家树/)).not.toBeInTheDocument()
  })

  it('shows read only state for persisted sessions when dynamic config is disabled', () => {
    render(
      <SessionConfigPanel
        {...baseProps}
        currentSession={{
          session_id: 'session-1',
          title: '只读会话',
          status: 'idle',
          model_name: 'gpt-5.4',
          created_at: '2026-04-18T00:00:00Z',
          updated_at: '2026-04-18T00:00:00Z',
          message_count: 0,
          total_usage: {},
          total_cost_usd: null,
          last_error: null,
          multi_agent_enabled: false,
          specialist_count: 0,
          project_root: '/opt/Agent',
          trace_log_dir: null,
          system_prompt: '你是一个可靠的中文助理。',
          provider: 'openai',
          model_client: {
            mode: 'inherit',
            base_url: null,
            api_key_env_var: null,
          },
          pricing_model: null,
          cache_policy: 'auto',
          max_steps: 1024,
          timeout_seconds: 600,
          thinking: {
            enabled: true,
            effort: 'medium',
            verbosity: 'medium',
            budget_tokens: null,
          },
          enabled_tools: ['bash'],
          mcp_servers: [],
          multi_agent: {
            supervisor_name: 'assistant',
            specialists: [],
          },
          sandbox: {
            provider: 'local',
            cwd: null,
            image: null,
            cloud_url: null,
            token_env_var: null,
            env: {},
            mount_project_root: true,
            mount_path: '/workspace',
            restrict_file_tools_to_workspace: true,
          },
          human_in_the_loop: false,
          approval_tool_names: [],
          input_guardrails: [],
          output_guardrails: [],
          tool_guardrails: [],
          response_format: {
            name: 'structured_response',
            description: '',
            fields: [],
          },
          memory: {
            type: 'compact',
            compact_model_name: 'gpt-5.4 mini',
            safety_ratio: 0.5,
            token_threshold: 256000,
            max_tool_result_tokens: 50000,
            tool_result_truncation_suffix: '\n\n... [content truncated due to length]',
          },
          context_window: {},
          last_response: null,
          interrupts: [],
          resume_supported: false,
          resume_blocked_reason: null,
        }}
        isReadOnly
      />,
    )

    expect(screen.getByText('当前会话配置只读。')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('例如：代码审查 / 需求梳理')).toBeDisabled()
  })

  it('hides structured response section when capability probe is disabled', () => {
    render(
      <SessionConfigPanel
        {...baseProps}
        capabilities={{
          supportsInterrupts: true,
          supportsStructuredResponseFormat: false,
        }}
      />,
    )

    expect(screen.queryByText('结构化输出')).not.toBeInTheDocument()
  })

  it('allows toggling model provider from the runtime section', () => {
    const onConfigChange = vi.fn()
    render(<SessionConfigPanel {...baseProps} onConfigChange={onConfigChange} />)

    fireEvent.change(screen.getByRole('combobox', { name: '服务商' }), {
      target: { value: 'gemini' },
    })

    expect(onConfigChange).toHaveBeenCalled()
  })

  it('renders model client override fields', () => {
    render(<SessionConfigPanel {...baseProps} />)

    expect(screen.getByText('模型连接模式')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('例如 https://api.openai.com/v1')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('例如 OPENAI_API_KEY')).toBeInTheDocument()
  })
})
