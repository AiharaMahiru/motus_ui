import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  FileJson,
  ListChecks,
  Play,
  Send,
  Sparkles,
  Wand2,
} from 'lucide-react'

import type {
  WorkflowDefinitionSummary,
  WorkflowPlannerResponse,
  WorkflowRunDetail,
  WorkflowRunSummary,
} from '../../../shared/api/contracts'
import { useI18n } from '../../../shared/i18n/I18nContext'
import { formatIsoDateTime, prettyJson } from '../../../shared/lib/format'
import { buildStarterInputFromSchema, extractWorkflowFields } from '../schemaDraft'
import type { WorkflowRuntimeDraft } from '../types'

type WorkflowWorkspaceProps = {
  runtimeConfig: WorkflowRuntimeDraft
  definitions: WorkflowDefinitionSummary[]
  selectedDefinitionName: string
  goalText: string
  inputText: string
  latestPlan?: WorkflowPlannerResponse
  onGoalChange: (value: string) => void
  onInputChange: (value: string) => void
  onRuntimeConfigChange: (patch: Partial<WorkflowRuntimeDraft>) => void
  onUseStarterInput: () => void
  onFormatInput: () => void
  onPlanGoal: () => void
  onPlanAndRun: () => void
  onStartRun: () => void
  onCancelRun: () => void
  onTerminateRun: () => void
  onSelectRun: (runId: string) => void
  isStarting: boolean
  isPlanning: boolean
  isAgentRunning: boolean
  isCancelling: boolean
  isTerminating: boolean
  runs: WorkflowRunSummary[]
  selectedRun?: WorkflowRunDetail
  errorMessage?: string
}


function resolveRunKicker(
  status: WorkflowRunDetail['status'] | undefined,
  text: (zh: string, en: string) => string,
) {
  if (status === 'completed') {
    return {
      icon: CheckCircle2,
      label: text('已完成', 'Completed'),
      className: 'text-emerald-600',
    }
  }
  if (status === 'error') {
    return {
      icon: AlertTriangle,
      label: text('执行失败', 'Failed'),
      className: 'text-red-600',
    }
  }
  if (status === 'cancelled') {
    return {
      icon: AlertTriangle,
      label: text('已取消', 'Cancelled'),
      className: 'text-amber-600',
    }
  }
  if (status === 'terminated') {
    return {
      icon: AlertTriangle,
      label: text('已终止', 'Terminated'),
      className: 'text-rose-600',
    }
  }
  return {
    icon: Play,
    label:
      status === 'running'
        ? text('运行中', 'Running')
        : status === 'queued'
          ? text('排队中', 'Queued')
          : text('准备执行', 'Ready'),
    className: status === 'running' ? 'text-blue-600' : 'text-slate-600',
  }
}


function WorkflowRunResult({
  selectedRun,
  onCancelRun,
  onTerminateRun,
  isCancelling,
  isTerminating,
}: {
  selectedRun?: WorkflowRunDetail
  onCancelRun: () => void
  onTerminateRun: () => void
  isCancelling: boolean
  isTerminating: boolean
}) {
  const { text } = useI18n()
  const runKicker = resolveRunKicker(selectedRun?.status, text)
  const RunKickerIcon = runKicker.icon
  const outputKeys = selectedRun?.output_payload ? Object.keys(selectedRun.output_payload) : []
  const canControlRun = selectedRun?.status === 'running' || selectedRun?.status === 'queued'

  return (
    <section className="workflow-result-shell">
      <div className="workflow-card-header">
        <div>
          <span className="sidebar-kicker">{text('运行结果', 'Run result')}</span>
          <h3 className="workflow-section-title">
            {selectedRun ? selectedRun.workflow_name : text('等待一次自动编排运行', 'Waiting for an orchestrated run')}
          </h3>
        </div>

        {selectedRun ? (
          <div className={`inline-flex items-center gap-2 text-sm font-black ${runKicker.className}`}>
            <RunKickerIcon size={16} />
            <span>{runKicker.label}</span>
          </div>
        ) : null}
      </div>

      {selectedRun ? (
        <div className="workflow-result-grid">
          <article className="workflow-card">
            <div className="workflow-card-header">
              <div>
                <span className="sidebar-kicker">{text('状态概览', 'Status overview')}</span>
                <h4 className="workflow-subtitle">{selectedRun.run_id}</h4>
              </div>
              <span className={`status-badge status-${selectedRun.status}`}>{selectedRun.status}</span>
            </div>

            <div className="workflow-chip-row">
              <span className="workflow-chip">{selectedRun.workflow_name}</span>
              <span className="workflow-chip">{selectedRun.launch_mode === 'agent' ? text('agent 编排', 'Agent orchestration') : text('手动', 'Manual')}</span>
              <span className="workflow-chip">{outputKeys.length} {text('输出键', 'output keys')}</span>
              <span className="workflow-chip">{text('尝试', 'Attempts')} {selectedRun.attempt_count} {text('次', 'times')}</span>
            </div>

            <div className="workflow-meta-list">
              <div>
                <span>{text('创建时间', 'Created')}</span>
                <strong>{formatIsoDateTime(selectedRun.created_at)}</strong>
              </div>
              <div>
                <span>{text('更新时间', 'Updated')}</span>
                <strong>{formatIsoDateTime(selectedRun.updated_at)}</strong>
              </div>
              <div>
                <span>{text('超时', 'Timeout')}</span>
                <strong>
                  {selectedRun.runtime.timeout_seconds == null ? text('未设置', 'Unset') : `${selectedRun.runtime.timeout_seconds}s`}
                </strong>
              </div>
              <div>
                <span>{text('重试策略', 'Retry policy')}</span>
                <strong>
                  {selectedRun.runtime.max_retries} {text('次', 'times')} / {text('间隔', 'interval')} {selectedRun.runtime.retry_delay_seconds}s
                </strong>
              </div>
            </div>

            {canControlRun ? (
              <div className="toolbar-inline mt-4">
                <button
                  className="ghost-button !h-9 !rounded-xl !px-4"
                  disabled={isCancelling || isTerminating}
                  type="button"
                  onClick={onCancelRun}
                >
                  <span>{isCancelling ? text('取消中...', 'Cancelling...') : text('取消运行', 'Cancel run')}</span>
                </button>
                <button
                  className="ghost-button !h-9 !rounded-xl !px-4 !text-rose-600"
                  disabled={isCancelling || isTerminating}
                  type="button"
                  onClick={onTerminateRun}
                >
                  <span>{isTerminating ? text('终止中...', 'Terminating...') : text('强制终止', 'Terminate')}</span>
                </button>
              </div>
            ) : null}

            {selectedRun.user_goal || selectedRun.planner_reason ? (
              <div className="workflow-field-list mt-4">
                {selectedRun.user_goal ? (
                  <div className="workflow-field-item !p-3">
                    <div className="workflow-field-head">
                      <strong>{text('原始目标', 'Original goal')}</strong>
                      <span className="workflow-chip workflow-chip-muted">agent</span>
                    </div>
                    <p>{selectedRun.user_goal}</p>
                  </div>
                ) : null}
                {selectedRun.planner_reason ? (
                  <div className="workflow-field-item !p-3">
                    <div className="workflow-field-head">
                      <strong>{text('编排理由', 'Planner reason')}</strong>
                      <span className="workflow-chip workflow-chip-muted">
                        {selectedRun.planner_confidence ?? 'unknown'}
                      </span>
                    </div>
                    <p>{selectedRun.planner_reason}</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {selectedRun.error ? <div className="panel-error !m-0 !mt-4">{selectedRun.error}</div> : null}
          </article>

          <article className="workflow-card">
            <div className="workflow-card-header">
              <div>
                <span className="sidebar-kicker">{text('输出摘要', 'Output summary')}</span>
                <h4 className="workflow-subtitle">{text('关键结果', 'Key results')}</h4>
              </div>
            </div>

            {outputKeys.length ? (
              <div className="workflow-field-list">
                {outputKeys.map((key) => (
                  <div className="workflow-field-item" key={key}>
                    <div className="workflow-field-head">
                      <strong>{key}</strong>
                      <span className="workflow-chip workflow-chip-muted">
                        {Array.isArray(selectedRun.output_payload?.[key]) ? 'array' : typeof selectedRun.output_payload?.[key]}
                      </span>
                    </div>
                    <p className="break-all">
                      {typeof selectedRun.output_payload?.[key] === 'string'
                        ? String(selectedRun.output_payload?.[key]).slice(0, 180)
                        : prettyJson(selectedRun.output_payload?.[key]).slice(0, 180)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state compact-empty-state !border-none !bg-transparent !min-h-[100px]">
                <p className="text-[12px] text-zinc-500">
                  {selectedRun.status === 'running'
                    ? text('工作流仍在运行，等待输出...', 'Workflow still running, waiting for output...')
                    : text('当前没有输出内容。', 'No output yet.')}
                </p>
              </div>
            )}

            {selectedRun.planner_warnings.length ? (
              <div className="workflow-field-list mt-4">
                {selectedRun.planner_warnings.map((item, index) => (
                  <div className="workflow-field-item !p-3" key={`${item}:${index}`}>
                    <div className="workflow-field-head">
                      <strong>{text('规划警告', 'Planning warning')}</strong>
                    </div>
                    <p>{item}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </article>

          <details className="collapsible-panel" open>
            <summary>
              <span className="inline-flex items-center gap-2">
                <ListChecks size={14} />
                {text('运行输入', 'Run input')}
              </span>
            </summary>
            <pre className="json-block">{prettyJson(selectedRun.input_payload)}</pre>
          </details>

          <details className="collapsible-panel" open>
            <summary>
              <span className="inline-flex items-center gap-2">
                <FileJson size={14} />
                {text('运行输出', 'Run output')}
              </span>
            </summary>
            <pre className="json-block" data-testid="workflow-output-json">
              {prettyJson(selectedRun.output_payload ?? {})}
            </pre>
          </details>
        </div>
      ) : (
        <div className="empty-state compact-empty-state">
          <p>{text('在底部输入目标并发送，agent 会自动编排并运行；也可以展开高级模式手动运行当前定义。', 'Use the composer below to describe the goal. The agent will plan and run automatically, or you can expand advanced mode and run the current definition manually.')}</p>
        </div>
      )}
    </section>
  )
}


export function WorkflowWorkspace({
  definitions,
  selectedDefinitionName,
  goalText,
  inputText,
  runtimeConfig,
  latestPlan,
  onGoalChange,
  onInputChange,
  onRuntimeConfigChange,
  onUseStarterInput,
  onFormatInput,
  onPlanGoal,
  onPlanAndRun,
  onStartRun,
  onCancelRun,
  onTerminateRun,
  onSelectRun,
  isStarting,
  isPlanning,
  isAgentRunning,
  isCancelling,
  isTerminating,
  runs,
  selectedRun,
  errorMessage,
}: WorkflowWorkspaceProps) {
  const { text } = useI18n()
  const selectedDefinition = definitions.find((item) => item.name === selectedDefinitionName)
  const fields = selectedDefinition ? extractWorkflowFields(selectedDefinition.input_schema) : []
  const requiredFields = fields.filter((field) => field.required)
  const starterPayload = selectedDefinition
    ? buildStarterInputFromSchema(selectedDefinition.input_schema)
    : {}
  const recentRuns = runs.slice(0, 4)
  const busy = isPlanning || isAgentRunning || isStarting

  return (
    <div className="workspace-stack">
      <section className="main-panel">
        <div className="workflow-dialog-scroll">
          <section className="workflow-dialog-welcome">
            <span className="sidebar-kicker">{text('Agent 编排器', 'Agent Orchestrator')}</span>
            <h2 className="workflow-hero-title">{text('对话式自动编排', 'Conversational orchestration')}</h2>
            <p className="workflow-hero-text">
              {text('在底部输入框描述目标，agent 会选择 workflow、补齐参数并启动运行。高级 JSON 输入只作为检查和兜底。', 'Describe the goal in the composer below. The agent will choose a workflow, fill payload fields, and start the run. Advanced JSON input is kept for inspection and fallback.')}
            </p>
            <div className="workflow-chip-row">
              <span className="workflow-chip">{text('自然语言目标', 'Natural language goal')}</span>
              <span className="workflow-chip">{text('自动选择 workflow', 'Auto workflow selection')}</span>
              <span className="workflow-chip">{text('自动补全 payload', 'Auto payload fill')}</span>
            </div>
          </section>

          {goalText.trim() ? (
            <article className="workflow-message workflow-message-user">
              <div className="message-bubble-header">
                <span className="message-role !text-blue-500">{text('用户目标', 'Goal')}</span>
              </div>
              <div className="message-bubble message-bubble-user">
                <div className="message-content font-bold !leading-relaxed whitespace-pre-wrap">
                  {goalText.trim()}
                </div>
              </div>
            </article>
          ) : null}

          {latestPlan ? (
            <article className="workflow-message">
              <div className="message-bubble-header">
                <span className="message-role text-emerald-600">{text('编排计划', 'Orchestration plan')}</span>
                <span className="message-time">[{formatIsoDateTime(latestPlan.generated_at)}]</span>
              </div>

              <section className="workflow-plan-shell">
                <div className="workflow-card-header !mb-3">
                  <div>
                    <span className="sidebar-kicker">{text('Agent 规划结果', 'Agent plan result')}</span>
                    <h3 className="workflow-section-title">{text('建议执行', 'Suggested workflow')} {latestPlan.plan.workflow_name}</h3>
                  </div>
                  <div className="workflow-chip-row !mt-0">
                    <span className="workflow-chip">{latestPlan.plan.confidence} {text('置信度', 'confidence')}</span>
                    <span className="workflow-chip">{latestPlan.plan.candidate_workflows.length} {text('候选', 'candidates')}</span>
                  </div>
                </div>

                <div className="workflow-plan-grid">
                  <article className="workflow-card !p-4">
                    <div className="workflow-field-head">
                      <strong>{text('为什么这样编排', 'Why this workflow')}</strong>
                      <span className="workflow-chip workflow-chip-muted">{latestPlan.plan.workflow_name}</span>
                    </div>
                    <p className="mt-3 text-[13px] leading-relaxed text-zinc-600">{latestPlan.plan.reason}</p>

                    <div className="workflow-chip-row">
                      {latestPlan.plan.candidate_workflows.map((name) => (
                        <span className="workflow-chip" key={name}>
                          {name}
                        </span>
                      ))}
                    </div>
                  </article>

                  <article className="workflow-card !p-4">
                    <div className="workflow-field-head">
                      <strong>{text('自动补全的输入', 'Auto-filled input')}</strong>
                      <span className="workflow-chip workflow-chip-muted">{text('已同步到高级模式', 'Synced to advanced mode')}</span>
                    </div>
                    <pre className="json-block mt-3 !p-4">{prettyJson(latestPlan.plan.input_payload)}</pre>
                  </article>
                </div>
              </section>
            </article>
          ) : null}

          {errorMessage ? <div className="panel-error !m-0">{errorMessage}</div> : null}

          <WorkflowRunResult
            isCancelling={isCancelling}
            isTerminating={isTerminating}
            onCancelRun={onCancelRun}
            onTerminateRun={onTerminateRun}
            selectedRun={selectedRun}
          />

          <details className="workflow-advanced-shell">
            <summary>{text('高级模式：手动检查或微调 workflow 输入', 'Advanced mode: inspect or fine-tune workflow input manually')}</summary>

            {selectedDefinition ? (
              <div className="workflow-canvas-grid mt-4">
                <article className="workflow-card workflow-card-editor">
                  <div className="workflow-card-header">
                    <div>
                      <span className="sidebar-kicker">{text('高级输入编辑器', 'Advanced input editor')}</span>
                      <h3 className="workflow-section-title">{text('准备运行输入', 'Prepare run input')}</h3>
                    </div>

                    <div className="toolbar-inline">
                      <button className="ghost-button !h-9 !rounded-xl !px-3" type="button" onClick={onUseStarterInput}>
                        <Sparkles size={14} />
                        <span>{text('载入示例', 'Load example')}</span>
                      </button>
                      <button className="ghost-button !h-9 !rounded-xl !px-3" type="button" onClick={onFormatInput}>
                        <Wand2 size={14} />
                        <span>{text('格式化 JSON', 'Format JSON')}</span>
                      </button>
                      <button
                        className="primary-button !h-9 !rounded-xl !px-4"
                        disabled={isStarting || !selectedDefinition}
                        type="button"
                        onClick={onStartRun}
                      >
                        <Play size={14} />
                        <span>{text('手动启动', 'Manual start')}</span>
                      </button>
                    </div>
                  </div>

                  <div className="workflow-editor-meta">
                    <span className="workflow-hint-pill">
                      <FileJson size={12} />
                      {text('当前示例', 'Current example')}: {prettyJson(starterPayload).length} {text('字符', 'chars')}
                    </span>
                    <span className="workflow-hint-text">
                      {text('这里是兜底的高级模式。agent 规划后的 payload 也会自动同步到这里。', 'This is the fallback advanced mode. Payloads generated by the agent are synced here automatically.')}
                    </span>
                  </div>

                  <div className="workflow-runtime-grid">
                    <label className="inspector-field">
                      <span className="inspector-field-label">timeout_seconds</span>
                      <input
                        className="inspector-input"
                        disabled={isStarting}
                        type="number"
                        value={runtimeConfig.timeoutSeconds}
                        onChange={(event) =>
                          onRuntimeConfigChange({ timeoutSeconds: event.target.value })
                        }
                      />
                    </label>
                    <label className="inspector-field">
                      <span className="inspector-field-label">max_retries</span>
                      <input
                        className="inspector-input"
                        disabled={isStarting}
                        min={0}
                        type="number"
                        value={runtimeConfig.maxRetries}
                        onChange={(event) =>
                          onRuntimeConfigChange({ maxRetries: event.target.value })
                        }
                      />
                    </label>
                    <label className="inspector-field">
                      <span className="inspector-field-label">retry_delay_seconds</span>
                      <input
                        className="inspector-input"
                        disabled={isStarting}
                        min={0}
                        step="0.1"
                        type="number"
                        value={runtimeConfig.retryDelaySeconds}
                        onChange={(event) =>
                          onRuntimeConfigChange({ retryDelaySeconds: event.target.value })
                        }
                      />
                    </label>
                  </div>

                  <textarea
                    className="field-textarea code-textarea !min-h-[420px]"
                    rows={18}
                    value={inputText}
                    onChange={(event) => onInputChange(event.target.value)}
                  />
                </article>

                <div className="workflow-side-stack">
                  <article className="workflow-card">
                    <div className="workflow-card-header">
                      <div>
                        <span className="sidebar-kicker">{text('当前定义', 'Current definition')}</span>
                        <h3 className="workflow-section-title">{selectedDefinition.name}</h3>
                      </div>
                      <span className="status-badge status-idle !text-[8px] !px-1.5 !py-0.5">
                        {requiredFields.length} {text('必填', 'required')}
                      </span>
                    </div>

                    <p className="text-[13px] leading-relaxed text-zinc-600">{selectedDefinition.description}</p>

                    <div className="workflow-field-list mt-4">
                      {fields.map((field) => (
                        <div className="workflow-field-item" key={field.name}>
                          <div className="workflow-field-head">
                            <strong>{field.name}</strong>
                            <div className="workflow-chip-row">
                              <span className="workflow-chip workflow-chip-muted">{field.type}</span>
                              {field.required ? <span className="workflow-chip workflow-chip-required">{text('必填', 'Required')}</span> : null}
                            </div>
                          </div>
                          <p>{field.description}</p>
                        </div>
                      ))}
                    </div>

                    <details className="collapsible-panel mt-4">
                      <summary>{text('原始输入 schema', 'Raw input schema')}</summary>
                      <pre className="json-block">{prettyJson(selectedDefinition.input_schema)}</pre>
                    </details>
                  </article>

                  <article className="workflow-card">
                    <div className="workflow-card-header">
                      <div>
                        <span className="sidebar-kicker">{text('最近运行', 'Recent runs')}</span>
                        <h3 className="workflow-section-title">{text('快速切换', 'Quick switch')}</h3>
                      </div>
                    </div>

                    <div className="workflow-run-mini-list">
                      {recentRuns.length === 0 ? (
                        <div className="empty-state compact-empty-state !border-none !bg-transparent !min-h-[100px]">
                          <p className="text-[12px] text-zinc-500">{text('还没有可查看的运行。', 'No runs to show yet.')}</p>
                        </div>
                      ) : (
                        recentRuns.map((run) => (
                          <button
                            className={
                              selectedRun?.run_id === run.run_id
                                ? 'workflow-run-mini workflow-run-mini-active'
                                : 'workflow-run-mini'
                            }
                            key={run.run_id}
                            type="button"
                            onClick={() => onSelectRun(run.run_id)}
                          >
                            <div className="sidebar-card-row">
                              <strong>{run.workflow_name}</strong>
                              <span className={`status-badge status-${run.status}`}>{run.status}</span>
                            </div>
                            <div className="sidebar-card-meta">
                              <span>{run.launch_mode === 'agent' ? 'agent' : text('手动', 'Manual')}</span>
                              <span>·</span>
                              <span>{formatIsoDateTime(run.updated_at)}</span>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </article>
                </div>
              </div>
            ) : (
              <div className="empty-state compact-empty-state">
                <p>{text('当前没有可用 workflow 定义。', 'No workflow definitions are available right now.')}</p>
              </div>
            )}
          </details>
        </div>

        <div className="workflow-composer-shell">
          <div className="workflow-composer">
            <textarea
              className="workflow-composer-input"
              data-testid="workflow-goal-input"
              placeholder={text('描述你想完成的目标。Enter 发送，Shift + Enter 换行。', 'Describe the goal. Press Enter to send, Shift+Enter for a new line.')}
              rows={2}
              value={goalText}
              onChange={(event) => onGoalChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  onPlanAndRun()
                }
              }}
            />

            <div className="workflow-composer-footer">
              <div className="workflow-chip-row !mt-0">
                <span className="workflow-chip">
                  <Bot size={12} />
                  {text('当前', 'Current')}: {selectedDefinition?.name ?? text('自动选择', 'Auto select')}
                </span>
                <span className="workflow-chip">{busy ? text('执行中', 'Running') : text('就绪', 'Ready')}</span>
                <span className="workflow-chip">{text('超时', 'Timeout')} {runtimeConfig.timeoutSeconds || text('未设', 'unset')}s</span>
                <span className="workflow-chip">{text('重试', 'Retries')} {runtimeConfig.maxRetries} {text('次', 'times')}</span>
              </div>

              <div className="workflow-agent-actions !pt-0">
                <button
                  className="ghost-button !h-10 !rounded-xl !px-4"
                  disabled={!goalText.trim() || busy}
                  type="button"
                  onClick={onPlanGoal}
                >
                  <Bot size={14} />
                  <span>{isPlanning ? text('规划中...', 'Planning...') : text('生成计划', 'Generate plan')}</span>
                </button>
                <button
                  className="primary-button !h-10 !rounded-xl !px-5"
                  data-testid="workflow-agent-run-button"
                  disabled={!goalText.trim() || busy}
                  type="button"
                  onClick={onPlanAndRun}
                >
                  <Send size={14} />
                  <span>{isAgentRunning ? text('编排中...', 'Orchestrating...') : text('发送并自动编排', 'Send and orchestrate')}</span>
                </button>
                <button
                  aria-label={text('启动 run', 'Start run')}
                  className="ghost-button !h-10 !rounded-xl !px-4"
                  disabled={isStarting || !selectedDefinition}
                  type="button"
                  onClick={onStartRun}
                >
                  <Play size={14} />
                  <span>{text('启动当前定义', 'Start current definition')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
