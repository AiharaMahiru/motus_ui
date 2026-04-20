import { MessageSquare, MoreHorizontal, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Workflow } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useI18n } from '../i18n/I18nContext'
import { WorkbenchPreferences } from './WorkbenchPreferences'


type WorkbenchMenuItem = {
  disabled?: boolean
  id: string
  label: string
  onSelect: () => void | Promise<void>
}

type WorkbenchModeSwitchProps = {
  activeMode: 'chat' | 'workflows'
  leftSidebarToggle?: {
    collapsed: boolean
    onToggle: () => void
  }
  moreMenuItems?: WorkbenchMenuItem[]
  rightSidebarToggle?: {
    collapsed: boolean
    onToggle: () => void
  }
  showMoreButton?: boolean
}


export function WorkbenchModeSwitch({
  activeMode,
  leftSidebarToggle,
  moreMenuItems = [],
  rightSidebarToggle,
  showMoreButton = true,
}: WorkbenchModeSwitchProps) {
  const navigate = useNavigate()
  const { text } = useI18n()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) {
      return undefined
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  return (
    <div className="topbar-shell">
      <div className="topbar-left-group">
        {leftSidebarToggle ? (
          <button
            aria-label={leftSidebarToggle.collapsed ? text('展开左侧栏', 'Expand left sidebar') : text('折叠左侧栏', 'Collapse left sidebar')}
            className="topbar-sidebar-button"
            title={leftSidebarToggle.collapsed ? text('展开左侧栏', 'Expand left sidebar') : text('折叠左侧栏', 'Collapse left sidebar')}
            type="button"
            onClick={leftSidebarToggle.onToggle}
          >
            {leftSidebarToggle.collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
          </button>
        ) : null}

        <div className="topbar-mode-switch">
          <button
            className={
              activeMode === 'chat'
                ? 'topbar-mode-button topbar-mode-button-active'
                : 'topbar-mode-button'
            }
            type="button"
            onClick={() => navigate('/chat')}
          >
            <MessageSquare size={14} />
            {text('会话', 'Chat')}
          </button>
          <button
            className={
              activeMode === 'workflows'
                ? 'topbar-mode-button topbar-mode-button-active'
                : 'topbar-mode-button'
            }
            type="button"
            onClick={() => navigate('/workflows')}
          >
            <Workflow size={14} />
            {text('工作流', 'Workflows')}
          </button>
        </div>
      </div>

      <div className="topbar-right-group">
        <WorkbenchPreferences />

        {showMoreButton && moreMenuItems.length ? (
          <div className="topbar-more-shell" ref={menuRef}>
            <button
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              className="topbar-more-button"
              type="button"
              onClick={() => setMenuOpen((current) => !current)}
            >
              <MoreHorizontal size={14} />
            </button>

            {menuOpen ? (
              <div className="topbar-menu" role="menu">
                {moreMenuItems.map((item) => (
                  <button
                    className="topbar-menu-item"
                    disabled={item.disabled}
                    key={item.id}
                    role="menuitem"
                    type="button"
                    onClick={async () => {
                      await item.onSelect()
                      setMenuOpen(false)
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {rightSidebarToggle ? (
          <button
            aria-label={rightSidebarToggle.collapsed ? text('展开右侧栏', 'Expand right sidebar') : text('折叠右侧栏', 'Collapse right sidebar')}
            className="topbar-sidebar-button"
            title={rightSidebarToggle.collapsed ? text('展开右侧栏', 'Expand right sidebar') : text('折叠右侧栏', 'Collapse right sidebar')}
            type="button"
            onClick={rightSidebarToggle.onToggle}
          >
            {rightSidebarToggle.collapsed ? <PanelRightOpen size={14} /> : <PanelRightClose size={14} />}
          </button>
        ) : null}
      </div>
    </div>
  )
}
