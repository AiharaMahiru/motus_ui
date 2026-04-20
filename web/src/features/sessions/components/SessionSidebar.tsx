import { LoaderCircle, MessageSquareText, Plus, Search, TerminalSquare, Trash2 } from 'lucide-react'

import type { SessionSummary } from '../../../shared/api/contracts'
import { useI18n } from '../../../shared/i18n/I18nContext'
import { formatCost, formatIsoTime } from '../../../shared/lib/format'
import { pickLocaleText } from '../../../shared/i18n/runtimeLocale'


type SessionSidebarProps = {
  sessions: SessionSummary[]
  selectedSessionId?: string
  deletingSessionId?: string
  searchTerm: string
  onSearchChange: (value: string) => void
  onSelectSession: (sessionId: string) => void
  onComposeNewSession: () => void
  onDeleteSession: (sessionId: string) => void
}

type SessionSidebarRailProps = {
  sessions: SessionSummary[]
  selectedSessionId?: string
  onSelectSession: (sessionId: string) => void
  onComposeNewSession: () => void
}

const SESSION_RAIL_TONES = [
  'bg-sky-50 text-sky-700 ring-sky-100',
  'bg-emerald-50 text-emerald-700 ring-emerald-100',
  'bg-amber-50 text-amber-700 ring-amber-100',
  'bg-violet-50 text-violet-700 ring-violet-100',
  'bg-rose-50 text-rose-700 ring-rose-100',
  'bg-slate-100 text-slate-700 ring-slate-200',
]

function hashSessionKey(value: string) {
  let hash = 0
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  }
  return hash
}

function resolveSessionRailTone(sessionId: string) {
  return SESSION_RAIL_TONES[hashSessionKey(sessionId) % SESSION_RAIL_TONES.length]
}

function buildSessionRailLabel(session: SessionSummary) {
  const title = session.title?.trim()
  if (title) {
    const compactTitle = title.replace(/\s+/g, '')
    if (/[\u4e00-\u9fff]/.test(compactTitle)) {
      return compactTitle.slice(0, 2)
    }

    const words = title
      .split(/\s+/)
      .map((word) => word.trim())
      .filter(Boolean)
      .slice(0, 2)
    const initials = words.map((word) => word[0]?.toUpperCase()).join('')
    if (initials) {
      return initials
    }
    return compactTitle.slice(0, 2).toUpperCase()
  }

  return session.session_id.slice(0, 2).toUpperCase()
}

function buildSessionRailTitle(session: SessionSummary) {
  const title = session.title?.trim() || `${pickLocaleText('会话', 'Session')} ${session.session_id.slice(0, 8)}`
  return `${title}\n${formatIsoTime(session.updated_at)}`
}

export function SessionSidebarRail({
  sessions,
  selectedSessionId,
  onSelectSession,
  onComposeNewSession,
}: SessionSidebarRailProps) {
  const { text } = useI18n()
  return (
    <div className="session-rail">
      <div className="session-rail-header">
        <div className="session-rail-actions">
          <button
            aria-label={text('新建会话', 'New session')}
            className="session-rail-icon-button"
            title={text('新建会话', 'New session')}
            type="button"
            onClick={onComposeNewSession}
          >
            <Plus size={15} />
          </button>
        </div>
      </div>

      <div className="session-rail-body">
        <div aria-hidden="true" className="session-rail-divider" />

        <div className="session-rail-list" data-testid="session-rail">
          {sessions.length === 0 ? (
            <div className="session-rail-empty" title={text('暂无会话', 'No sessions')}>
              <MessageSquareText size={15} />
            </div>
          ) : null}

          {sessions.map((session) => {
            const isSelected = selectedSessionId === session.session_id
            return (
              <button
                aria-label={text('切换到会话', 'Switch to session') + ` ${session.title?.trim() || session.session_id.slice(0, 8)}`}
                className={isSelected ? 'session-rail-button session-rail-button-active' : 'session-rail-button'}
                data-active={isSelected ? 'true' : 'false'}
                key={session.session_id}
                title={buildSessionRailTitle(session)}
                type="button"
                onClick={() => onSelectSession(session.session_id)}
              >
                <span
                  className={
                    isSelected
                      ? 'session-rail-badge session-rail-badge-active'
                      : `session-rail-badge ${resolveSessionRailTone(session.session_id)}`
                  }
                >
                  {buildSessionRailLabel(session)}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}


export function SessionSidebar({
  sessions,
  selectedSessionId,
  deletingSessionId,
  searchTerm,
  onSearchChange,
  onSelectSession,
  onComposeNewSession,
  onDeleteSession,
}: SessionSidebarProps) {
  const { text } = useI18n()
  return (
    <aside className="workspace-sidebar">
      <div className="sidebar-brandbar">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="sidebar-brandmark">
            <TerminalSquare size={15} />
          </div>
          <div className="sidebar-brandcopy">
            <h1 className="sidebar-brandtitle">MOTUS</h1>
            <p className="sidebar-brandsubtitle">Workbench</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button className="primary-action-button !h-8 !rounded-lg !px-2.5" type="button" onClick={onComposeNewSession}>
            <Plus size={12} />
            <span>{text('新会话', 'New')}</span>
          </button>
        </div>
      </div>

      <div className="sidebar-searchbar">
        <label className="relative block">
          <span className="sidebar-searchicon">
            <Search size={14} />
          </span>
          <input
            className="sidebar-searchinput"
            placeholder={text('搜索会话...', 'Search sessions...')}
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>
      </div>

      <div className="sidebar-list !p-3 !gap-2" data-testid="session-list">
        {sessions.length === 0 ? (
          <div className="empty-state compact-empty-state !border-none !bg-transparent">
            <p className="text-[10px] uppercase font-bold tracking-tighter text-zinc-400">
              {text('暂无会话历史', 'No session history')}
            </p>
          </div>
        ) : null}

        {sessions.map((session) => {
          const isSelected = selectedSessionId === session.session_id
          const isDeleting = deletingSessionId === session.session_id
          const showStatus = session.status !== 'idle'
          return (
            <div key={session.session_id} className="relative group">
              <button
                className={
                  isSelected
                    ? 'sidebar-card sidebar-card-active !gap-1.5 !rounded-xl !px-3.5 !py-2.5'
                    : 'sidebar-card !gap-1.5 !rounded-xl !px-3.5 !py-2.5'
                }
                type="button"
                disabled={isDeleting}
                onClick={() => onSelectSession(session.session_id)}
              >
                <div className="mb-0 flex w-full items-center justify-between gap-2">
                  <strong className="sidebar-card-title !mb-0 !text-[12px] !leading-tight">
                    {session.title?.trim() || `${text('ID', 'ID')}: ${session.session_id.slice(0, 8)}`}
                  </strong>
                  {showStatus ? (
                    <span className={`status-badge !text-[8.5px] !px-1.5 !py-0.5 status-${session.status}`}>{session.status}</span>
                  ) : null}
                </div>

                <div className="sidebar-card-meta !w-full !gap-1.5 !text-[9px] !tracking-tight">
                  <span className="sidebar-model-badge max-w-[102px] truncate !rounded-md !px-1.5 !py-0.5 !text-[8px]">
                    {session.model_name.split('/').pop()}
                  </span>
                  <span className="opacity-40">·</span>
                  <span>{formatIsoTime(session.updated_at)}</span>
                  <span className="opacity-40">·</span>
                  <span className="truncate">{formatCost(session.total_cost_usd)}</span>
                </div>
              </button>
              
              <button
                aria-label={(isDeleting ? text('正在删除会话', 'Deleting session') : text('删除会话', 'Delete session')) + ` ${session.title?.trim() || session.session_id.slice(0, 8)}`}
                className="sidebar-delete-button !bottom-auto !right-2 !top-1/2 !z-10 !flex !h-8 !w-8 -translate-y-1/2 !items-center !justify-center !p-0"
                disabled={isDeleting}
                title={isDeleting ? text('正在删除...', 'Deleting...') : text('删除会话', 'Delete session')}
                onPointerDown={(event) => {
                  event.stopPropagation()
                }}
                onMouseDown={(event) => {
                  event.stopPropagation()
                }}
                onClick={(event) => {
                  event.stopPropagation()
                  onDeleteSession(session.session_id)
                }}
                type="button"
              >
                {isDeleting ? <LoaderCircle className="animate-spin" size={12} /> : <Trash2 size={12} />}
              </button>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
