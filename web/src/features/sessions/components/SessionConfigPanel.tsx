import {
  Bot,
  Brain,
  Database,
  GitBranch,
  RotateCcw,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Wrench,
} from 'lucide-react'

import type { SessionDetail } from '../../../shared/api/contracts'
import { useI18n } from '../../../shared/i18n/I18nContext'
import {
  HITL_ONLY_TOOL_NAMES,
  TOOL_OPTIONS,
  type SessionDraft,
  type ToolCategory,
  type ToolOption,
} from '../constants'
import {
  GuardrailListEditor,
  McpServerListEditor,
  MemoryEditor,
  ResponseFormatEditor,
  SandboxEditor,
  StringListEditor,
  ToolGuardrailListEditor,
} from './SessionConfigEditors'

type SessionConfigPanelProps = {
  capabilities?: {
    supportsInterrupts: boolean
    supportsStructuredResponseFormat: boolean
  }
  availableToolOptions?: ToolOption[]
  config: SessionDraft
  onConfigChange: (patch: Partial<SessionDraft>) => void
  onToggleTool: (toolName: string) => void
  onCreateSession: () => void
  onApplyHitlQuestionPreset?: () => void
  onApplyHitlApprovalPreset?: () => void
  onSaveCurrentSession: () => void
  onResetConfig: () => void
  currentSession?: SessionDetail
  configError?: string
  isCreating: boolean
  isReadOnly?: boolean
  isSaving: boolean
  isStreaming: boolean
}

const PROVIDER_LABELS: Record<SessionDraft['provider'], string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Gemini',
  openrouter: 'OpenRouter',
}

function groupToolsByCategory(toolOptions: typeof TOOL_OPTIONS) {
  return toolOptions.reduce<Record<ToolCategory, typeof TOOL_OPTIONS>>(
    (accumulator, tool) => {
      accumulator[tool.category].push(tool)
      return accumulator
    },
    {
      business: [],
      system: [],
      skill: [],
    },
  )
}

export function SessionConfigPanel({
  availableToolOptions,
  capabilities,
  config,
  onConfigChange,
  onToggleTool,
  onCreateSession,
  onApplyHitlQuestionPreset,
  onApplyHitlApprovalPreset,
  onSaveCurrentSession,
  onResetConfig,
  currentSession,
  configError,
  isCreating,
  isReadOnly = false,
  isSaving,
  isStreaming,
}: SessionConfigPanelProps) {
  const { text } = useI18n()
  const toolCategoryLabels: Record<ToolCategory, string> = {
    business: text('业务能力', 'Business tools'),
    system: text('系统工具', 'System tools'),
    skill: text('Skill 能力', 'Skill tools'),
  }
  const cachePolicyLabels: Record<SessionDraft['cachePolicy'], string> = {
    none: text('关闭', 'Off'),
    static: text('静态', 'Static'),
    auto: text('自动', 'Auto'),
    auto_1h: text('自动 1 小时', 'Auto 1 hour'),
  }
  const thinkingEffortLabels: Record<SessionDraft['thinkingEffort'], string> = {
    minimal: text('极低', 'Minimal'),
    low: text('低', 'Low'),
    medium: text('中', 'Medium'),
    high: text('高', 'High'),
    xhigh: text('极高', 'Very high'),
  }
  const thinkingVerbosityLabels: Record<SessionDraft['thinkingVerbosity'], string> = {
    low: text('简洁', 'Concise'),
    medium: text('标准', 'Standard'),
    high: text('详细', 'Detailed'),
  }
  const isSessionMode = Boolean(currentSession)
  const formLocked = isStreaming || isSaving || (isSessionMode && isReadOnly)
  const baseToolOptions = availableToolOptions?.length ? availableToolOptions : TOOL_OPTIONS
  const visibleTools = capabilities?.supportsInterrupts
    ? baseToolOptions
    : baseToolOptions.filter((tool) => !HITL_ONLY_TOOL_NAMES.includes(tool.name as (typeof HITL_ONLY_TOOL_NAMES)[number]))
  const groupedTools = groupToolsByCategory(visibleTools)
  const submitLabel = isSessionMode
    ? isSaving
      ? text('保存中...', 'Saving...')
      : text('保存配置', 'Save session')
    : isCreating
      ? text('创建中...', 'Creating...')
      : text('创建会话', 'Create session')

  return (
    <div className="inspector-page">
      <section className="inspector-section">
        <div className="inspector-section-head inspector-section-head-compact">
          <div className="inspector-title-inline">
            <div className="inspector-title-group">
              <h3 className="inspector-section-title">{text('标题与系统提示词', 'Title & system prompt')}</h3>
            </div>
          </div>
          <div className="inspector-toolbar">
            <button
              className="inspector-action-secondary"
              disabled={formLocked}
              title={isSessionMode ? text('恢复已生效配置', 'Restore applied config') : text('重置为默认配置', 'Reset to defaults')}
              type="button"
              onClick={onResetConfig}
            >
              <RotateCcw size={14} />
              <span>{text('重置', 'Reset')}</span>
            </button>
            <button
              className="inspector-action-primary"
              data-testid={isSessionMode ? 'session-save-button' : 'session-create-button'}
              disabled={formLocked || isCreating}
              type="button"
              onClick={isSessionMode ? onSaveCurrentSession : onCreateSession}
            >
              {submitLabel}
            </button>
          </div>
        </div>

        {configError ? <div className="inspector-alert inspector-alert-error">{configError}</div> : null}
        {isSessionMode && isReadOnly ? <div className="inspector-alert inspector-alert-muted">{text('当前会话配置只读。', 'This session config is read-only.')}</div> : null}

        <div className="inspector-form-stack">
          <label className="inspector-field">
            <span className="inspector-field-label">{text('会话标题', 'Session title')}</span>
            <input
              className="inspector-input"
              data-testid="session-title-input"
              disabled={formLocked}
              placeholder={text('例如：代码审查 / 需求梳理', 'For example: code review / planning')}
              value={config.title}
              onChange={(event) => onConfigChange({ title: event.target.value })}
            />
          </label>

          <label className="inspector-field">
            <span className="inspector-field-label">{text('系统提示词', 'System prompt')}</span>
            <textarea
              className="inspector-textarea inspector-textarea-prompt"
              data-testid="session-system-prompt-input"
              disabled={formLocked}
              value={config.systemPrompt}
              onChange={(event) => onConfigChange({ systemPrompt: event.target.value })}
            />
          </label>
        </div>
      </section>

      <section className="inspector-section">
        <div className="inspector-section-head inspector-section-head-compact">
          <div className="inspector-title-inline">
            <span className="inspector-section-icon">
              <SlidersHorizontal size={14} />
            </span>
            <div className="inspector-title-group">
              <h3 className="inspector-section-title">{text('模型与运行策略', 'Model & runtime')}</h3>
            </div>
          </div>
        </div>

        <div className="inspector-form-stack">
          <div className="inspector-grid-2">
            <label className="inspector-field">
              <span className="inspector-field-label">{text('服务商', 'Provider')}</span>
              <select
                className="inspector-select"
                disabled={formLocked}
                value={config.provider}
                onChange={(event) =>
                  onConfigChange({ provider: event.target.value as SessionDraft['provider'] })
                }
              >
                {Object.entries(PROVIDER_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="inspector-field">
              <span className="inspector-field-label">{text('缓存策略', 'Cache policy')}</span>
              <select
                className="inspector-select"
                disabled={formLocked}
                value={config.cachePolicy}
                onChange={(event) =>
                  onConfigChange({ cachePolicy: event.target.value as SessionDraft['cachePolicy'] })
                }
              >
                {Object.entries(cachePolicyLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="inspector-field">
              <span className="inspector-field-label">{text('模型', 'Model')}</span>
              <input
                className="inspector-input inspector-input-mono"
                data-testid="session-model-input"
                disabled={formLocked}
                value={config.modelName}
                onChange={(event) => onConfigChange({ modelName: event.target.value })}
              />
            </label>

            <label className="inspector-field">
              <span className="inspector-field-label">{text('模型连接模式', 'Model client mode')}</span>
              <select
                className="inspector-select"
                disabled={formLocked}
                value={config.modelClientMode}
                onChange={(event) =>
                  onConfigChange({ modelClientMode: event.target.value as SessionDraft['modelClientMode'] })
                }
              >
                <option value="inherit">{text('继承全局环境变量', 'Inherit global env')}</option>
                <option value="override">{text('会话级覆盖', 'Session override')}</option>
              </select>
            </label>

            <label className="inspector-field">
              <span className="inspector-field-label">{text('计价模型', 'Pricing model')}</span>
              <input
                className="inspector-input inspector-input-mono"
                disabled={formLocked}
                placeholder={text('可留空', 'Optional')}
                value={config.pricingModel}
                onChange={(event) => onConfigChange({ pricingModel: event.target.value })}
              />
            </label>

            <label className="inspector-field">
              <span className="inspector-field-label">{text('最大步骤', 'Max steps')}</span>
              <input
                className="inspector-input"
                disabled={formLocked}
                value={config.maxSteps}
                onChange={(event) => onConfigChange({ maxSteps: event.target.value })}
              />
            </label>

            <label className="inspector-field">
              <span className="inspector-field-label">{text('超时秒数', 'Timeout seconds')}</span>
              <input
                className="inspector-input"
                disabled={formLocked}
                value={config.timeoutSeconds}
                onChange={(event) => onConfigChange({ timeoutSeconds: event.target.value })}
              />
            </label>
          </div>

          <div className="inspector-grid-2">
            <label className="inspector-field">
              <span className="inspector-field-label">{text('自定义 Base URL', 'Custom Base URL')}</span>
              <input
                className="inspector-input inspector-input-mono"
                disabled={formLocked || config.modelClientMode !== 'override'}
                placeholder={text('例如 https://api.openai.com/v1', 'For example https://api.openai.com/v1')}
                value={config.modelClientBaseUrl}
                onChange={(event) => onConfigChange({ modelClientBaseUrl: event.target.value })}
              />
            </label>

            <label className="inspector-field">
              <span className="inspector-field-label">{text('API Key 环境变量', 'API key env var')}</span>
              <input
                className="inspector-input inspector-input-mono"
                disabled={formLocked || config.modelClientMode !== 'override'}
                placeholder={text('例如 OPENAI_API_KEY', 'For example OPENAI_API_KEY')}
                value={config.modelClientApiKeyEnvVar}
                onChange={(event) => onConfigChange({ modelClientApiKeyEnvVar: event.target.value })}
              />
            </label>
          </div>

          <div className="inspector-grid-2">
            <label className="inspector-field">
              <span className="inspector-field-label">{text('思考强度', 'Reasoning effort')}</span>
              <select
                className="inspector-select"
                disabled={formLocked || !config.thinkingEnabled}
                value={config.thinkingEffort}
                onChange={(event) =>
                  onConfigChange({
                    thinkingEffort: event.target.value as SessionDraft['thinkingEffort'],
                  })
                }
              >
                {Object.entries(thinkingEffortLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="inspector-field">
              <span className="inspector-field-label">{text('思考详略', 'Reasoning verbosity')}</span>
              <select
                className="inspector-select"
                disabled={formLocked || !config.thinkingEnabled}
                value={config.thinkingVerbosity}
                onChange={(event) =>
                  onConfigChange({
                    thinkingVerbosity: event.target.value as SessionDraft['thinkingVerbosity'],
                  })
                }
              >
                {Object.entries(thinkingVerbosityLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="inspector-toggle-row">
            <label className="inspector-toggle-leading">
              <input
                checked={config.thinkingEnabled}
                className="tool-row-checkbox"
                disabled={formLocked}
                type="checkbox"
                onChange={(event) => onConfigChange({ thinkingEnabled: event.target.checked })}
              />
              <div className="tool-row-copy">
                <span className="tool-row-title">{text('启用 thinking', 'Enable thinking')}</span>
              </div>
            </label>

            <input
              className="inspector-inline-input inspector-input inspector-input-mono"
              disabled={formLocked || !config.thinkingEnabled}
              placeholder={text('思考预算 tokens', 'Thinking budget tokens')}
              value={config.thinkingBudgetTokens}
              onChange={(event) => onConfigChange({ thinkingBudgetTokens: event.target.value })}
            />
          </div>

          {capabilities?.supportsInterrupts ? (
            <>
              <div className="inspector-alert inspector-alert-info">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold" style={{ color: 'var(--app-text-soft)' }}>
                    {text('HITL 预设', 'HITL presets')}
                  </span>
                  <button
                    className="inspector-action-secondary !h-8 !rounded-lg !px-2.5"
                    data-testid="hitl-question-preset-button"
                    disabled={formLocked}
                    type="button"
                    onClick={onApplyHitlQuestionPreset}
                  >
                    {text('问答 HITL', 'Question HITL')}
                  </button>
                  <button
                    className="inspector-action-secondary !h-8 !rounded-lg !px-2.5"
                    data-testid="hitl-approval-preset-button"
                    disabled={formLocked}
                    type="button"
                    onClick={onApplyHitlApprovalPreset}
                  >
                    {text('审批 HITL', 'Approval HITL')}
                  </button>
                </div>
              </div>

              <label className="session-toggle-item">
                <input
                  checked={config.humanInTheLoop}
                  data-testid="human-in-the-loop-toggle"
                  disabled={formLocked}
                  type="checkbox"
                  onChange={(event) => onConfigChange({ humanInTheLoop: event.target.checked })}
                />
                <span>{text('启用人工介入', 'Enable human-in-the-loop')}</span>
              </label>

              <StringListEditor
                disabled={formLocked}
                inputTestId="approval-tool-names-input"
                addButtonTestId="approval-tool-names-add-button"
                label={text('审批工具', 'Approval tools')}
                values={config.approvalToolNames}
                onChange={(nextValues) => onConfigChange({ approvalToolNames: nextValues })}
                placeholder={text('例如 bash', 'For example bash')}
              />
            </>
          ) : null}
        </div>
      </section>

      <section className="inspector-section">
        <div className="inspector-section-head inspector-section-head-compact">
          <div className="inspector-title-inline">
            <span className="inspector-section-icon">
              <Wrench size={14} />
            </span>
            <div className="inspector-title-group">
              <h3 className="inspector-section-title">{text('工具能力', 'Tool capabilities')}</h3>
            </div>
          </div>
          <span className="inspector-chip">{config.enabledTools.filter((tool) => visibleTools.some((item) => item.name === tool)).length}/{visibleTools.length}</span>
        </div>

        <div className="tool-section-list">
          {(Object.entries(groupedTools) as [ToolCategory, typeof TOOL_OPTIONS][]).map(([category, items]) => (
            <div className="tool-section-card" key={category}>
              <div className="tool-section-head">
                <span className="inspector-chip inspector-chip-muted">{toolCategoryLabels[category]}</span>
                <span className="tool-section-count">
                  {items.filter((item) => config.enabledTools.includes(item.name)).length}/{items.length}
                </span>
              </div>

              <div className="tool-row-list">
                  {items.map((tool) => {
                    const checked = config.enabledTools.includes(tool.name)
                    return (
                      <label className={checked ? 'tool-row tool-row-active' : 'tool-row'} key={tool.name}>
                        <input
                          checked={checked}
                          className="tool-row-checkbox"
                          data-testid={`tool-toggle-${tool.name}`}
                          disabled={formLocked}
                          type="checkbox"
                          onChange={() => onToggleTool(tool.name)}
                      />
                      <div className="tool-row-copy">
                        <span className="tool-row-title">{tool.label}</span>
                        <span className="tool-row-description">{tool.description}</span>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="inspector-section">
        <div className="inspector-section-head inspector-section-head-compact">
          <div className="inspector-title-inline">
            <span className="inspector-section-icon">
              <Bot size={14} />
            </span>
            <div className="inspector-title-group">
              <h3 className="inspector-section-title">MCP</h3>
            </div>
          </div>
        </div>

        <McpServerListEditor
          disabled={formLocked}
          servers={config.mcpServers}
          onChange={(nextValue) => onConfigChange({ mcpServers: nextValue })}
        />
      </section>

      <section className="inspector-section">
        <div className="inspector-section-head inspector-section-head-compact">
          <div className="inspector-title-inline">
            <span className="inspector-section-icon">
              <Bot size={14} />
            </span>
            <div className="inspector-title-group">
              <h3 className="inspector-section-title">{text('多代理', 'Multi-agent')}</h3>
            </div>
          </div>
        </div>

        <label className="inspector-field">
          <span className="inspector-field-label">{text('多代理配置（JSON）', 'Multi-agent config (JSON)')}</span>
          <textarea
            className="inspector-textarea inspector-textarea-code inspector-textarea-code-tall"
            disabled={formLocked}
            value={config.multiAgentText}
            onChange={(event) => onConfigChange({ multiAgentText: event.target.value })}
          />
        </label>
      </section>

      <section className="inspector-section">
        <div className="inspector-section-head inspector-section-head-compact">
          <div className="inspector-title-inline">
            <span className="inspector-section-icon">
              <Shield size={14} />
            </span>
            <div className="inspector-title-group">
              <h3 className="inspector-section-title">{text('护栏规则', 'Guardrails')}</h3>
            </div>
          </div>
        </div>

        <div className="inspector-form-stack">
          <GuardrailListEditor
            disabled={formLocked}
            label={text('输入规则', 'Input rules')}
            rules={config.inputGuardrails}
            onChange={(nextValue) => onConfigChange({ inputGuardrails: nextValue })}
          />

          <GuardrailListEditor
            disabled={formLocked}
            label={text('输出规则', 'Output rules')}
            rules={config.outputGuardrails}
            onChange={(nextValue) => onConfigChange({ outputGuardrails: nextValue })}
          />

          <ToolGuardrailListEditor
            disabled={formLocked}
            rules={config.toolGuardrails}
            onChange={(nextValue) => onConfigChange({ toolGuardrails: nextValue })}
          />
        </div>
      </section>

      {capabilities?.supportsStructuredResponseFormat ? (
        <section className="inspector-section">
          <div className="inspector-section-head inspector-section-head-compact">
            <div className="inspector-title-inline">
              <span className="inspector-section-icon">
                <Sparkles size={14} />
              </span>
              <div className="inspector-title-group">
                <h3 className="inspector-section-title">{text('结构化输出', 'Structured output')}</h3>
              </div>
            </div>
          </div>

          <ResponseFormatEditor
            disabled={formLocked}
            hidden={false}
            value={config.responseFormat}
            onChange={(nextValue) => onConfigChange({ responseFormat: nextValue })}
          />
        </section>
      ) : null}

      <section className="inspector-section">
        <div className="inspector-section-head inspector-section-head-compact">
          <div className="inspector-title-inline">
            <span className="inspector-section-icon">
              <Database size={14} />
            </span>
            <div className="inspector-title-group">
              <h3 className="inspector-section-title">{text('记忆', 'Memory')}</h3>
            </div>
          </div>
        </div>

        <MemoryEditor
          disabled={formLocked}
          value={config.memory}
          onChange={(nextValue) => onConfigChange({ memory: nextValue })}
        />
      </section>

      <section className="inspector-section">
        <div className="inspector-section-head inspector-section-head-compact">
          <div className="inspector-title-inline">
            <span className="inspector-section-icon">
              <Brain size={14} />
            </span>
            <div className="inspector-title-group">
              <h3 className="inspector-section-title">{text('沙盒', 'Sandbox')}</h3>
            </div>
          </div>
        </div>

        <SandboxEditor
          disabled={formLocked}
          value={config.sandbox}
          onChange={(nextValue) => onConfigChange({ sandbox: nextValue })}
        />
      </section>

      {currentSession?.project_root ? (
        <section className="inspector-section">
          <div className="inspector-section-head inspector-section-head-compact">
            <div className="inspector-title-inline">
              <span className="inspector-section-icon">
                <GitBranch size={14} />
              </span>
              <div className="inspector-title-group">
                <h3 className="inspector-section-title">{text('当前绑定目录', 'Bound project root')}</h3>
              </div>
            </div>
          </div>
          <div className="inspector-path-block">{currentSession.project_root}</div>
        </section>
      ) : null}
    </div>
  )
}
