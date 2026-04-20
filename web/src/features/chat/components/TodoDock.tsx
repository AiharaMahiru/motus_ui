import { cn } from '../../../shared/lib/cn'
import { useMemo, useState } from 'react'

import { CheckCircle2, ChevronDown, Circle, ListTodo, LoaderCircle } from 'lucide-react'

import { useI18n } from '../../../shared/i18n/I18nContext'
import type { TodoItem } from './todoMessage'


type TodoDockProps = {
  className?: string
  items: TodoItem[]
}

function TodoStatusIcon({ status }: { status: string }) {
  const normalized = status.toLowerCase()
  if (normalized.includes('progress') || normalized.includes('running')) {
    return <LoaderCircle size={14} className="animate-spin text-blue-600" />
  }
  if (normalized.includes('complete') || normalized.includes('done')) {
    return <CheckCircle2 size={14} className="text-emerald-600" />
  }
  return <Circle size={14} className="text-slate-400" />
}

export function TodoDock({ items, className }: TodoDockProps) {
  const { text } = useI18n()
  const [expanded, setExpanded] = useState(false)

  const summary = useMemo(() => {
    if (!items.length) {
      return {
        activeLabel: text('暂无待办', 'No todo items'),
        completed: 0,
        pending: 0,
        running: 0,
      }
    }

    const completed = items.filter((item) => item.status.toLowerCase().includes('complete') || item.status.toLowerCase().includes('done')).length
    const running = items.filter((item) => item.status.toLowerCase().includes('progress') || item.status.toLowerCase().includes('running')).length
    const pending = items.length - completed - running
    const activeLabel = items.find((item) => item.activeForm?.trim())?.activeForm || items[0].content

    return {
      activeLabel,
      completed,
      pending,
      running,
    }
  }, [items, text])

  return (
    <section className={cn('todo-dock', className)}>
      <button
        aria-expanded={expanded}
        className="todo-dock-header"
        type="button"
        onClick={() => setExpanded((current) => !current)}
      >
        <div className="todo-dock-title-row">
          <span className="todo-dock-title">
            <ListTodo size={14} />
            TODO
          </span>
          <span className="todo-dock-count">{items.length} {text('项', 'items')}</span>
          <span className="todo-dock-pill todo-dock-pill-running">{summary.running} {text('进行中', 'running')}</span>
          <span className="todo-dock-pill">{summary.pending} {text('待处理', 'pending')}</span>
          <span className="todo-dock-pill todo-dock-pill-completed">{summary.completed} {text('已完成', 'done')}</span>
          <span className="todo-dock-summary">{summary.activeLabel}</span>
        </div>
        <ChevronDown className={expanded ? 'todo-dock-chevron todo-dock-chevron-open' : 'todo-dock-chevron'} size={16} />
      </button>

      {expanded ? (
        <div className="todo-dock-body">
          {items.length === 0 ? (
            <div className="todo-dock-empty">{text('当前没有待办。', 'No todo items right now.')}</div>
          ) : (
            items.map((item) => (
              <div className="todo-dock-item" key={`${item.content}:${item.status}`}>
                <TodoStatusIcon status={item.status} />
                <div className="min-w-0 flex-1">
                  <div className="todo-dock-item-content">{item.content}</div>
                  {item.activeForm ? <div className="todo-dock-item-active">{item.activeForm}</div> : null}
                </div>
                <span className="todo-dock-item-status">{item.status}</span>
              </div>
            ))
          )}
        </div>
      ) : null}
    </section>
  )
}
