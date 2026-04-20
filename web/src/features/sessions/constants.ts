import {
  cachePolicySchema,
  guardrailRuleSchema,
  mcpServerConfigSchema,
  memoryConfigSchema,
  modelClientConfigSchema,
  multiAgentConfigSchema,
  providerSchema,
  responseFormatConfigSchema,
  sandboxConfigSchema,
  sessionCreateRequestSchema,
  sessionUpdateRequestSchema,
  toolGuardrailConfigSchema,
  type CachePolicy,
  type GuardrailRule,
  type McpServerConfig,
  type MemoryConfig,
  type ModelClientConfig,
  type Provider,
  type RuntimeToolCatalog,
  type RuntimeToolDescriptor,
  type ResponseFormatConfig,
  type SandboxConfig,
  type SessionCreateRequest,
  type SessionDetail,
  type SessionUpdateRequest,
  type ToolGuardrailConfig,
} from '../../shared/api/contracts'

export type ToolCategory = 'business' | 'system' | 'skill'

export type ToolOption = {
  name: string
  label: string
  description: string
  category: ToolCategory
  source?: string
  persistence?: 'memory' | 'filesystem'
  humanInTheLoopOnly?: boolean
}

export type SessionDraft = {
  title: string
  systemPrompt: string
  provider: Provider
  modelName: string
  modelClientMode: 'inherit' | 'override'
  modelClientBaseUrl: string
  modelClientApiKeyEnvVar: string
  pricingModel: string
  cachePolicy: CachePolicy
  maxSteps: string
  timeoutSeconds: string
  thinkingEnabled: boolean
  thinkingEffort: 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'
  thinkingVerbosity: 'low' | 'medium' | 'high'
  thinkingBudgetTokens: string
  enabledTools: string[]
  mcpServers: McpServerConfig[]
  multiAgentText: string
  sandbox: SandboxConfig
  humanInTheLoop: boolean
  approvalToolNames: string[]
  inputGuardrails: GuardrailRule[]
  outputGuardrails: GuardrailRule[]
  toolGuardrails: ToolGuardrailConfig[]
  responseFormat: ResponseFormatConfig
  memory: MemoryConfig
}

export const QUICK_PROVIDER_OPTIONS = ['openai', 'anthropic', 'gemini', 'openrouter'] as const
export const QUICK_MODEL_OPTIONS = ['gpt-5.4', 'gpt-4.1', 'gpt-4o', 'gpt-4o-mini'] as const
export const QUICK_MAX_STEPS_OPTIONS = ['128', '256', '512', '1024', '2048'] as const
export const QUICK_TIMEOUT_OPTIONS = ['120', '300', '600', '900'] as const

export const TOOL_OPTIONS: ToolOption[] = [
  {
    name: 'web_search',
    label: '网页搜索',
    description: '通过 Firecrawl 进行联网检索。',
    category: 'business',
  },
  {
    name: 'web_scrape',
    label: '网页抓取',
    description: '抓取网页正文并返回结构化结果。',
    category: 'business',
  },
  {
    name: 'web_interact',
    label: '网页交互',
    description: '执行网页点击、输入等交互动作。',
    category: 'business',
  },
  {
    name: 'office_cli',
    label: 'Office CLI',
    description: '读取和修改 Office 文档。',
    category: 'business',
  },
  {
    name: 'bash',
    label: 'bash',
    description: '执行 shell 命令，单次最多 600 秒。',
    category: 'system',
  },
  {
    name: 'read_file',
    label: 'read_file',
    description: '带行号读取文件内容。',
    category: 'system',
  },
  {
    name: 'write_file',
    label: 'write_file',
    description: '写文件并自动创建父目录。',
    category: 'system',
  },
  {
    name: 'edit_file',
    label: 'edit_file',
    description: '执行精确字符串替换。',
    category: 'system',
  },
  {
    name: 'glob_search',
    label: 'glob_search',
    description: '按 glob 模式查找文件。',
    category: 'system',
  },
  {
    name: 'grep_search',
    label: 'grep_search',
    description: '按正则内容搜索代码或文档。',
    category: 'system',
  },
  {
    name: 'to_do',
    label: 'to_do',
    description: '在长任务内维护会话级待办。',
    category: 'system',
  },
  {
    name: 'load_skill',
    label: 'load_skill',
    description: '按需加载本地 skill 指南。',
    category: 'skill',
  },
  {
    name: 'ask_user_question',
    label: 'ask_user_question',
    description: '在 HITL 模式下向用户发起问题并等待恢复。',
    category: 'system',
    humanInTheLoopOnly: true,
  },
]

export const HITL_ONLY_TOOL_NAMES = ['ask_user_question'] as const
export const DEFAULT_ENABLED_TOOLS = TOOL_OPTIONS.filter(
  (tool) => !HITL_ONLY_TOOL_NAMES.includes(tool.name as (typeof HITL_ONLY_TOOL_NAMES)[number]),
).map((tool) => tool.name)

function normalizeToolCategory(group?: string): ToolCategory {
  if (group === 'business' || group === 'system' || group === 'skill') {
    return group
  }
  return 'system'
}

export function toolOptionFromDescriptor(descriptor: RuntimeToolDescriptor): ToolOption {
  return {
    name: descriptor.name,
    label: descriptor.label ?? descriptor.name,
    description: descriptor.description ?? '',
    category: normalizeToolCategory(descriptor.group),
    source: descriptor.source,
    persistence: descriptor.persistence,
    humanInTheLoopOnly: descriptor.human_in_the_loop_only ?? false,
  }
}

export function buildToolOptionsFromCatalog(catalog?: RuntimeToolCatalog): ToolOption[] {
  if (!catalog?.tools?.length) {
    return TOOL_OPTIONS
  }
  return catalog.tools.map(toolOptionFromDescriptor)
}

export function getDefaultEnabledTools(toolOptions: ToolOption[] = TOOL_OPTIONS) {
  return toolOptions
    .filter(
      (tool) =>
        !(tool.humanInTheLoopOnly ?? false) &&
        !HITL_ONLY_TOOL_NAMES.includes(tool.name as (typeof HITL_ONLY_TOOL_NAMES)[number]),
    )
    .map((tool) => tool.name)
}

export function ensureHitlDraftSafety(draft: SessionDraft): SessionDraft {
  if (draft.humanInTheLoop) {
    return draft
  }

  return {
    ...draft,
    enabledTools: draft.enabledTools.filter((toolName) => !HITL_ONLY_TOOL_NAMES.includes(toolName as (typeof HITL_ONLY_TOOL_NAMES)[number])),
  }
}

export function applyHitlQuestionPreset(draft: SessionDraft): SessionDraft {
  return {
    ...draft,
    humanInTheLoop: true,
    enabledTools: ['ask_user_question'],
    approvalToolNames: [],
  }
}

export function applyHitlApprovalPreset(draft: SessionDraft): SessionDraft {
  return {
    ...draft,
    humanInTheLoop: true,
    enabledTools: ['bash'],
    approvalToolNames: ['bash'],
  }
}

export function createDefaultModelClient(): ModelClientConfig {
  return modelClientConfigSchema.parse({
    mode: 'inherit',
    base_url: null,
    api_key_env_var: null,
  })
}

export function createDefaultSandbox(provider: SandboxConfig['provider'] = 'local'): SandboxConfig {
  return sandboxConfigSchema.parse({
    provider,
    cwd: null,
    image: null,
    cloud_url: null,
    token_env_var: null,
    env: {},
    mount_project_root: true,
    mount_path: '/workspace',
    restrict_file_tools_to_workspace: true,
  })
}

export function createDefaultGuardrailRule(
  kind: GuardrailRule['kind'] = 'deny_regex',
): GuardrailRule {
  return guardrailRuleSchema.parse({
    kind,
    message: '',
    pattern: '',
    replacement: '',
    max_length: kind === 'max_length' ? 4096 : null,
    ignore_case: false,
    multiline: false,
    dotall: false,
  })
}

export function createDefaultToolGuardrail(): ToolGuardrailConfig {
  return {
    tool_name: '',
    input_rules: [],
    output_rules: [],
    path_fields: [],
    require_absolute_paths: false,
    allowed_roots: [],
  }
}

export function createDefaultResponseFormat(): ResponseFormatConfig {
  return responseFormatConfigSchema.parse({
    name: 'structured_response',
    description: '',
    fields: [],
  })
}

export function createDefaultMemory(): MemoryConfig {
  return memoryConfigSchema.parse({
    type: 'compact',
    compact_model_name: 'gpt-5.4 mini',
    safety_ratio: 0.5,
    token_threshold: 256000,
    max_tool_result_tokens: 50000,
    tool_result_truncation_suffix: '\n\n... [content truncated due to length]',
  })
}

export function createDefaultMcpServer(
  transport: McpServerConfig['transport'] = 'remote_http',
): McpServerConfig {
  return mcpServerConfigSchema.parse({
    name: '',
    transport,
    url: transport === 'remote_http' ? 'https://' : null,
    command: transport === 'local_stdio' ? '' : null,
    args: [],
    env: {},
    headers: {},
    prefix: '',
    allowlist: [],
    blocklist: [],
    method_aliases: {},
    image: null,
    port: 8080,
    sandbox_path: '/mcp',
    sandbox: null,
  })
}

export const DEFAULT_SESSION_DRAFT: SessionDraft = {
  title: '',
  systemPrompt: '你是一个可靠的中文助理。回答简洁、准确，必要时优先调用工具。',
  provider: providerSchema.parse('openai'),
  modelName: 'gpt-5.4',
  modelClientMode: 'inherit',
  modelClientBaseUrl: '',
  modelClientApiKeyEnvVar: '',
  pricingModel: '',
  cachePolicy: cachePolicySchema.parse('auto'),
  maxSteps: '1024',
  timeoutSeconds: '600',
  thinkingEnabled: true,
  thinkingEffort: 'medium',
  thinkingVerbosity: 'medium',
  thinkingBudgetTokens: '',
  enabledTools: [...DEFAULT_ENABLED_TOOLS],
  mcpServers: [],
  multiAgentText: JSON.stringify(
    {
      supervisor_name: 'assistant',
      specialists: [],
    },
    null,
    2,
  ),
  sandbox: createDefaultSandbox(),
  humanInTheLoop: false,
  approvalToolNames: [],
  inputGuardrails: [],
  outputGuardrails: [],
  toolGuardrails: [],
  responseFormat: createDefaultResponseFormat(),
  memory: createDefaultMemory(),
}

function parseJsonText<T>(label: string, rawText: string, parser: (value: unknown) => T) {
  try {
    const parsed = rawText.trim() ? JSON.parse(rawText) : null
    return parser(parsed)
  } catch (error) {
    const detail = error instanceof Error ? error.message : '未知错误'
    throw new Error(`${label} 配置格式不合法：${detail}`)
  }
}

function validateGuardrailRuleForSave(rule: GuardrailRule, label: string) {
  if (rule.kind === 'max_length') {
    if (!rule.max_length || rule.max_length < 1) {
      throw new Error(`${label} 缺少有效的 max_length`)
    }
    return
  }

  if (!(rule.pattern ?? '').trim()) {
    throw new Error(`${label} 缺少 pattern`)
  }
}

function validateToolGuardrailForSave(rule: ToolGuardrailConfig, label: string) {
  if (!rule.tool_name.trim()) {
    throw new Error(`${label} 缺少 tool_name`)
  }

  rule.input_rules.forEach((item, index) =>
    validateGuardrailRuleForSave(item, `${label}.input_rules[${index}]`),
  )
  rule.output_rules.forEach((item, index) =>
    validateGuardrailRuleForSave(item, `${label}.output_rules[${index}]`),
  )
}

function cloneGuardrailRule(rule: GuardrailRule): GuardrailRule {
  return guardrailRuleSchema.parse({
    kind: rule.kind,
    message: rule.message ?? '',
    pattern: rule.pattern ?? '',
    replacement: rule.replacement ?? '',
    max_length: rule.max_length ?? null,
    ignore_case: rule.ignore_case ?? false,
    multiline: rule.multiline ?? false,
    dotall: rule.dotall ?? false,
  })
}

function cloneToolGuardrail(rule: ToolGuardrailConfig): ToolGuardrailConfig {
  return toolGuardrailConfigSchema.parse({
    tool_name: rule.tool_name,
    input_rules: (rule.input_rules ?? []).map(cloneGuardrailRule),
    output_rules: (rule.output_rules ?? []).map(cloneGuardrailRule),
    path_fields: [...(rule.path_fields ?? [])],
    require_absolute_paths: rule.require_absolute_paths ?? false,
    allowed_roots: [...(rule.allowed_roots ?? [])],
  })
}

function cloneMcpServer(server: McpServerConfig): McpServerConfig {
  return mcpServerConfigSchema.parse({
    ...server,
    args: [...(server.args ?? [])],
    env: { ...(server.env ?? {}) },
    headers: { ...(server.headers ?? {}) },
    allowlist: [...(server.allowlist ?? [])],
    blocklist: [...(server.blocklist ?? [])],
    method_aliases: { ...(server.method_aliases ?? {}) },
    sandbox: server.sandbox ? cloneSandbox(server.sandbox) : null,
  })
}

function cloneSandbox(config: SandboxConfig): SandboxConfig {
  return sandboxConfigSchema.parse({
    provider: config.provider,
    cwd: config.cwd ?? null,
    image: config.image ?? null,
    cloud_url: config.cloud_url ?? null,
    token_env_var: config.token_env_var ?? null,
    env: { ...(config.env ?? {}) },
    mount_project_root: config.mount_project_root ?? true,
    mount_path: config.mount_path ?? '/workspace',
    restrict_file_tools_to_workspace: config.restrict_file_tools_to_workspace ?? true,
  })
}

function cloneResponseFormat(config: ResponseFormatConfig): ResponseFormatConfig {
  return responseFormatConfigSchema.parse({
    name: config.name,
    description: config.description ?? '',
    fields: (config.fields ?? []).map((field) => ({
      name: field.name,
      type: field.type,
      description: field.description ?? '',
      required: field.required ?? true,
    })),
  })
}

function cloneMemory(config: MemoryConfig): MemoryConfig {
  return memoryConfigSchema.parse({
    type: config.type,
    compact_model_name: config.compact_model_name ?? 'gpt-5.4 mini',
    safety_ratio: config.safety_ratio ?? 0.5,
    token_threshold: config.token_threshold ?? 256000,
    max_tool_result_tokens: config.max_tool_result_tokens ?? 50000,
    tool_result_truncation_suffix:
      config.tool_result_truncation_suffix ?? '\n\n... [content truncated due to length]',
  })
}

export function sessionDetailToDraft(detail: SessionDetail): SessionDraft {
  return {
    title: detail.title ?? '',
    systemPrompt: detail.system_prompt,
    provider: detail.provider,
    modelName: detail.model_name,
    modelClientMode: detail.model_client?.mode ?? 'inherit',
    modelClientBaseUrl: detail.model_client?.base_url ?? '',
    modelClientApiKeyEnvVar: detail.model_client?.api_key_env_var ?? '',
    pricingModel: detail.pricing_model ?? '',
    cachePolicy: detail.cache_policy,
    maxSteps: String(detail.max_steps),
    timeoutSeconds: detail.timeout_seconds == null ? '' : String(detail.timeout_seconds),
    thinkingEnabled: detail.thinking.enabled,
    thinkingEffort: detail.thinking.effort ?? 'medium',
    thinkingVerbosity: detail.thinking.verbosity ?? 'medium',
    thinkingBudgetTokens: detail.thinking.budget_tokens == null ? '' : String(detail.thinking.budget_tokens),
    enabledTools: detail.enabled_tools.length ? detail.enabled_tools : [...DEFAULT_ENABLED_TOOLS],
    mcpServers: (detail.mcp_servers ?? []).map(cloneMcpServer),
    multiAgentText: JSON.stringify(detail.multi_agent, null, 2),
    sandbox: cloneSandbox(detail.sandbox),
    humanInTheLoop: detail.human_in_the_loop ?? false,
    approvalToolNames: [...(detail.approval_tool_names ?? [])],
    inputGuardrails: (detail.input_guardrails ?? []).map(cloneGuardrailRule),
    outputGuardrails: (detail.output_guardrails ?? []).map(cloneGuardrailRule),
    toolGuardrails: (detail.tool_guardrails ?? []).map(cloneToolGuardrail),
    responseFormat: cloneResponseFormat(detail.response_format),
    memory: cloneMemory(detail.memory),
  }
}

export function buildSessionCreatePayload(draft: SessionDraft): SessionCreateRequest {
  const safeDraft = ensureHitlDraftSafety(draft)
  const multiAgent = parseJsonText('多代理', safeDraft.multiAgentText, (value) =>
    multiAgentConfigSchema.parse(value ?? { supervisor_name: 'assistant', specialists: [] }),
  )

  return sessionCreateRequestSchema.parse({
    title: safeDraft.title.trim() || null,
    system_prompt: safeDraft.systemPrompt.trim(),
    provider: safeDraft.provider,
    model_name: safeDraft.modelName.trim(),
    model_client: modelClientConfigSchema.parse({
      mode: safeDraft.modelClientMode,
      base_url: safeDraft.modelClientBaseUrl.trim() || null,
      api_key_env_var: safeDraft.modelClientApiKeyEnvVar.trim() || null,
    }),
    pricing_model: safeDraft.pricingModel.trim() || null,
    cache_policy: safeDraft.cachePolicy,
    max_steps: Number(safeDraft.maxSteps),
    timeout_seconds: safeDraft.timeoutSeconds.trim() ? Number(safeDraft.timeoutSeconds) : null,
    thinking: {
      enabled: safeDraft.thinkingEnabled,
      effort: safeDraft.thinkingEnabled ? safeDraft.thinkingEffort : null,
      verbosity: safeDraft.thinkingEnabled ? safeDraft.thinkingVerbosity : null,
      budget_tokens: safeDraft.thinkingBudgetTokens.trim()
        ? Number(safeDraft.thinkingBudgetTokens)
        : null,
    },
    enabled_tools: safeDraft.enabledTools,
    mcp_servers: safeDraft.mcpServers.map((server) => mcpServerConfigSchema.parse(server)),
    multi_agent: multiAgent,
    sandbox: sandboxConfigSchema.parse(safeDraft.sandbox),
    human_in_the_loop: safeDraft.humanInTheLoop,
    approval_tool_names: [...safeDraft.approvalToolNames],
    input_guardrails: safeDraft.inputGuardrails.map((rule, index) => {
      validateGuardrailRuleForSave(rule, `input_guardrails[${index}]`)
      return guardrailRuleSchema.parse(rule)
    }),
    output_guardrails: safeDraft.outputGuardrails.map((rule, index) => {
      validateGuardrailRuleForSave(rule, `output_guardrails[${index}]`)
      return guardrailRuleSchema.parse(rule)
    }),
    tool_guardrails: safeDraft.toolGuardrails.map((rule, index) => {
      validateToolGuardrailForSave(rule, `tool_guardrails[${index}]`)
      return toolGuardrailConfigSchema.parse(rule)
    }),
    response_format: responseFormatConfigSchema.parse(safeDraft.responseFormat),
    memory: memoryConfigSchema.parse(safeDraft.memory),
  })
}

export function buildSessionUpdatePayload(draft: SessionDraft): SessionUpdateRequest {
  const safeDraft = ensureHitlDraftSafety(draft)
  const multiAgent = parseJsonText('多代理', safeDraft.multiAgentText, (value) =>
    multiAgentConfigSchema.parse(value ?? { supervisor_name: 'assistant', specialists: [] }),
  )

  return sessionUpdateRequestSchema.parse({
    title: safeDraft.title.trim() || null,
    system_prompt: safeDraft.systemPrompt.trim(),
    provider: safeDraft.provider,
    model_name: safeDraft.modelName.trim(),
    model_client: modelClientConfigSchema.parse({
      mode: safeDraft.modelClientMode,
      base_url: safeDraft.modelClientBaseUrl.trim() || null,
      api_key_env_var: safeDraft.modelClientApiKeyEnvVar.trim() || null,
    }),
    pricing_model: safeDraft.pricingModel.trim() || null,
    cache_policy: safeDraft.cachePolicy,
    max_steps: Number(safeDraft.maxSteps),
    timeout_seconds: safeDraft.timeoutSeconds.trim() ? Number(safeDraft.timeoutSeconds) : null,
    thinking: {
      enabled: safeDraft.thinkingEnabled,
      effort: safeDraft.thinkingEnabled ? safeDraft.thinkingEffort : null,
      verbosity: safeDraft.thinkingEnabled ? safeDraft.thinkingVerbosity : null,
      budget_tokens: safeDraft.thinkingBudgetTokens.trim()
        ? Number(safeDraft.thinkingBudgetTokens)
        : null,
    },
    enabled_tools: safeDraft.enabledTools,
    mcp_servers: safeDraft.mcpServers.map((server) => mcpServerConfigSchema.parse(server)),
    multi_agent: multiAgent,
    sandbox: sandboxConfigSchema.parse(safeDraft.sandbox),
    human_in_the_loop: safeDraft.humanInTheLoop,
    approval_tool_names: [...safeDraft.approvalToolNames],
    input_guardrails: safeDraft.inputGuardrails.map((rule, index) => {
      validateGuardrailRuleForSave(rule, `input_guardrails[${index}]`)
      return guardrailRuleSchema.parse(rule)
    }),
    output_guardrails: safeDraft.outputGuardrails.map((rule, index) => {
      validateGuardrailRuleForSave(rule, `output_guardrails[${index}]`)
      return guardrailRuleSchema.parse(rule)
    }),
    tool_guardrails: safeDraft.toolGuardrails.map((rule, index) => {
      validateToolGuardrailForSave(rule, `tool_guardrails[${index}]`)
      return toolGuardrailConfigSchema.parse(rule)
    }),
    response_format: responseFormatConfigSchema.parse(safeDraft.responseFormat),
    memory: memoryConfigSchema.parse(safeDraft.memory),
  })
}
