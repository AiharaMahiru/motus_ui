import type { CSSProperties } from 'react'
import {
  LoaderCircle,
  type LucideIcon,
  MessageSquareText,
  PanelsTopLeft,
  Search,
  Settings2,
  Sparkles,
  Workflow,
} from 'lucide-react'

import { useI18n } from '../i18n/I18nContext'

type WorkbenchLoadingScreenProps = {
  message?: string
  subtitle?: string
}

type StatusChipProps = {
  icon: LucideIcon
  label: string
}

type SkeletonLineProps = {
  className?: string
}

function StatusChip({ icon: Icon, label }: StatusChipProps) {
  return (
    <span
      className="inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[11px] font-semibold shadow-sm backdrop-blur"
      style={{
        borderColor: 'var(--app-border)',
        background: 'var(--app-surface-elevated)',
        color: 'var(--app-text-soft)',
      }}
    >
      <Icon className="h-3.5 w-3.5" style={{ color: 'var(--app-text-muted)' }} />
      <span>{label}</span>
    </span>
  )
}

function SkeletonLine({ className = '' }: SkeletonLineProps) {
  return (
    <div
      className={`overflow-hidden rounded-full ${className}`}
      style={{ background: 'color-mix(in srgb, var(--app-surface-strong) 82%, transparent)' }}
    >
      <div
        className="h-full w-[58%] rounded-full motion-safe:animate-pulse"
        style={{
          background:
            'linear-gradient(90deg, color-mix(in srgb, var(--app-surface-strong) 84%, transparent) 0%, var(--app-surface-elevated) 50%, color-mix(in srgb, var(--app-surface-strong) 84%, transparent) 100%)',
        }}
      />
    </div>
  )
}

function SessionCardSkeleton() {
  return (
    <div
      className="rounded-[1.2rem] border p-4 shadow-sm"
      style={{
        borderColor: 'var(--app-border)',
        background: 'var(--app-surface)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <SkeletonLine className="h-3.5 w-28" />
          <SkeletonLine className="mt-2 h-2.5 w-20" />
        </div>
        <div
          className="h-6 w-12 rounded-full border"
          style={{
            borderColor: 'var(--app-border)',
            background: 'var(--app-surface-soft)',
          }}
        />
      </div>
      <div className="mt-4 space-y-2">
        <SkeletonLine className="h-2.5 w-full" />
        <SkeletonLine className="h-2.5 w-2/3" />
      </div>
    </div>
  )
}

function MessageSkeleton({ user = false, lines = 3 }: { user?: boolean; lines?: number }) {
  const bubbleStyle: CSSProperties = user
    ? {
        borderColor: 'color-mix(in srgb, var(--app-accent) 22%, var(--app-border))',
        background: 'color-mix(in srgb, var(--app-accent-soft) 72%, var(--app-surface))',
      }
    : {
        borderColor: 'var(--app-border)',
        background: 'var(--app-surface)',
      }
  return (
    <div className={`flex ${user ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`w-full max-w-[min(100%,42rem)] rounded-[1.4rem] border px-4 py-3 shadow-sm ${user ? 'rounded-tr-md' : 'rounded-tl-md'}`}
        style={bubbleStyle}
      >
        <div
          className={`mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] ${user ? 'justify-end' : ''}`}
          style={{ color: user ? 'var(--app-accent-text)' : 'var(--app-text-muted)' }}
        >
          {user ? 'User' : 'Assistant'}
        </div>
        <div className="space-y-2.5">
          {Array.from({ length: lines }).map((_, index) => (
            <SkeletonLine
              key={`${user ? 'user' : 'assistant'}-${index}`}
              className={`h-3 ${index === lines - 1 ? 'w-2/3' : 'w-full'}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function InspectorCardSkeleton({
  title,
  rows = 3,
}: {
  title: string
  rows?: number
}) {
  return (
    <section
      className="rounded-[1.15rem] border p-4 shadow-sm"
      style={{
        borderColor: 'var(--app-border)',
        background: 'var(--app-surface)',
      }}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: 'var(--app-text-muted)' }}>{title}</div>
        <div
          className="h-6 w-16 rounded-full border"
          style={{
            borderColor: 'var(--app-border)',
            background: 'var(--app-surface-soft)',
          }}
        />
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={`${title}-${index}`}
            className="space-y-2 rounded-2xl border p-3"
            style={{
              borderColor: 'color-mix(in srgb, var(--app-border) 82%, transparent)',
              background: 'color-mix(in srgb, var(--app-surface-soft) 72%, transparent)',
            }}
          >
            <SkeletonLine className="h-2.5 w-20" />
            <SkeletonLine className="h-3 w-full" />
            {index === rows - 1 ? null : <SkeletonLine className="h-3 w-2/3" />}
          </div>
        ))}
      </div>
    </section>
  )
}

export function WorkbenchLoadingScreen({
  message = '正在加载工作台...',
  subtitle = '正在初始化会话视图、运行时能力与面板状态',
}: WorkbenchLoadingScreenProps) {
  const { text } = useI18n()
  const resolvedMessage = message === '正在加载工作台...' ? text('正在加载工作台...', 'Loading workbench...') : message
  const resolvedSubtitle =
    subtitle === '正在初始化会话视图、运行时能力与面板状态'
      ? text('正在初始化会话视图、运行时能力与面板状态', 'Initializing sessions, runtime capabilities, and panel state')
      : subtitle
  return (
    <section
      aria-busy="true"
      aria-live="polite"
      role="status"
      className="workbench-loading-screen relative flex h-full min-h-0 w-full flex-col overflow-hidden"
      style={{
        background:
          'linear-gradient(180deg, color-mix(in srgb, var(--app-bg) 86%, var(--app-surface-soft)) 0%, var(--app-bg) 100%)',
        color: 'var(--app-text)',
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-8%] top-[-12%] h-56 w-56 rounded-full blur-3xl" style={{ background: 'var(--app-orb-blue)' }} />
        <div className="absolute right-[-10%] top-[12%] h-64 w-64 rounded-full blur-3xl" style={{ background: 'var(--app-orb-emerald)' }} />
        <div className="absolute bottom-[-16%] left-[28%] h-72 w-72 rounded-full blur-3xl" style={{ background: 'var(--app-orb-violet)' }} />
      </div>

      <header
        className="relative z-10 flex h-12 shrink-0 items-center justify-between border-b px-3 sm:px-4"
        style={{
          borderColor: 'var(--app-border)',
          background: 'var(--app-surface-elevated)',
        }}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-950 text-white shadow-sm">
            <PanelsTopLeft className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: 'var(--app-text-muted)' }}>
              Motus Workbench
            </div>
          </div>
        </div>

        <div
          className="hidden items-center gap-1 rounded-xl border p-0.5 sm:flex"
          style={{
            borderColor: 'var(--app-border)',
            background: 'var(--app-surface-soft)',
          }}
        >
          <span
            className="inline-flex h-7 items-center rounded-lg px-3 text-[12px] font-bold shadow-sm"
            style={{
              background: 'var(--app-surface)',
              color: 'var(--app-text)',
            }}
          >
            {text('会话', 'Chat')}
          </span>
          <span className="inline-flex h-7 items-center rounded-lg px-3 text-[12px] font-medium" style={{ color: 'var(--app-text-muted)' }}>
            {text('工作流', 'Workflow')}
          </span>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-3 py-1.5 text-[11px] font-black text-sky-700 shadow-sm">
          <LoaderCircle className="h-3.5 w-3.5 motion-safe:animate-spin" />
          <span>{text('加载中', 'Loading')}</span>
        </div>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_320px]">
        <aside
          className="hidden min-h-0 border-r lg:flex lg:flex-col"
          style={{
            borderColor: 'var(--app-border)',
            background: 'var(--app-surface)',
          }}
        >
          <div className="flex items-center justify-between border-b px-4 py-4" style={{ borderColor: 'var(--app-border)' }}>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: 'var(--app-text-muted)' }}>{text('会话', 'Sessions')}</div>
              <div className="mt-1 text-sm font-black tracking-tight" style={{ color: 'var(--app-text)' }}>{text('历史记录', 'History')}</div>
            </div>
            <div className="h-8 w-8 rounded-xl border" style={{ borderColor: 'var(--app-border)', background: 'var(--app-surface-soft)' }} />
          </div>

          <div className="border-b px-4 py-3" style={{ borderColor: 'var(--app-border)' }}>
            <div
              className="flex h-10 items-center gap-2 rounded-2xl border px-3"
              style={{
                borderColor: 'var(--app-border)',
                background: 'color-mix(in srgb, var(--app-surface-soft) 78%, transparent)',
                color: 'var(--app-text-muted)',
              }}
            >
              <Search className="h-4 w-4" />
              <SkeletonLine className="h-2.5 flex-1" />
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3">
            <SessionCardSkeleton />
            <SessionCardSkeleton />
            <SessionCardSkeleton />
            <div className="hidden 2xl:block">
              <SessionCardSkeleton />
            </div>
          </div>
        </aside>

        <main className="relative flex min-h-0 flex-1 flex-col" style={{ background: 'var(--app-surface)' }}>
          <div
            className="border-b px-4 py-4 sm:px-6"
            style={{
              borderColor: 'var(--app-border)',
              background: 'var(--app-surface)',
            }}
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: 'var(--app-text-muted)' }}>Workbench</div>
                <h1 className="mt-1 text-base font-black tracking-tight sm:text-lg" style={{ color: 'var(--app-text)' }}>{resolvedMessage}</h1>
                <p className="mt-1 max-w-2xl text-sm leading-6" style={{ color: 'var(--app-text-muted)' }}>{resolvedSubtitle}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <StatusChip icon={MessageSquareText} label={text('会话状态同步中', 'Syncing session state')} />
                <StatusChip icon={Workflow} label={text('工作流能力预热中', 'Warming workflow capabilities')} />
                <StatusChip icon={Settings2} label={text('配置面板就绪中', 'Preparing config panel')} />
              </div>
            </div>
          </div>

          <div
            className="border-b px-4 py-3 sm:px-6 xl:hidden"
            style={{
              borderColor: 'var(--app-border)',
              background: 'color-mix(in srgb, var(--app-surface-soft) 72%, transparent)',
            }}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border p-3 shadow-sm" style={{ borderColor: 'var(--app-border)', background: 'var(--app-surface)' }}>
                <div className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--app-text-muted)' }}>{text('会话', 'Sessions')}</div>
                <SkeletonLine className="mt-3 h-3 w-20" />
                <SkeletonLine className="mt-2 h-2.5 w-full" />
              </div>
              <div className="rounded-2xl border p-3 shadow-sm" style={{ borderColor: 'var(--app-border)', background: 'var(--app-surface)' }}>
                <div className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--app-text-muted)' }}>{text('运行时', 'Runtime')}</div>
                <SkeletonLine className="mt-3 h-3 w-24" />
                <SkeletonLine className="mt-2 h-2.5 w-3/4" />
              </div>
              <div className="rounded-2xl border p-3 shadow-sm sm:col-span-1" style={{ borderColor: 'var(--app-border)', background: 'var(--app-surface)' }}>
                <div className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--app-text-muted)' }}>{text('追踪', 'Tracing')}</div>
                <SkeletonLine className="mt-3 h-3 w-16" />
                <SkeletonLine className="mt-2 h-2.5 w-4/5" />
              </div>
            </div>
          </div>

          <div
            className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
            style={{
              background:
                'linear-gradient(180deg, color-mix(in srgb, var(--app-surface-soft) 72%, transparent) 0%, var(--app-surface) 28%)',
            }}
          >
            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-hidden px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
              <div
                className="rounded-[1.25rem] border px-4 py-3 shadow-sm"
                style={{
                  borderColor: 'var(--app-border)',
                  background: 'var(--app-surface-elevated)',
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--app-text-muted)' }}>{text('当前区域', 'Current area')}</div>
                    <div className="mt-1 text-sm font-black" style={{ color: 'var(--app-text)' }}>{text('会话工作区骨架正在加载', 'Chat workspace skeleton is loading')}</div>
                  </div>
                  <div
                    className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold"
                    style={{
                      background: 'var(--app-surface-soft)',
                      color: 'var(--app-text-muted)',
                    }}
                  >
                    <Sparkles className="h-3.5 w-3.5" style={{ color: 'var(--app-text-muted)' }} />
                    {text('正在恢复布局与内容占位', 'Restoring layout and content placeholders')}
                  </div>
                </div>
              </div>

              <div
                className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden rounded-[1.5rem] border p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:p-4"
                style={{
                  borderColor: 'var(--app-border)',
                  background: 'color-mix(in srgb, var(--app-surface-soft) 68%, transparent)',
                }}
              >
                <div className="min-h-0 flex-1 space-y-4 overflow-hidden sm:space-y-5">
                  <MessageSkeleton lines={2} />
                  <MessageSkeleton user lines={2} />
                  <MessageSkeleton lines={4} />
                  <div className="hidden sm:block">
                    <MessageSkeleton user lines={1} />
                  </div>
                </div>
              </div>
            </div>

          <div className="pointer-events-none shrink-0 px-3 pb-3 sm:px-5 sm:pb-5 lg:px-8 lg:pb-6">
              <div
                className="rounded-[1.35rem] border p-3 shadow-[0_20px_36px_-24px_rgba(15,23,42,0.32)] backdrop-blur-xl"
                style={{
                  borderColor: 'var(--app-border)',
                  background: 'var(--app-surface-elevated)',
                }}
              >
                <div
                  className="flex min-h-[68px] items-start gap-3 rounded-[1.15rem] border px-4 py-3"
                  style={{
                    borderColor: 'var(--app-border)',
                    background: 'color-mix(in srgb, var(--app-surface-soft) 78%, transparent)',
                  }}
                >
                  <div className="pt-0.5" style={{ color: 'var(--app-text-faint)' }}>
                    <MessageSquareText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2.5">
                    <SkeletonLine className="h-3 w-4/5" />
                    <SkeletonLine className="h-3 w-2/5" />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <div className="h-8 w-20 rounded-full border" style={{ borderColor: 'var(--app-border)', background: 'var(--app-surface-soft)' }} />
                    <div className="h-8 w-16 rounded-full border" style={{ borderColor: 'var(--app-border)', background: 'var(--app-surface-soft)' }} />
                    <div className="h-8 w-16 rounded-full border" style={{ borderColor: 'var(--app-border)', background: 'var(--app-surface-soft)' }} />
                    <div className="hidden h-8 w-16 rounded-full border sm:block" style={{ borderColor: 'var(--app-border)', background: 'var(--app-surface-soft)' }} />
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-xl border" style={{ borderColor: 'var(--app-border)', background: 'var(--app-surface-soft)' }} />
                    <div className="h-9 w-24 rounded-xl bg-slate-900 shadow-sm" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        <aside
          className="hidden min-h-0 border-l xl:flex xl:flex-col"
          style={{
            borderColor: 'var(--app-border)',
            background: 'color-mix(in srgb, var(--app-surface-soft) 72%, transparent)',
          }}
        >
          <div className="grid grid-cols-4 border-b px-3 py-3" style={{ borderColor: 'var(--app-border)', background: 'var(--app-surface)' }}>
            {[text('会话', 'Session'), text('追踪', 'Tracing'), text('运行时', 'Runtime'), text('元信息', 'Meta')].map((item, index) => (
              <div
                key={item}
                className={`flex h-8 items-center justify-center rounded-lg text-[12px] font-semibold ${
                  index === 0 ? '' : ''
                }`}
                style={index === 0 ? { background: 'var(--app-surface-soft)', color: 'var(--app-text)' } : { color: 'var(--app-text-muted)' }}
              >
                {item}
              </div>
            ))}
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4">
            <InspectorCardSkeleton title={text('系统提示词', 'System prompt')} rows={2} />
            <InspectorCardSkeleton title={text('工具与 MCP', 'Tools & MCP')} rows={3} />
            <InspectorCardSkeleton title={text('多代理与运行时', 'Multi-agent & runtime')} rows={2} />
          </div>
        </aside>
      </div>
    </section>
  )
}
