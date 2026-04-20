import { useEffect, useRef, useState, type ReactNode } from 'react'


type ResizableSidebarProps = {
  children: ReactNode
  collapsedContent?: ReactNode
  side: 'left' | 'right'
  defaultWidth?: number
  minWidth?: number
  maxWidth?: number
  collapsed?: boolean
  collapsedWidth?: number
  className?: string
}


export function ResizableSidebar({
  children,
  collapsedContent,
  side,
  defaultWidth = 280,
  minWidth = 200,
  maxWidth = 600,
  collapsed = false,
  collapsedWidth = 44,
  className = '',
}: ResizableSidebarProps) {
  const [width, setWidth] = useState(defaultWidth)
  const [resizing, setResizing] = useState(false)
  const isResizing = useRef(false)

  const startResizing = () => {
    isResizing.current = true
    setResizing(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  useEffect(() => {
    const handleStopResizing = () => {
      if (isResizing.current) {
        setResizing(false)
      }
      isResizing.current = false
      document.body.style.cursor = 'default'
      document.body.style.userSelect = 'auto'
    }

    const handleResize = (e: MouseEvent) => {
      if (!isResizing.current) return

      if (side === 'left') {
        const newWidth = e.clientX
        if (newWidth >= minWidth && newWidth <= maxWidth) {
          setWidth(newWidth)
        }
      } else {
        const newWidth = window.innerWidth - e.clientX
        if (newWidth >= minWidth && newWidth <= maxWidth) {
          setWidth(newWidth)
        }
      }
    }

    window.addEventListener('mousemove', handleResize)
    window.addEventListener('mouseup', handleStopResizing)
    return () => {
      window.removeEventListener('mousemove', handleResize)
      window.removeEventListener('mouseup', handleStopResizing)
    }
  }, [maxWidth, minWidth, side])

  const resizerClass = side === 'left' ? 'resizer-right' : 'resizer-left'
  const transitionClass = resizing ? '' : 'transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]'

  if (collapsed) {
    return (
      <aside
        className={`${className} ${transitionClass} resizable-sidebar-collapsed flex h-full shrink-0 flex-col items-center overflow-hidden ${side === 'left' ? 'border-r' : 'border-l'}`}
        style={{ width: `${collapsedWidth}px` }}
      >
        {collapsedContent ? <div className="flex min-h-0 w-full flex-1">{collapsedContent}</div> : null}
      </aside>
    )
  }

  return (
    <aside
      className={`${className} ${transitionClass} relative flex shrink-0 flex-col overflow-visible`}
      style={{ width: `${width}px` }}
    >
      <div className="sidebar-motion-shell">
        {children}
      </div>
      <div
        className={`absolute inset-y-0 w-1 hover:bg-blue-500/30 cursor-col-resize transition-colors z-20 ${resizerClass}`}
        onMouseDown={startResizing}
        style={{ [side === 'left' ? 'right' : 'left']: '-2px' }}
      />
    </aside>
  )
}
