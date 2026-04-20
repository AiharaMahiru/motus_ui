import { useEffect, useMemo, useRef, useState } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'

import { useLayout } from '../../../app/LayoutContext'
import type { TraceExportResult, WorkflowPlannerResponse } from '../../../shared/api/contracts'
import { useI18n } from '../../../shared/i18n/I18nContext'
import { ResizableSidebar } from '../../../shared/components/ResizableSidebar'
import { WorkbenchModeSwitch } from '../../../shared/components/WorkbenchModeSwitch'
import { readLastWorkflowRunId, saveLastWorkflowRunId } from '../../../shared/lib/storage'
import { getMeta, metaKeys } from '../../meta/api'
import {
  getRuntimeRequirements,
  getRuntimeToolCatalog,
  getRuntimeWorkflowCatalog,
  runtimeKeys,
} from '../../runtime/api'
import {
  exportRuntimeTrace,
  exportWorkflowTrace,
  getRuntimeTracingStatus,
  getWorkflowTracingStatus,
  tracingKeys,
} from '../../tracing/api'
import {
  cancelWorkflowRun,
  terminateWorkflowRun,
  getWorkflowRunDetail,
  listWorkflowDefinitions,
  listWorkflowRuns,
  planWorkflowRun,
  startAgentWorkflowRun,
  startWorkflowRun,
  workflowKeys,
} from '../api'
import { WorkflowInspectorPane } from '../components/WorkflowInspectorPane'
import { WorkflowSidebar } from '../components/WorkflowSidebar'
import { WorkflowWorkspace } from '../components/WorkflowWorkspace'
import { buildStarterInputFromSchema, formatWorkflowJson } from '../schemaDraft'
import type { WorkflowRuntimeDraft } from '../types'

const DEFAULT_WORKFLOW_RUNTIME_DRAFT: WorkflowRuntimeDraft = {
  timeoutSeconds: '600',
  maxRetries: '0',
  retryDelaySeconds: '0',
}

function runtimeToDraft(runtime?: {
  timeout_seconds?: number | null
  max_retries?: number
  retry_delay_seconds?: number
}): WorkflowRuntimeDraft {
  return {
    timeoutSeconds:
      runtime?.timeout_seconds == null ? DEFAULT_WORKFLOW_RUNTIME_DRAFT.timeoutSeconds : String(runtime.timeout_seconds),
    maxRetries: String(runtime?.max_retries ?? 0),
    retryDelaySeconds: String(runtime?.retry_delay_seconds ?? 0),
  }
}

function buildRuntimePayload(runtimeDraft: WorkflowRuntimeDraft) {
  return {
    timeout_seconds: runtimeDraft.timeoutSeconds.trim() ? Number(runtimeDraft.timeoutSeconds) : null,
    max_retries: runtimeDraft.maxRetries.trim() ? Number(runtimeDraft.maxRetries) : 0,
    retry_delay_seconds: runtimeDraft.retryDelaySeconds.trim()
      ? Number(runtimeDraft.retryDelaySeconds)
      : 0,
  }
}


function buildPlanPreview(goal: string, detail: Awaited<ReturnType<typeof startAgentWorkflowRun>>): WorkflowPlannerResponse | undefined {
  if (!detail.planner_reason) {
    return undefined
  }

  return {
    goal,
    generated_at: detail.updated_at,
    plan: {
      workflow_name: detail.workflow_name,
      input_payload: detail.input_payload,
      reason: detail.planner_reason,
      confidence: detail.planner_confidence ?? 'medium',
      missing_information: detail.planner_missing_information ?? [],
      warnings: detail.planner_warnings ?? [],
      candidate_workflows: [detail.workflow_name],
    },
  }
}


export function WorkflowPage() {
  const { text } = useI18n()
  const { runId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { activeInspectorTab, setActiveInspectorTab } = useLayout()
  const defaultGoalText = text(
    '帮我快速分析一段产品文案，提取关键词、标题结构和摘要预览。',
    'Quickly analyze a piece of product copy, extract keywords, title structure, and a summary preview.',
  )
  const previousDefaultGoalRef = useRef(defaultGoalText)
  const [manualSelectedDefinitionName, setManualSelectedDefinitionName] = useState('')
  const [inputDrafts, setInputDrafts] = useState<Record<string, string>>({})
  const [goalText, setGoalText] = useState(defaultGoalText)
  const [latestPlan, setLatestPlan] = useState<WorkflowPlannerResponse>()
  const [errorMessage, setErrorMessage] = useState<string>()
  const [lastTraceExport, setLastTraceExport] = useState<TraceExportResult>()
  const [runtimeDraft, setRuntimeDraft] = useState<WorkflowRuntimeDraft>(DEFAULT_WORKFLOW_RUNTIME_DRAFT)
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(true)
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(true)

  const definitionsQuery = useQuery({
    queryKey: workflowKeys.definitions,
    queryFn: listWorkflowDefinitions,
  })
  const runsQuery = useQuery({
    queryKey: workflowKeys.runs,
    queryFn: listWorkflowRuns,
    refetchInterval: 1_500,
  })
  const metaQuery = useQuery({
    queryKey: metaKeys.all,
    queryFn: getMeta,
  })
  const runtimeRequirementsQuery = useQuery({
    queryKey: runtimeKeys.requirements,
    queryFn: getRuntimeRequirements,
  })
  const runtimeToolCatalogQuery = useQuery({
    queryKey: runtimeKeys.toolCatalog,
    queryFn: getRuntimeToolCatalog,
  })
  const runtimeWorkflowCatalogQuery = useQuery({
    queryKey: runtimeKeys.workflowCatalog,
    queryFn: getRuntimeWorkflowCatalog,
  })
  const runtimeTracingQuery = useQuery({
    queryKey: tracingKeys.runtime,
    queryFn: getRuntimeTracingStatus,
  })
  const workflowDetailQuery = useQuery({
    queryKey: runId ? workflowKeys.detail(runId) : ['workflows', 'detail', 'empty'],
    queryFn: () => getWorkflowRunDetail(runId!),
    enabled: Boolean(runId),
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) {
        return 1_000
      }
      return data.status === 'running' || data.status === 'queued' ? 1_000 : false
    },
  })
  const workflowTracingQuery = useQuery({
    queryKey: runId ? tracingKeys.workflow(runId) : ['tracing', 'workflow', 'empty'],
    queryFn: () => getWorkflowTracingStatus(runId!),
    enabled: Boolean(runId),
    refetchInterval: 2_000,
  })

  const planMutation = useMutation({
    mutationFn: planWorkflowRun,
    onSuccess: (plan) => {
      setErrorMessage(undefined)
      setLatestPlan(plan)
      setManualSelectedDefinitionName(plan.plan.workflow_name)
      setInputDrafts((current) => ({
        ...current,
        [plan.plan.workflow_name]: JSON.stringify(plan.plan.input_payload, null, 2),
      }))
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : text('自动编排失败', 'Automatic orchestration failed'))
    },
  })
  const startRunMutation = useMutation({
    mutationFn: startWorkflowRun,
    onSuccess: (detail) => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.runs })
      queryClient.setQueryData(workflowKeys.detail(detail.run_id), detail)
      saveLastWorkflowRunId(detail.run_id)
      navigate(`/workflows/${detail.run_id}`)
    },
  })
  const startAgentRunMutation = useMutation({
    mutationFn: startAgentWorkflowRun,
    onSuccess: (detail) => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.runs })
      queryClient.setQueryData(workflowKeys.detail(detail.run_id), detail)
      saveLastWorkflowRunId(detail.run_id)
      setLatestPlan(buildPlanPreview(goalText.trim(), detail))
      setManualSelectedDefinitionName(detail.workflow_name)
      setInputDrafts((current) => ({
        ...current,
        [detail.workflow_name]: JSON.stringify(detail.input_payload, null, 2),
      }))
      navigate(`/workflows/${detail.run_id}`)
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : text('自动编排并运行失败', 'Automatic orchestration and run failed'))
    },
  })
  const exportWorkflowTraceMutation = useMutation({
    mutationFn: (activeRunId: string) => exportWorkflowTrace(activeRunId),
    onSuccess: (payload) => {
      setLastTraceExport(payload)
      if (runId) {
        queryClient.invalidateQueries({ queryKey: tracingKeys.workflow(runId) })
      }
    },
  })
  const exportRuntimeTraceMutation = useMutation({
    mutationFn: exportRuntimeTrace,
    onSuccess: (payload) => {
      setLastTraceExport(payload)
      queryClient.invalidateQueries({ queryKey: tracingKeys.runtime })
    },
  })
  const cancelRunMutation = useMutation({
    mutationFn: ({ runId, reason }: { runId: string; reason?: string }) => cancelWorkflowRun(runId, reason),
    onSuccess: (detail) => {
      queryClient.setQueryData(workflowKeys.detail(detail.run_id), detail)
      queryClient.invalidateQueries({ queryKey: workflowKeys.runs })
    },
  })
  const terminateRunMutation = useMutation({
    mutationFn: ({ runId, reason }: { runId: string; reason?: string }) => terminateWorkflowRun(runId, reason),
    onSuccess: (detail) => {
      queryClient.setQueryData(workflowKeys.detail(detail.run_id), detail)
      queryClient.invalidateQueries({ queryKey: workflowKeys.runs })
    },
  })

  useEffect(() => {
    if (!runId && runsQuery.data?.length) {
      const rememberedRunId = readLastWorkflowRunId()
      const rememberedRun = runsQuery.data.find((item) => item.run_id === rememberedRunId)
      if (rememberedRun) {
        navigate(`/workflows/${rememberedRun.run_id}`, { replace: true })
      }
    }
  }, [navigate, runId, runsQuery.data])

  useEffect(() => {
    setGoalText((current) => (current === previousDefaultGoalRef.current ? defaultGoalText : current))
    previousDefaultGoalRef.current = defaultGoalText
  }, [defaultGoalText])

  useEffect(() => {
    if (runId) {
      saveLastWorkflowRunId(runId)
    }
  }, [runId])

  useEffect(() => {
    if (!workflowDetailQuery.data?.runtime) {
      return
    }
    setRuntimeDraft(runtimeToDraft(workflowDetailQuery.data.runtime))
  }, [workflowDetailQuery.data?.run_id, workflowDetailQuery.data?.runtime])

  useEffect(() => {
    if (activeInspectorTab === 'session') {
      setActiveInspectorTab('tracing')
    }
  }, [activeInspectorTab, setActiveInspectorTab])

  const sortedRuns = useMemo(
    () =>
      [...(runsQuery.data ?? [])].sort((left, right) => right.updated_at.localeCompare(left.updated_at)),
    [runsQuery.data],
  )
  const selectedDefinitionName =
    workflowDetailQuery.data?.workflow_name ||
    latestPlan?.plan.workflow_name ||
    manualSelectedDefinitionName ||
    definitionsQuery.data?.[0]?.name ||
    ''
  const effectivePlan =
    latestPlan ||
    (workflowDetailQuery.data?.planner_reason && workflowDetailQuery.data.user_goal
      ? buildPlanPreview(workflowDetailQuery.data.user_goal, workflowDetailQuery.data)
      : undefined)
  const selectedDefinition = useMemo(
    () => definitionsQuery.data?.find((item) => item.name === selectedDefinitionName),
    [definitionsQuery.data, selectedDefinitionName],
  )
  const inputText = useMemo(() => {
    if (!selectedDefinition) {
      return ''
    }
    // 每个 workflow 保留各自的输入草稿；首次进入时才回退到 schema 推导出的示例 JSON。
    return (
      inputDrafts[selectedDefinition.name] ??
      JSON.stringify(buildStarterInputFromSchema(selectedDefinition.input_schema), null, 2)
    )
  }, [inputDrafts, selectedDefinition])

  async function handleStartRun() {
    try {
      setErrorMessage(undefined)
      const parsedInput = JSON.parse(inputText)
      await startRunMutation.mutateAsync({
        workflow_name: selectedDefinitionName,
        input_payload: parsedInput,
        runtime: buildRuntimePayload(runtimeDraft),
      })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : text('启动 workflow 失败', 'Failed to start workflow'))
    }
  }

  function handleInputChange(value: string) {
    if (!selectedDefinitionName) {
      return
    }
    setInputDrafts((current) => ({
      ...current,
      [selectedDefinitionName]: value,
    }))
  }

  function handleUseStarterInput() {
    if (!selectedDefinition) {
      return
    }
    setErrorMessage(undefined)
    setInputDrafts((current) => ({
      ...current,
      [selectedDefinition.name]: JSON.stringify(
        buildStarterInputFromSchema(selectedDefinition.input_schema),
        null,
        2,
      ),
    }))
  }

  function handleFormatInput() {
    if (!selectedDefinitionName) {
      return
    }
    try {
      setErrorMessage(undefined)
      setInputDrafts((current) => ({
        ...current,
        [selectedDefinitionName]: formatWorkflowJson(inputText),
      }))
    } catch (error) {
      setErrorMessage(error instanceof Error ? `${text('输入 JSON 不合法', 'Invalid input JSON')}: ${error.message}` : text('输入 JSON 不合法', 'Invalid input JSON'))
    }
  }

  async function handlePlanGoal() {
    const goal = goalText.trim()
    if (!goal) {
      return
    }
    setErrorMessage(undefined)
    try {
      await planMutation.mutateAsync({ goal })
    } catch {
      // mutation.onError 已经把错误映射到页面提示，这里只负责阻止未捕获 Promise。
    }
  }

  async function handlePlanAndRun() {
    const goal = goalText.trim()
    if (!goal) {
      return
    }
    setErrorMessage(undefined)
    try {
      await startAgentRunMutation.mutateAsync({ goal })
    } catch {
      // mutation.onError 已经把错误映射到页面提示，这里只负责阻止未捕获 Promise。
    }
  }

  async function handleCancelRun() {
    if (!workflowDetailQuery.data) {
      return
    }
    try {
      setErrorMessage(undefined)
      await cancelRunMutation.mutateAsync({
        runId: workflowDetailQuery.data.run_id,
        reason: text('用户从 WebUI 取消运行', 'Cancelled from WebUI'),
      })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : text('取消 workflow 失败', 'Failed to cancel workflow'))
    }
  }

  async function handleTerminateRun() {
    if (!workflowDetailQuery.data) {
      return
    }
    try {
      setErrorMessage(undefined)
      await terminateRunMutation.mutateAsync({
        runId: workflowDetailQuery.data.run_id,
        reason: text('用户从 WebUI 强制终止运行', 'Force terminated from WebUI'),
      })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : text('终止 workflow 失败', 'Failed to terminate workflow'))
    }
  }

  return (
    <div className="workspace-grid">
      <ResizableSidebar
        collapsed={leftSidebarCollapsed}
        collapsedWidth={0}
        side="left"
        defaultWidth={280}
        minWidth={240}
        maxWidth={420}
      >
        <WorkflowSidebar
          definitions={definitionsQuery.data ?? []}
          onSelectDefinition={setManualSelectedDefinitionName}
          onSelectRun={(activeRunId) => navigate(`/workflows/${activeRunId}`)}
          runs={sortedRuns}
          selectedDefinitionName={selectedDefinitionName}
          selectedRunId={runId}
        />
      </ResizableSidebar>

      <section className="workspace-main">
        <WorkbenchModeSwitch
          activeMode="workflows"
          leftSidebarToggle={{
            collapsed: leftSidebarCollapsed,
            onToggle: () => setLeftSidebarCollapsed((current) => !current),
          }}
          rightSidebarToggle={{
            collapsed: rightSidebarCollapsed,
            onToggle: () => setRightSidebarCollapsed((current) => !current),
          }}
        />
        <WorkflowWorkspace
          definitions={definitionsQuery.data ?? []}
          errorMessage={errorMessage}
          goalText={goalText}
          inputText={inputText}
          isAgentRunning={startAgentRunMutation.isPending}
          isCancelling={cancelRunMutation.isPending}
          isPlanning={planMutation.isPending}
          isStarting={startRunMutation.isPending}
          isTerminating={terminateRunMutation.isPending}
          latestPlan={effectivePlan}
          onCancelRun={handleCancelRun}
          onFormatInput={handleFormatInput}
          onGoalChange={setGoalText}
          onInputChange={handleInputChange}
          onPlanAndRun={handlePlanAndRun}
          onPlanGoal={handlePlanGoal}
          onRuntimeConfigChange={(patch) => setRuntimeDraft((current) => ({ ...current, ...patch }))}
          onSelectRun={(activeRunId) => navigate(`/workflows/${activeRunId}`)}
          onStartRun={handleStartRun}
          onTerminateRun={handleTerminateRun}
          onUseStarterInput={handleUseStarterInput}
          runtimeConfig={runtimeDraft}
          runs={sortedRuns}
          selectedDefinitionName={selectedDefinitionName}
          selectedRun={workflowDetailQuery.data}
        />
      </section>

      <ResizableSidebar
        collapsed={rightSidebarCollapsed}
        collapsedWidth={0}
        side="right"
        defaultWidth={380}
        minWidth={320}
        maxWidth={520}
      >
        <WorkflowInspectorPane
          activeInspectorTab={activeInspectorTab}
          exportResult={lastTraceExport}
          exporting={exportRuntimeTraceMutation.isPending || exportWorkflowTraceMutation.isPending}
          meta={metaQuery.data}
          runtimeRequirements={runtimeRequirementsQuery.data}
          runtimeToolCatalog={runtimeToolCatalogQuery.data}
          runtimeTracingStatus={runtimeTracingQuery.data}
          runtimeWorkflowCatalog={runtimeWorkflowCatalogQuery.data}
          runId={runId}
          workflowTracingStatus={workflowTracingQuery.data}
          onChangeTab={setActiveInspectorTab}
          onExportActive={runId ? () => exportWorkflowTraceMutation.mutate(runId) : undefined}
          onExportRuntime={() => exportRuntimeTraceMutation.mutate()}
        />
      </ResizableSidebar>
    </div>
  )
}
