import { lazy, Suspense } from 'react'

import type {
  AppMeta,
  RuntimeToolCatalog,
  RuntimeRequirementsResponse,
  SessionDetail,
  TraceExportResult,
  TracingStatus,
  WorkflowCatalogResponse,
} from '../../../shared/api/contracts'
import { useI18n } from '../../../shared/i18n/I18nContext'
import { InspectorHeader } from '../../../shared/components/InspectorHeader'
import type { SessionDraft, ToolOption } from '../../sessions/constants'

const MetaPanel = lazy(() => import('../../meta/components/MetaPanel').then((module) => ({ default: module.MetaPanel })))
const RuntimeRequirementsPanel = lazy(() =>
  import('../../runtime/components/RuntimeRequirementsPanel').then((module) => ({
    default: module.RuntimeRequirementsPanel,
  })),
)
const SessionConfigPanel = lazy(() =>
  import('../../sessions/components/SessionConfigPanel').then((module) => ({ default: module.SessionConfigPanel })),
)
const TracingPanel = lazy(() =>
  import('../../tracing/components/TracingPanel').then((module) => ({ default: module.TracingPanel })),
)

type ChatInspectorPaneProps = {
  activeConfig: SessionDraft
  activeEnabledTools: string[]
  activeInspectorTab: 'session' | 'tracing' | 'runtime' | 'meta'
  availableToolOptions: ToolOption[]
  capabilities: {
    supportsInterrupts: boolean
    supportsStructuredResponseFormat: boolean
  }
  configError?: string
  currentSession?: SessionDetail
  exportResult?: TraceExportResult
  isCreating: boolean
  isReadOnly: boolean
  isSaving: boolean
  isStreaming: boolean
  runtimeRequirements?: RuntimeRequirementsResponse
  runtimeToolCatalog?: RuntimeToolCatalog
  runtimeWorkflowCatalog?: WorkflowCatalogResponse
  runtimeTracingStatus?: TracingStatus
  sessionId?: string
  sessionTracingStatus?: TracingStatus
  exporting: boolean
  meta?: AppMeta
  onChangeTab: (tab: 'session' | 'tracing' | 'runtime' | 'meta') => void
  onConfigChange: (patch: Partial<SessionDraft>) => void
  onCreateSession: () => void
  onApplyHitlQuestionPreset?: () => void
  onApplyHitlApprovalPreset?: () => void
  onExportActive?: () => void
  onExportRuntime: () => void
  onResetConfig: () => void
  onSaveCurrentSession: () => void
  onToggleTool: (toolName: string) => void
}

export function ChatInspectorPane({
  activeConfig,
  activeEnabledTools,
  activeInspectorTab,
  availableToolOptions,
  capabilities,
  configError,
  currentSession,
  exportResult,
  exporting,
  isCreating,
  isReadOnly,
  isSaving,
  isStreaming,
  meta,
  runtimeRequirements,
  runtimeToolCatalog,
  runtimeWorkflowCatalog,
  runtimeTracingStatus,
  sessionId,
  sessionTracingStatus,
  onChangeTab,
  onConfigChange,
  onCreateSession,
  onApplyHitlQuestionPreset,
  onApplyHitlApprovalPreset,
  onExportActive,
  onExportRuntime,
  onResetConfig,
  onSaveCurrentSession,
  onToggleTool,
}: ChatInspectorPaneProps) {
  const { text } = useI18n()
  const inspectorFallback = <div className="inspector-alert inspector-alert-muted">{text('正在加载面板…', 'Loading panel...')}</div>

  return (
    <aside className="workspace-inspector">
      <InspectorHeader
        activeTab={activeInspectorTab}
        onChange={onChangeTab}
        tabs={[
          { id: 'session', label: text('会话', 'Session') },
          { id: 'tracing', label: text('追踪', 'Tracing') },
          { id: 'runtime', label: text('运行时', 'Runtime') },
          { id: 'meta', label: text('元信息', 'Meta') },
        ]}
      />
      <div className="inspector-pane">
        <Suspense fallback={inspectorFallback}>
          {activeInspectorTab === 'session' ? (
            <SessionConfigPanel
              capabilities={capabilities}
              config={activeConfig}
              configError={configError}
              currentSession={currentSession}
              isCreating={isCreating}
              isReadOnly={isReadOnly}
              isSaving={isSaving}
              isStreaming={isStreaming}
              availableToolOptions={availableToolOptions}
              onApplyHitlApprovalPreset={onApplyHitlApprovalPreset}
              onApplyHitlQuestionPreset={onApplyHitlQuestionPreset}
              onConfigChange={onConfigChange}
              onCreateSession={onCreateSession}
              onResetConfig={onResetConfig}
              onSaveCurrentSession={onSaveCurrentSession}
              onToggleTool={onToggleTool}
            />
          ) : null}

          {activeInspectorTab === 'tracing' ? (
            <TracingPanel
              activeStatus={sessionTracingStatus}
              activeTitle={sessionId ? `${text('会话', 'Session')} ${sessionId.slice(0, 8)}` : text('会话', 'Session')}
              exportResult={exportResult}
              exporting={exporting}
              onExportActive={onExportActive}
              onExportRuntime={onExportRuntime}
              runtimeStatus={runtimeTracingStatus}
            />
          ) : null}

          {activeInspectorTab === 'runtime' ? (
            <RuntimeRequirementsPanel
              enabledTools={activeEnabledTools}
              payload={runtimeRequirements}
              toolCatalog={runtimeToolCatalog}
              workflowCatalog={runtimeWorkflowCatalog}
            />
          ) : null}

          {activeInspectorTab === 'meta' ? <MetaPanel meta={meta} /> : null}
        </Suspense>
      </div>
    </aside>
  )
}
