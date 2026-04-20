import type { InspectorTabId } from '../../app/LayoutContext'


type InspectorHeaderTab = {
  id: InspectorTabId
  label: string
}


type InspectorHeaderProps = {
  activeTab: InspectorTabId
  tabs: InspectorHeaderTab[]
  onChange: (tabId: InspectorTabId) => void
}


export function InspectorHeader({
  activeTab,
  tabs,
  onChange,
}: InspectorHeaderProps) {
  return (
    <div className="inspector-header">
      <div className="inspector-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? 'inspector-tab inspector-tab-active' : 'inspector-tab'}
            type="button"
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}
