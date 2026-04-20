import { z } from 'zod'

export const usageSchema = z.record(z.string(), z.unknown())

export const chatMessageSchema = z
  .object({
    role: z.string(),
    content: z.union([z.string(), z.array(z.unknown())]).nullable().optional(),
  })
  .passthrough()

export const providerSchema = z.enum(['openai', 'anthropic', 'gemini', 'openrouter'])
export const cachePolicySchema = z.enum(['none', 'static', 'auto', 'auto_1h'])
export const modelClientModeSchema = z.enum(['inherit', 'override'])

export const thinkingConfigSchema = z.object({
  enabled: z.boolean(),
  effort: z.enum(['minimal', 'low', 'medium', 'high', 'xhigh']).nullable().optional(),
  verbosity: z.enum(['low', 'medium', 'high']).nullable().optional(),
  budget_tokens: z.number().int().nullable().optional(),
})

export const modelClientConfigSchema = z.object({
  base_url: z.string().nullable().optional(),
  api_key_env_var: z.string().nullable().optional(),
  mode: modelClientModeSchema.default('inherit'),
})

export const sandboxConfigSchema = z.object({
  provider: z.enum(['local', 'docker', 'cloud']).default('local'),
  cwd: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
  cloud_url: z.string().nullable().optional(),
  token_env_var: z.string().nullable().optional(),
  env: z.record(z.string(), z.string()).default({}),
  mount_project_root: z.boolean().default(true),
  mount_path: z.string().default('/workspace'),
  restrict_file_tools_to_workspace: z.boolean().default(true),
})

export const guardrailRuleSchema = z.object({
  kind: z.enum(['max_length', 'deny_regex', 'require_regex', 'rewrite_regex']),
  message: z.string().nullable().optional(),
  pattern: z.string().nullable().optional(),
  replacement: z.string().nullable().optional(),
  max_length: z.number().int().nullable().optional(),
  ignore_case: z.boolean().default(false),
  multiline: z.boolean().default(false),
  dotall: z.boolean().default(false),
})

export const toolGuardrailConfigSchema = z.object({
  tool_name: z.string().min(1),
  input_rules: z.array(guardrailRuleSchema).default([]),
  output_rules: z.array(guardrailRuleSchema).default([]),
  path_fields: z.array(z.string()).default([]),
  require_absolute_paths: z.boolean().default(false),
  allowed_roots: z.array(z.string()).default([]),
})

export const responseNodeTypeSchema = z.enum([
  'string',
  'integer',
  'number',
  'boolean',
  'string[]',
  'integer[]',
  'number[]',
  'boolean[]',
  'object',
  'array',
])

type ResponseNodeType = z.infer<typeof responseNodeTypeSchema>

type ResponseSchemaNodeShape = {
  type: ResponseNodeType
  description?: string | null
  nullable?: boolean
  properties: ResponseFieldConfigShape[]
  items?: ResponseSchemaNodeShape | null
}

type ResponseFieldConfigShape = {
  name: string
  type?: ResponseNodeType | null
  schema?: ResponseSchemaNodeShape | null
  schema_config?: ResponseSchemaNodeShape | null
  description?: string | null
  required: boolean
}

export const responseSchemaNodeSchema: z.ZodType<ResponseSchemaNodeShape> = z.lazy(() =>
  z.object({
    type: responseNodeTypeSchema.default('string'),
    description: z.string().nullable().optional(),
    nullable: z.boolean().default(false),
    properties: z.array(responseFieldConfigSchema).default([]),
    items: responseSchemaNodeSchema.nullable().optional(),
  }),
)

export const responseFieldConfigSchema: z.ZodType<ResponseFieldConfigShape> = z.lazy(() =>
  z.object({
    name: z.string().min(1),
    type: responseNodeTypeSchema.nullable().optional(),
    schema: responseSchemaNodeSchema.nullable().optional(),
    schema_config: responseSchemaNodeSchema.nullable().optional(),
    description: z.string().nullable().optional(),
    required: z.boolean().default(true),
  }),
)

export const responseFormatConfigSchema = z.object({
  name: z.string().default('structured_response'),
  description: z.string().nullable().optional(),
  fields: z.array(responseFieldConfigSchema).default([]),
})

export const memoryConfigSchema = z.object({
  type: z.enum(['basic', 'compact']).default('compact'),
  compact_model_name: z.string().nullable().optional(),
  safety_ratio: z.number().nullable().optional(),
  token_threshold: z.number().int().nullable().optional(),
  max_tool_result_tokens: z.number().int().default(50_000),
  tool_result_truncation_suffix: z.string().default('\n\n... [content truncated due to length]'),
})

export const mcpServerConfigSchema: z.ZodType<{
  name: string
  transport: 'remote_http' | 'local_stdio'
  url?: string | null | undefined
  command?: string | null | undefined
  args: string[]
  env: Record<string, string>
  headers: Record<string, string>
  prefix: string
  allowlist: string[]
  blocklist: string[]
  method_aliases: Record<string, string>
  image?: string | null | undefined
  port: number
  sandbox_path: string
  sandbox?: z.infer<typeof sandboxConfigSchema> | null | undefined
}> = z.object({
  name: z.string(),
  transport: z.enum(['remote_http', 'local_stdio']),
  url: z.string().nullable().optional(),
  command: z.string().nullable().optional(),
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).default({}),
  headers: z.record(z.string(), z.string()).default({}),
  prefix: z.string().default(''),
  allowlist: z.array(z.string()).default([]),
  blocklist: z.array(z.string()).default([]),
  method_aliases: z.record(z.string(), z.string()).default({}),
  image: z.string().nullable().optional(),
  port: z.number().int().default(8080),
  sandbox_path: z.string().default('/mcp'),
  sandbox: sandboxConfigSchema.nullable().optional(),
})

export const specialistAgentConfigSchema: z.ZodType<unknown> = z.lazy(() =>
  z.object({
    name: z.string(),
    description: z.string(),
    tool_name: z.string().optional().nullable(),
    system_prompt: z.string().optional().nullable(),
    provider: providerSchema.optional().nullable(),
    model_name: z.string().optional().nullable(),
    pricing_model: z.string().optional().nullable(),
    max_steps: z.number().int().optional().nullable(),
    tool_max_steps: z.number().int().optional().nullable(),
    timeout_seconds: z.number().optional().nullable(),
    thinking: thinkingConfigSchema.optional().nullable(),
    enabled_tools: z.array(z.string()).optional().nullable(),
    mcp_servers: z.array(mcpServerConfigSchema).optional().nullable(),
    stateful: z.boolean().default(false),
    output_extractor: z
      .object({
        mode: z.enum(['full', 'json', 'field']).default('full'),
        field_path: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
    specialists: z.array(specialistAgentConfigSchema).default([]),
  }),
)

export const multiAgentConfigSchema = z.object({
  supervisor_name: z.string(),
  specialists: z.array(specialistAgentConfigSchema).default([]),
})

export const agentMetricsSchema = z.object({
  agent_name: z.string(),
  role: z.enum(['supervisor', 'specialist']),
  model_name: z.string(),
  pricing_model: z.string().nullable().optional(),
  stateful: z.boolean().default(false),
  turn_usage: usageSchema,
  session_usage: usageSchema,
  turn_cost_usd: z.number().nullable().optional(),
  session_cost_usd: z.number().nullable().optional(),
})

export const turnMetricsSchema = z.object({
  turn_usage: usageSchema,
  session_usage: usageSchema,
  turn_cost_usd: z.number().nullable().optional(),
  session_cost_usd: z.number().nullable().optional(),
  context_window: usageSchema,
  agent_metrics: z.array(agentMetricsSchema).default([]),
})

export const interruptInfoSchema = z.object({
  interrupt_id: z.string(),
  type: z.string(),
  payload: z.record(z.string(), z.unknown()).default({}),
  resumable: z.boolean().default(true),
  resume_blocked_reason: z.string().nullable().optional(),
})

export const sessionSummarySchema = z.object({
  session_id: z.string(),
  title: z.string().nullable().optional(),
  status: z.enum(['idle', 'running', 'interrupted', 'error']),
  model_name: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  message_count: z.number().int(),
  total_usage: usageSchema,
  total_cost_usd: z.number().nullable().optional(),
  last_error: z.string().nullable().optional(),
  multi_agent_enabled: z.boolean().default(false),
  specialist_count: z.number().int().default(0),
  project_root: z.string().nullable().optional(),
  trace_log_dir: z.string().nullable().optional(),
})

export const sessionDetailSchema = sessionSummarySchema.extend({
  system_prompt: z.string(),
  provider: providerSchema.default('openai'),
  model_client: modelClientConfigSchema.default({
    mode: 'inherit',
  }),
  pricing_model: z.string().nullable().optional(),
  cache_policy: cachePolicySchema.default('auto'),
  max_steps: z.number().int(),
  timeout_seconds: z.number().nullable().optional(),
  thinking: thinkingConfigSchema,
  enabled_tools: z.array(z.string()).default([]),
  mcp_servers: z.array(mcpServerConfigSchema).default([]),
  multi_agent: multiAgentConfigSchema,
  sandbox: sandboxConfigSchema.default({
    provider: 'local',
    env: {},
    mount_project_root: true,
    mount_path: '/workspace',
    restrict_file_tools_to_workspace: true,
  }),
  human_in_the_loop: z.boolean().default(false),
  approval_tool_names: z.array(z.string()).default([]),
  input_guardrails: z.array(guardrailRuleSchema).default([]),
  output_guardrails: z.array(guardrailRuleSchema).default([]),
  tool_guardrails: z.array(toolGuardrailConfigSchema).default([]),
  response_format: responseFormatConfigSchema.default({
    name: 'structured_response',
    fields: [],
  }),
  memory: memoryConfigSchema.default({
    type: 'compact',
    compact_model_name: 'gpt-5.4 mini',
    safety_ratio: 0.5,
    token_threshold: 256000,
    max_tool_result_tokens: 50000,
    tool_result_truncation_suffix: '\n\n... [content truncated due to length]',
  }),
  context_window: usageSchema,
  last_response: chatMessageSchema.nullable().optional(),
  interrupts: z.array(interruptInfoSchema).nullable().optional(),
  resume_supported: z.boolean().default(false),
  resume_blocked_reason: z.string().nullable().optional(),
})

export const sessionCreateRequestSchema = z.object({
  title: z.string().nullable().optional(),
  system_prompt: z.string(),
  provider: providerSchema.default('openai'),
  model_name: z.string(),
  model_client: modelClientConfigSchema.default({
    mode: 'inherit',
  }),
  pricing_model: z.string().nullable().optional(),
  cache_policy: cachePolicySchema.default('auto'),
  max_steps: z.number().int(),
  timeout_seconds: z.number().nullable().optional(),
  thinking: thinkingConfigSchema,
  enabled_tools: z.array(z.string()).default([]),
  mcp_servers: z.array(mcpServerConfigSchema).default([]),
  multi_agent: multiAgentConfigSchema,
  sandbox: sandboxConfigSchema.default({
    provider: 'local',
    env: {},
    mount_project_root: true,
    mount_path: '/workspace',
    restrict_file_tools_to_workspace: true,
  }),
  human_in_the_loop: z.boolean().default(false),
  approval_tool_names: z.array(z.string()).default([]),
  input_guardrails: z.array(guardrailRuleSchema).default([]),
  output_guardrails: z.array(guardrailRuleSchema).default([]),
  tool_guardrails: z.array(toolGuardrailConfigSchema).default([]),
  response_format: responseFormatConfigSchema.default({
    name: 'structured_response',
    fields: [],
  }),
  memory: memoryConfigSchema.default({
    type: 'compact',
    compact_model_name: 'gpt-5.4 mini',
    safety_ratio: 0.5,
    token_threshold: 256000,
    max_tool_result_tokens: 50000,
    tool_result_truncation_suffix: '\n\n... [content truncated due to length]',
  }),
})

export const sessionUpdateRequestSchema = z.object({
  title: z.string().nullable().optional(),
  system_prompt: z.string().nullable().optional(),
  provider: providerSchema.nullable().optional(),
  model_name: z.string().nullable().optional(),
  model_client: modelClientConfigSchema.nullable().optional(),
  pricing_model: z.string().nullable().optional(),
  cache_policy: cachePolicySchema.nullable().optional(),
  max_steps: z.number().int().nullable().optional(),
  timeout_seconds: z.number().nullable().optional(),
  thinking: thinkingConfigSchema.nullable().optional(),
  enabled_tools: z.array(z.string()).nullable().optional(),
  mcp_servers: z.array(mcpServerConfigSchema).nullable().optional(),
  multi_agent: multiAgentConfigSchema.nullable().optional(),
  sandbox: sandboxConfigSchema.nullable().optional(),
  human_in_the_loop: z.boolean().nullable().optional(),
  approval_tool_names: z.array(z.string()).nullable().optional(),
  input_guardrails: z.array(guardrailRuleSchema).nullable().optional(),
  output_guardrails: z.array(guardrailRuleSchema).nullable().optional(),
  tool_guardrails: z.array(toolGuardrailConfigSchema).nullable().optional(),
  response_format: responseFormatConfigSchema.nullable().optional(),
  memory: memoryConfigSchema.nullable().optional(),
})

export const sessionMessageDeleteRequestSchema = z.object({
  indices: z.array(z.number().int().min(0)).min(1),
})

export const sessionMessageDeleteResponseSchema = z.object({
  session_id: z.string(),
  deleted_count: z.number().int(),
  message_count: z.number().int(),
  updated_at: z.string(),
})

export const interruptResumeRequestSchema = z.object({
  interrupt_id: z.string().min(1),
  value: z.record(z.string(), z.unknown()).default({}),
})

export const messageResponseSchema = z.object({
  session_id: z.string(),
  assistant: chatMessageSchema.nullable().optional(),
  metrics: turnMetricsSchema.nullable().optional(),
  status: z.enum(['idle', 'running', 'interrupted', 'error']).default('idle'),
  error: z.string().nullable().optional(),
  interrupts: z.array(interruptInfoSchema).nullable().optional(),
})

export const workflowDefinitionSummarySchema = z.object({
  name: z.string(),
  description: z.string(),
  input_schema: z.record(z.string(), z.unknown()),
})

export const workflowPlannerRequestSchema = z.object({
  goal: z.string().min(1),
})

export const workflowPlannerPlanSchema = z.object({
  workflow_name: z.string(),
  input_payload: z.record(z.string(), z.unknown()),
  reason: z.string(),
  confidence: z.enum(['low', 'medium', 'high']).default('medium'),
  missing_information: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  candidate_workflows: z.array(z.string()).default([]),
})

export const workflowPlannerResponseSchema = z.object({
  goal: z.string(),
  generated_at: z.string(),
  plan: workflowPlannerPlanSchema,
})

export const workflowRuntimeConfigSchema = z.object({
  timeout_seconds: z.number().nullable().optional(),
  max_retries: z.number().int().default(0),
  retry_delay_seconds: z.number().default(0),
})

export const workflowRunRequestSchema = z.object({
  workflow_name: z.string(),
  input_payload: z.record(z.string(), z.unknown()),
  runtime: workflowRuntimeConfigSchema.default({
    max_retries: 0,
    retry_delay_seconds: 0,
  }),
})

export const workflowRunSummarySchema = z.object({
  run_id: z.string(),
  workflow_name: z.string(),
  status: z.enum(['queued', 'running', 'completed', 'cancelled', 'terminated', 'error']),
  created_at: z.string(),
  updated_at: z.string(),
  launch_mode: z.enum(['manual', 'agent']).default('manual'),
  user_goal: z.string().nullable().optional(),
  planner_generated_at: z.string().nullable().optional(),
  planner_reason: z.string().nullable().optional(),
  planner_confidence: z.enum(['low', 'medium', 'high']).nullable().optional(),
  planner_warnings: z.array(z.string()).default([]),
  planner_missing_information: z.array(z.string()).default([]),
  planner_candidate_workflows: z.array(z.string()).default([]),
  runtime: workflowRuntimeConfigSchema.default({
    max_retries: 0,
    retry_delay_seconds: 0,
  }),
  attempt_count: z.number().int().default(0),
  project_root: z.string().nullable().optional(),
  trace_log_dir: z.string().nullable().optional(),
})

export const workflowRunDetailSchema = workflowRunSummarySchema.extend({
  input_payload: z.record(z.string(), z.unknown()),
  output_payload: z.record(z.string(), z.unknown()).nullable().optional(),
  error: z.string().nullable().optional(),
})

export const workflowRunControlRequestSchema = z.object({
  reason: z.string().nullable().optional(),
})

export const tracingConfigSummarySchema = z.object({
  collection_level: z.enum(['disabled', 'basic', 'detailed']),
  export_enabled: z.boolean(),
  online_tracing: z.boolean(),
  cloud_enabled: z.boolean(),
  log_dir: z.string(),
  project: z.string().nullable().optional(),
  build: z.string().nullable().optional(),
  session_id: z.string().nullable().optional(),
})

export const tracingStatusSchema = z.object({
  scope: z.enum(['runtime', 'session', 'workflow']),
  session_id: z.string().nullable().optional(),
  workflow_run_id: z.string().nullable().optional(),
  project_root: z.string().nullable().optional(),
  runtime_initialized: z.boolean(),
  trace_id: z.string(),
  collecting: z.boolean(),
  tracked_task_count: z.number().int(),
  runtime_tracked_task_count: z.number().int(),
  log_dir: z.string(),
  viewer_url: z.string().nullable().optional(),
  available_files: z.array(z.string()).default([]),
  config: tracingConfigSummarySchema,
})

export const traceExportResultSchema = z.object({
  scope: z.enum(['runtime', 'session', 'workflow']),
  session_id: z.string().nullable().optional(),
  workflow_run_id: z.string().nullable().optional(),
  project_root: z.string().nullable().optional(),
  trace_id: z.string(),
  exported: z.boolean(),
  log_dir: z.string(),
  files: z.array(z.string()).default([]),
  trace_viewer_file: z.string().nullable().optional(),
  json_state_file: z.string().nullable().optional(),
  jaeger_file: z.string().nullable().optional(),
  message: z.string().nullable().optional(),
})

export const toolMessageSummaryRequestSchema = z.object({
  tool_name: z.string().min(1),
  content: z.string().min(1),
})

export const toolMessageSummaryResponseSchema = z.object({
  tool_name: z.string(),
  summary: z.string(),
  model_name: z.string(),
  cached: z.boolean().default(false),
})

export const previewRunRequestSchema = z.object({
  language: z.enum(['html', 'react', 'jsx', 'tsx', 'python', 'py']),
  code: z.string().min(1).max(200_000),
  title: z.string().max(120).nullable().optional(),
})

export const previewArtifactSchema = z.object({
  kind: z.enum(['html', 'image', 'text']),
  file_name: z.string(),
  content_type: z.string(),
  url: z.string().nullable().optional(),
  text_content: z.string().nullable().optional(),
})

export const previewTerminalStateSchema = z.object({
  cols: z.number().int().default(100),
  rows: z.number().int().default(32),
  screen_text: z.string().default(''),
  transcript_tail: z.string().nullable().optional(),
  can_write_stdin: z.boolean().default(false),
  exit_code: z.number().int().nullable().optional(),
})

export const previewTerminalInputRequestSchema = z.object({
  text: z.string().max(4_000).default(''),
  append_newline: z.boolean().default(true),
})

export const previewTerminalResizeRequestSchema = z.object({
  cols: z.number().int().min(40).max(240).default(100),
  rows: z.number().int().min(12).max(80).default(32),
})

export const previewRunResponseSchema = z.object({
  run_id: z.string(),
  session_id: z.string(),
  language: z.enum(['html', 'react', 'jsx', 'tsx', 'python', 'py']),
  normalized_language: z.enum(['html', 'react', 'python']),
  mode: z.enum(['artifact', 'terminal']).default('artifact'),
  status: z.enum(['running', 'completed', 'error']),
  title: z.string().nullable().optional(),
  created_at: z.string(),
  completed_at: z.string().nullable().optional(),
  command: z.string().nullable().optional(),
  run_dir: z.string(),
  source_file: z.string(),
  artifact: previewArtifactSchema.nullable().optional(),
  terminal: previewTerminalStateSchema.nullable().optional(),
  stdout: z.string().nullable().optional(),
  stderr: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
})

export const appMetaSchema = z.object({
  app_version: z.string(),
  desktop_mode: z.boolean(),
  backend_mode: z.string(),
  api_base_url: z.string(),
  runtime_dir: z.string(),
  project_root: z.string(),
  server_started_at: z.string(),
  supports_interrupts: z.boolean().default(false),
  supports_dynamic_session_config: z.boolean().default(true),
  supports_preview: z.boolean().default(true),
  supports_structured_response_format: z.boolean().default(false),
})

export const runtimeRequirementSummarySchema = z.object({
  key: z.string(),
  label: z.string(),
  category: z.enum(['tool', 'mcp', 'skill', 'shared']),
  requirement_type: z.enum(['binary', 'env', 'module', 'service', 'file', 'stack']),
  summary: z.string(),
  install_hint: z.string(),
  required_by: z.array(z.string()).default([]),
  notes: z.array(z.string()).default([]),
  binaries: z.array(z.string()).default([]),
  env_vars: z.array(z.string()).default([]),
  modules: z.array(z.string()).default([]),
  files: z.array(z.string()).default([]),
  manual: z.boolean().default(false),
})

export const runtimeCheckSummarySchema = z.object({
  requirement: runtimeRequirementSummarySchema,
  status: z.enum(['ready', 'missing', 'manual']),
  detail: z.string(),
})

export const runtimeRequirementsResponseSchema = z.object({
  generated_at: z.string(),
  project_root: z.string(),
  ready_count: z.number().int(),
  missing_count: z.number().int(),
  manual_count: z.number().int(),
  checks: z.array(runtimeCheckSummarySchema).default([]),
})

export const runtimeToolDescriptorSchema = z.object({
  name: z.string(),
  group: z.string().default('default'),
  label: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  source: z.string().default('builtin'),
  persistence: z.enum(['memory', 'filesystem']).default('memory'),
  human_in_the_loop_only: z.boolean().default(false),
})

export const runtimeToolCatalogSchema = z.object({
  tools: z.array(runtimeToolDescriptorSchema).default([]),
})

export const workflowHostDescriptorSchema = z.object({
  name: z.string(),
  source: z.string().default('builtin'),
  persistence: z.enum(['memory', 'filesystem']).default('memory'),
  description: z.string().nullable().optional(),
})

export const workflowCatalogResponseSchema = z.object({
  workflows: z.array(workflowHostDescriptorSchema).default([]),
})

export type AgentMetrics = z.infer<typeof agentMetricsSchema>
export type AppMeta = z.infer<typeof appMetaSchema>
export type CachePolicy = z.infer<typeof cachePolicySchema>
export type ChatMessage = z.infer<typeof chatMessageSchema>
export type GuardrailRule = z.infer<typeof guardrailRuleSchema>
export type InterruptInfo = z.infer<typeof interruptInfoSchema>
export type InterruptResumeRequest = z.infer<typeof interruptResumeRequestSchema>
export type McpServerConfig = z.infer<typeof mcpServerConfigSchema>
export type MemoryConfig = z.infer<typeof memoryConfigSchema>
export type MessageResponse = z.infer<typeof messageResponseSchema>
export type ModelClientConfig = z.infer<typeof modelClientConfigSchema>
export type MultiAgentConfig = z.infer<typeof multiAgentConfigSchema>
export type PreviewArtifact = z.infer<typeof previewArtifactSchema>
export type PreviewTerminalInputRequest = z.infer<typeof previewTerminalInputRequestSchema>
export type PreviewTerminalResizeRequest = z.infer<typeof previewTerminalResizeRequestSchema>
export type PreviewTerminalState = z.infer<typeof previewTerminalStateSchema>
export type PreviewRunRequest = z.infer<typeof previewRunRequestSchema>
export type PreviewRunResponse = z.infer<typeof previewRunResponseSchema>
export type Provider = z.infer<typeof providerSchema>
export type ResponseFieldConfig = z.infer<typeof responseFieldConfigSchema>
export type ResponseFormatConfig = z.infer<typeof responseFormatConfigSchema>
export type RuntimeCheckSummary = z.infer<typeof runtimeCheckSummarySchema>
export type RuntimeRequirementsResponse = z.infer<typeof runtimeRequirementsResponseSchema>
export type RuntimeToolCatalog = z.infer<typeof runtimeToolCatalogSchema>
export type RuntimeToolDescriptor = z.infer<typeof runtimeToolDescriptorSchema>
export type SandboxConfig = z.infer<typeof sandboxConfigSchema>
export type SessionCreateRequest = z.infer<typeof sessionCreateRequestSchema>
export type SessionDetail = z.infer<typeof sessionDetailSchema>
export type SessionMessageDeleteRequest = z.infer<typeof sessionMessageDeleteRequestSchema>
export type SessionMessageDeleteResponse = z.infer<typeof sessionMessageDeleteResponseSchema>
export type SessionSummary = z.infer<typeof sessionSummarySchema>
export type SessionUpdateRequest = z.infer<typeof sessionUpdateRequestSchema>
export type ThinkingConfig = z.infer<typeof thinkingConfigSchema>
export type ToolGuardrailConfig = z.infer<typeof toolGuardrailConfigSchema>
export type TraceExportResult = z.infer<typeof traceExportResultSchema>
export type TracingStatus = z.infer<typeof tracingStatusSchema>
export type ToolMessageSummaryRequest = z.infer<typeof toolMessageSummaryRequestSchema>
export type ToolMessageSummaryResponse = z.infer<typeof toolMessageSummaryResponseSchema>
export type TurnMetrics = z.infer<typeof turnMetricsSchema>
export type WorkflowDefinitionSummary = z.infer<typeof workflowDefinitionSummarySchema>
export type WorkflowPlannerPlan = z.infer<typeof workflowPlannerPlanSchema>
export type WorkflowPlannerRequest = z.infer<typeof workflowPlannerRequestSchema>
export type WorkflowPlannerResponse = z.infer<typeof workflowPlannerResponseSchema>
export type WorkflowCatalogResponse = z.infer<typeof workflowCatalogResponseSchema>
export type WorkflowHostDescriptor = z.infer<typeof workflowHostDescriptorSchema>
export type WorkflowRunControlRequest = z.infer<typeof workflowRunControlRequestSchema>
export type WorkflowRunDetail = z.infer<typeof workflowRunDetailSchema>
export type WorkflowRunRequest = z.infer<typeof workflowRunRequestSchema>
export type WorkflowRunSummary = z.infer<typeof workflowRunSummarySchema>
export type WorkflowRuntimeConfig = z.infer<typeof workflowRuntimeConfigSchema>
