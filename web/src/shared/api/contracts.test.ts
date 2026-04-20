import { describe, expect, it } from 'vitest'

import {
  appMetaSchema,
  runtimeToolCatalogSchema,
  sessionDetailSchema,
  workflowCatalogResponseSchema,
  workflowRunSummarySchema,
} from './contracts'

describe('shared api contracts', () => {
  it('parses extended app meta capabilities', () => {
    const payload = appMetaSchema.parse({
      app_version: '1.0.0',
      desktop_mode: false,
      backend_mode: 'local',
      api_base_url: 'http://127.0.0.1:8000',
      runtime_dir: '/tmp/runtime',
      project_root: '/tmp/project',
      server_started_at: '2026-04-18T00:00:00Z',
      supports_interrupts: false,
      supports_dynamic_session_config: true,
      supports_preview: true,
      supports_structured_response_format: true,
    })

    expect(payload.backend_mode).toBe('local')
    expect(payload.supports_preview).toBe(true)
    expect(payload.supports_structured_response_format).toBe(true)
  })

  it('parses session detail with motus governance fields', () => {
    const payload = sessionDetailSchema.parse({
      session_id: 'session-1',
      title: '结构化输出测试',
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
      trace_log_dir: '/opt/Agent/runtime/traces',
      system_prompt: '你是一个可靠的中文助理。',
      provider: 'openai',
      model_client: {
        mode: 'override',
        base_url: 'https://example.test/v1',
        api_key_env_var: 'OPENAI_API_KEY',
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
      enabled_tools: ['bash', 'read_file'],
      mcp_servers: [
        {
          name: 'docs',
          transport: 'remote_http',
          url: 'https://mcp.example.com',
          headers: { Authorization: 'Bearer token' },
          args: [],
          env: {},
          prefix: 'docs_',
          allowlist: ['search'],
          blocklist: [],
          method_aliases: { search: 'docs_search' },
          image: null,
          port: 8080,
          sandbox_path: '/mcp',
          sandbox: null,
        },
      ],
      multi_agent: {
        supervisor_name: 'assistant',
        specialists: [],
      },
      sandbox: {
        provider: 'docker',
        cwd: null,
        image: 'python:3.12',
        cloud_url: null,
        token_env_var: null,
        env: { PYTHONUNBUFFERED: '1' },
        mount_project_root: true,
        mount_path: '/workspace',
        restrict_file_tools_to_workspace: true,
      },
      human_in_the_loop: false,
      approval_tool_names: ['bash'],
      input_guardrails: [],
      output_guardrails: [],
      tool_guardrails: [],
      response_format: {
        name: 'Summary',
        description: '结构化摘要',
        fields: [{ name: 'summary', type: 'string', required: true }],
      },
      memory: {
        type: 'compact',
        compact_model_name: 'gpt-5.4 mini',
        safety_ratio: 0.5,
        token_threshold: 256000,
        max_tool_result_tokens: 50000,
        tool_result_truncation_suffix: '... truncated',
      },
      context_window: {},
      last_response: null,
      interrupts: [],
      resume_supported: false,
      resume_blocked_reason: null,
    })

    expect(payload.provider).toBe('openai')
    expect(payload.model_client.mode).toBe('override')
    expect(payload.cache_policy).toBe('auto')
    expect(payload.sandbox.provider).toBe('docker')
    expect(payload.memory.type).toBe('compact')
    expect(payload.response_format.fields).toHaveLength(1)
  })

  it('parses workflow runtime fields', () => {
    const payload = workflowRunSummarySchema.parse({
      run_id: 'run-1',
      workflow_name: 'summarize',
      status: 'running',
      created_at: '2026-04-18T00:00:00Z',
      updated_at: '2026-04-18T00:00:05Z',
      launch_mode: 'manual',
      user_goal: null,
      planner_generated_at: '2026-04-18T00:00:01Z',
      planner_reason: null,
      planner_confidence: null,
      planner_warnings: [],
      planner_missing_information: [],
      planner_candidate_workflows: ['summarize'],
      runtime: {
        timeout_seconds: 30,
        max_retries: 2,
        retry_delay_seconds: 1.5,
      },
      attempt_count: 1,
      project_root: '/opt/Agent',
      trace_log_dir: '/opt/Agent/runtime/traces',
    })

    expect(payload.runtime.max_retries).toBe(2)
    expect(payload.runtime.retry_delay_seconds).toBe(1.5)
    expect(payload.attempt_count).toBe(1)
  })

  it('parses runtime tool and workflow catalogs', () => {
    const toolCatalog = runtimeToolCatalogSchema.parse({
      tools: [
        {
          name: 'dynamic_echo',
          group: 'system',
          label: 'dynamic_echo',
          description: '动态工具',
          source: 'filesystem',
          persistence: 'filesystem',
          human_in_the_loop_only: false,
        },
      ],
    })
    const workflowCatalog = workflowCatalogResponseSchema.parse({
      workflows: [
        {
          name: 'dynamic_echo_flow',
          source: 'filesystem',
          persistence: 'filesystem',
          description: '动态 workflow',
        },
      ],
    })

    expect(toolCatalog.tools[0].source).toBe('filesystem')
    expect(workflowCatalog.workflows[0].name).toBe('dynamic_echo_flow')
  })
})
