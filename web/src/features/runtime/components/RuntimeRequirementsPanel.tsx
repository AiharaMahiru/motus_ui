import { Boxes, ChevronDown, PackageCheck, PlugZap, Wrench } from 'lucide-react'

import type {
  RuntimeRequirementsResponse,
  RuntimeToolCatalog,
  WorkflowCatalogResponse,
} from '../../../shared/api/contracts'
import { useI18n } from '../../../shared/i18n/I18nContext'


type RuntimeRequirementsPanelProps = {
  payload?: RuntimeRequirementsResponse
  enabledTools: string[]
  toolCatalog?: RuntimeToolCatalog
  workflowCatalog?: WorkflowCatalogResponse
}

function isRelevant(requiredBy: string[], enabledTools: string[]) {
  return requiredBy.some((item) => enabledTools.includes(item))
}

function categoryIcon(category: 'shared' | 'tool' | 'mcp' | 'skill') {
  if (category === 'shared') {
    return <Boxes size={14} />
  }
  if (category === 'mcp') {
    return <PlugZap size={14} />
  }
  if (category === 'skill') {
    return <PackageCheck size={14} />
  }
  return <Wrench size={14} />
}


export function RuntimeRequirementsPanel({
  payload,
  enabledTools,
  toolCatalog,
  workflowCatalog,
}: RuntimeRequirementsPanelProps) {
  const { text } = useI18n()
  if (!payload) {
    return null
  }
  const categoryLabels = {
    shared: text('共享依赖', 'Shared requirements'),
    tool: text('工具运行时', 'Tool runtime'),
    mcp: text('MCP 依赖', 'MCP requirements'),
    skill: text('Skill 运行时', 'Skill runtime'),
  } as const

  const grouped = payload.checks.reduce<Record<string, typeof payload.checks>>((accumulator, item) => {
    const key = item.requirement.category
    accumulator[key] ??= []
    accumulator[key].push(item)
    return accumulator
  }, {})

  return (
    <div className="inspector-page">
      {toolCatalog?.tools?.length ? (
        <section className="inspector-section">
          <div className="inspector-section-head inspector-section-head-compact">
            <div className="inspector-title-inline">
              <span className="inspector-section-icon">
                <Wrench size={14} />
              </span>
              <div className="inspector-title-group">
                <h3 className="inspector-section-title">{text('工具目录', 'Tool catalog')}</h3>
              </div>
            </div>
            <span className="inspector-chip">{toolCatalog.tools.length}</span>
          </div>

          <div className="runtime-check-list">
            {toolCatalog.tools.map((tool) => {
              const relevant = enabledTools.includes(tool.name)
              return (
                <div className="runtime-check-card" key={tool.name}>
                  <div className="runtime-check-head">
                    <div className="runtime-check-copy">
                      <strong>{tool.label ?? tool.name}</strong>
                      <p>{tool.description || text('当前运行时已注册该工具。', 'This tool is registered in the current runtime.')}</p>
                    </div>
                    <div className="toolbar-inline">
                      {relevant ? <span className="status-badge status-running">{text('当前启用', 'Enabled')}</span> : null}
                      <span className="status-badge status-ready">{tool.group}</span>
                    </div>
                  </div>

                  <div className="runtime-check-meta">
                    <span className="inspector-chip inspector-chip-muted">{tool.source}</span>
                    <span className="runtime-check-detail">
                      {tool.persistence === 'filesystem' ? text('持久插件', 'Persistent plugin') : text('进程内注册', 'In-process')}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      {workflowCatalog?.workflows?.length ? (
        <section className="inspector-section">
          <div className="inspector-section-head inspector-section-head-compact">
            <div className="inspector-title-inline">
              <span className="inspector-section-icon">
                <Boxes size={14} />
              </span>
              <div className="inspector-title-group">
                <h3 className="inspector-section-title">{text('Workflow 宿主目录', 'Workflow catalog')}</h3>
              </div>
            </div>
            <span className="inspector-chip">{workflowCatalog.workflows.length}</span>
          </div>

          <div className="runtime-check-list">
            {workflowCatalog.workflows.map((workflow) => (
              <div className="runtime-check-card" key={workflow.name}>
                <div className="runtime-check-head">
                  <div className="runtime-check-copy">
                    <strong>{workflow.name}</strong>
                    <p>{workflow.description || text('当前运行时已装载该 workflow。', 'This workflow is available in the current runtime.')}</p>
                  </div>
                  <span className="status-badge status-ready">{workflow.source}</span>
                </div>

                <div className="runtime-check-meta">
                  <span className="inspector-chip inspector-chip-muted">{workflow.persistence}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="inspector-section">
        <div className="runtime-stat-grid">
          <div className="runtime-stat-card">
            <span className="inspector-field-label">{text('已就绪', 'Ready')}</span>
            <strong>{payload.ready_count}</strong>
          </div>
          <div className="runtime-stat-card">
            <span className="inspector-field-label">{text('缺失', 'Missing')}</span>
            <strong>{payload.missing_count}</strong>
          </div>
          <div className="runtime-stat-card">
            <span className="inspector-field-label">{text('人工配置', 'Manual')}</span>
            <strong>{payload.manual_count}</strong>
          </div>
        </div>
      </section>

      {(Object.entries(grouped) as [keyof typeof categoryLabels, typeof payload.checks][]).map(([category, items]) => (
        <details className="inspector-disclosure" key={category} open={items.some((item) => isRelevant(item.requirement.required_by, enabledTools)) || category === 'shared'}>
          <summary className="inspector-disclosure-summary">
            <div className="inspector-title-inline">
              <span className="inspector-section-icon">{categoryIcon(category)}</span>
              <div className="inspector-title-group">
                <h3 className="inspector-section-title">{categoryLabels[category]}</h3>
              </div>
            </div>
            <div className="toolbar-inline">
              <span className="inspector-chip">{items.length}</span>
              <ChevronDown className="inspector-disclosure-chevron" size={15} />
            </div>
          </summary>

          <div className="inspector-disclosure-body">
            <div className="runtime-check-list">
              {items.map((item) => {
                const relevant = isRelevant(item.requirement.required_by, enabledTools)
                return (
                  <div className="runtime-check-card" key={item.requirement.key}>
                    <div className="runtime-check-head">
                      <div className="runtime-check-copy">
                        <strong>{item.requirement.label}</strong>
                        <p>{item.requirement.summary}</p>
                      </div>
                      <div className="toolbar-inline">
                        {relevant ? <span className="status-badge status-running">{text('当前相关', 'Relevant')}</span> : null}
                        <span className={`status-badge status-${item.status}`}>{item.status}</span>
                      </div>
                    </div>

                    <div className="runtime-check-meta">
                      <span className="inspector-chip inspector-chip-muted">{item.requirement.requirement_type}</span>
                      <span className="runtime-check-detail">{item.detail}</span>
                    </div>

                    <div className="inspector-alert inspector-alert-muted">{item.requirement.install_hint}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </details>
      ))}
    </div>
  )
}
