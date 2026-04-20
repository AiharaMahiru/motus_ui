import { Boxes, Clock3, PlayCircle, TerminalSquare } from 'lucide-react'

import type { WorkflowDefinitionSummary, WorkflowRunSummary } from '../../../shared/api/contracts'
import { useI18n } from '../../../shared/i18n/I18nContext'
import { formatIsoTime } from '../../../shared/lib/format'
import { extractWorkflowFields } from '../schemaDraft'


type WorkflowSidebarProps = {
  definitions: WorkflowDefinitionSummary[]
  runs: WorkflowRunSummary[]
  selectedDefinitionName: string
  selectedRunId?: string
  onSelectDefinition: (workflowName: string) => void
  onSelectRun: (runId: string) => void
}


export function WorkflowSidebar({
  definitions,
  runs,
  selectedDefinitionName,
  selectedRunId,
  onSelectDefinition,
  onSelectRun,
}: WorkflowSidebarProps) {
  const { text } = useI18n()
  return (
    <aside className="workspace-sidebar">
      <div className="sidebar-brandbar">
        <div className="sidebar-brandmark">
          <TerminalSquare size={15} />
        </div>
        <div className="sidebar-brandcopy">
          <h1 className="sidebar-brandtitle">MOTUS</h1>
          <p className="sidebar-brandsubtitle">Workflow Lab</p>
        </div>
      </div>

      <div className="stack-list !gap-3 !p-3">
        <div className="sidebar-summary-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="sidebar-summary-kicker">{text('编排区', 'Orchestrator')}</span>
              <h2 className="sidebar-summary-title">{text('自动工作流', 'Auto workflow')}</h2>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="sidebar-summary-item">
                <div className="sidebar-summary-label">
                  <Boxes size={12} />
                  {text('模板', 'Defs')}
                </div>
                <div className="sidebar-summary-value">{definitions.length}</div>
              </div>
              <div className="sidebar-summary-item">
                <div className="sidebar-summary-label">
                  <PlayCircle size={12} />
                  Runs
                </div>
                <div className="sidebar-summary-value">{runs.length}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="sidebar-section">
          <span className="sidebar-section-title">{text('可用定义', 'Definitions')}</span>
          <div className="sidebar-list">
            {definitions.map((definition) => {
              const fields = extractWorkflowFields(definition.input_schema)
              const requiredCount = fields.filter((field) => field.required).length

              return (
                <button
                  className={
                    selectedDefinitionName === definition.name
                      ? 'sidebar-card sidebar-card-active'
                      : 'sidebar-card'
                  }
                  key={definition.name}
                  type="button"
                  onClick={() => onSelectDefinition(definition.name)}
                >
                  <div className="sidebar-card-row">
                    <strong className="sidebar-card-title">{definition.name}</strong>
                    <span className="status-badge status-ready !text-[8px] !px-1.5 !py-0.5">
                      {requiredCount} {text('必填', 'required')}
                    </span>
                  </div>
                  <p className="sidebar-card-copy">{definition.description}</p>
                  <div className="sidebar-card-meta">
                    <span>{fields.length} {text('字段', 'fields')}</span>
                    <span>·</span>
                    <span>{requiredCount === 0 ? text('可直接运行', 'Ready to run') : text('需要准备输入', 'Needs input')}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="sidebar-section">
          <div className="flex items-center justify-between px-1">
            <span className="sidebar-section-title !px-0">{text('最近运行', 'Recent runs')}</span>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {runs.length}
            </span>
          </div>

          <div className="sidebar-list" data-testid="workflow-run-list">
            {runs.length === 0 ? (
              <div className="empty-state compact-empty-state !border-none !bg-transparent !min-h-[120px]">
                <div className="flex flex-col items-center gap-2 text-center">
                  <Clock3 size={18} className="text-slate-300" />
                  <p className="text-[11px] font-bold text-slate-400">{text('还没有运行记录', 'No runs yet')}</p>
                </div>
              </div>
            ) : null}

            {runs.map((run) => (
              <button
                className={selectedRunId === run.run_id ? 'sidebar-card sidebar-card-active' : 'sidebar-card'}
                key={run.run_id}
                type="button"
                onClick={() => onSelectRun(run.run_id)}
              >
                <div className="sidebar-card-row">
                  <strong className="sidebar-card-title">{run.workflow_name}</strong>
                  <span className={`status-badge status-${run.status}`}>{run.status}</span>
                </div>
                <div className="sidebar-card-meta">
                  <span>{run.run_id.slice(0, 8)}</span>
                  <span>·</span>
                  <span>{formatIsoTime(run.updated_at)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  )
}
