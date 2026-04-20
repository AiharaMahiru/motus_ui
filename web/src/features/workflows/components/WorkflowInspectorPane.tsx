import { lazy, Suspense } from 'react'

import type {
  AppMeta,
  RuntimeRequirementsResponse,
  RuntimeToolCatalog,
  TraceExportResult,
  TracingStatus,
  WorkflowCatalogResponse,
} from '../../../shared/api/contracts'
import type { InspectorTabId } from '../../../app/LayoutContext'
import { useI18n } from '../../../shared/i18n/I18nContext'
import { InspectorHeader } from '../../../shared/components/InspectorHeader'

const MetaPanel = lazy(() => import('../../meta/components/MetaPanel').then((module) => ({ default: module.MetaPanel })))
const RuntimeRequirementsPanel = lazy(() =>
  import('../../runtime/components/RuntimeRequirementsPanel').then((module) => ({
    default: module.RuntimeRequirementsPanel,
  })),
)
const TracingPanel = lazy(() =>
  import('../../tracing/components/TracingPanel').then((module) => ({ default: module.TracingPanel })),
)

type WorkflowInspectorPaneProps = {
  activeInspectorTab: InspectorTabId
  exportResult?: TraceExportResult
  exporting: boolean
  meta?: AppMeta
  runtimeRequirements?: RuntimeRequirementsResponse
  runtimeToolCatalog?: RuntimeToolCatalog
  runtimeWorkflowCatalog?: WorkflowCatalogResponse
  runtimeTracingStatus?: TracingStatus
  runId?: string
  workflowTracingStatus?: TracingStatus
  onChangeTab: (tab: InspectorTabId) => void
  onExportActive?: () => void
  onExportRuntime: () => void
}

export function WorkflowInspectorPane({
  activeInspectorTab,
  exportResult,
  exporting,
  meta,
  runtimeRequirements,
  runtimeToolCatalog,
  runtimeWorkflowCatalog,
  runtimeTracingStatus,
  runId,
  workflowTracingStatus,
  onChangeTab,
  onExportActive,
  onExportRuntime,
}: WorkflowInspectorPaneProps) {
  const { text } = useI18n()
  return (
    <aside className="workspace-inspector">
      <InspectorHeader
        activeTab={activeInspectorTab}
        onChange={onChangeTab}
        tabs={[
          { id: 'tracing', label: text('追踪', 'Tracing') },
          { id: 'runtime', label: text('运行时', 'Runtime') },
          { id: 'meta', label: text('元信息', 'Meta') },
        ]}
      />

      <div className="inspector-pane">
        <Suspense fallback={<div className="inspector-alert inspector-alert-muted">{text('正在加载面板…', 'Loading panel...')}</div>}>
          {activeInspectorTab === 'tracing' ? (
            <TracingPanel
              activeStatus={workflowTracingStatus}
              activeTitle={runId ? `Workflow ${runId.slice(0, 8)}` : 'Workflow'}
              exportResult={exportResult}
              exporting={exporting}
              onExportActive={onExportActive}
              onExportRuntime={onExportRuntime}
              runtimeStatus={runtimeTracingStatus}
            />
          ) : null}

          {activeInspectorTab === 'runtime' ? (
            <RuntimeRequirementsPanel
              enabledTools={[]}
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
