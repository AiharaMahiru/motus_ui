import { Children, Suspense, isValidElement, lazy, memo, useMemo, type ReactElement, type ReactNode } from 'react'

import rehypeHighlight from 'rehype-highlight'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import 'highlight.js/styles/github.css'

import { resolveEmbeddedVisualizationLanguage } from './embeddedVisualization'
import { RunnableCodeBlock } from '../../previews/components/RunnableCodeBlock'
import type { PreviewRequestLanguage } from '../../previews/previewCode'

const MermaidDiagramBlock = lazy(() =>
  import('./MermaidDiagramBlock').then((module) => ({ default: module.MermaidDiagramBlock })),
)
const StructuredChartBlock = lazy(() =>
  import('./StructuredChartBlock').then((module) => ({ default: module.StructuredChartBlock })),
)


type MarkdownPreviewContext = {
  activePreviewKey?: string
  isPreviewRunning?: boolean
  onRequestPreview?: (payload: {
    code: string
    key: string
    language: PreviewRequestLanguage
  }) => void
  sessionId?: string
}

type MarkdownMessageProps = {
  content: string
  previewContext?: MarkdownPreviewContext
}

function flattenChildren(children: ReactNode): string {
  if (typeof children === 'string') {
    return children
  }
  if (typeof children === 'number') {
    return String(children)
  }
  if (Array.isArray(children)) {
    return children.map(flattenChildren).join('')
  }
  if (isValidElement<{ children?: ReactNode }>(children)) {
    return flattenChildren(children.props.children)
  }
  return ''
}

function MarkdownCodeBlock({
  children,
  className,
  previewContext,
}: {
  children: ReactNode
  className?: string
  previewContext?: MarkdownPreviewContext
}) {
  const rawCode = flattenChildren(children).replace(/\n$/, '')
  const embeddedVisualizationLanguage = resolveEmbeddedVisualizationLanguage(className)

  if (embeddedVisualizationLanguage === 'mermaid') {
    return (
      <Suspense fallback={<div className="embedded-visualization-surface">正在加载 Mermaid 图表…</div>}>
        <MermaidDiagramBlock source={rawCode} />
      </Suspense>
    )
  }

  if (embeddedVisualizationLanguage === 'viz') {
    return (
      <Suspense fallback={<div className="embedded-visualization-surface">正在加载图表渲染器…</div>}>
        <StructuredChartBlock source={rawCode} />
      </Suspense>
    )
  }

  return (
    <RunnableCodeBlock
      activePreviewKey={previewContext?.activePreviewKey}
      className={className}
      isPreviewRunning={previewContext?.isPreviewRunning}
      onRequestPreview={previewContext?.onRequestPreview}
      sessionId={previewContext?.sessionId}
    >
      {rawCode}
    </RunnableCodeBlock>
  )
}

function createMarkdownComponents(previewContext?: MarkdownPreviewContext): Components {
  return {
    a({ children, href }) {
      return (
        <a href={href} rel="noreferrer" target="_blank">
          {children}
        </a>
      )
    },
    code({ children, className }) {
      const language = /language-(\w+)/.exec(className ?? '')?.[1]
      return (
        <code className={language ? `language-${language}` : undefined}>
          {children}
        </code>
      )
    },
    pre({ children }) {
      const child = Children.only(children) as ReactElement<{ children?: ReactNode; className?: string }>
      return (
        <MarkdownCodeBlock
          className={child.props.className}
          children={child.props.children}
          previewContext={previewContext}
        />
      )
    },
  }
}

function MarkdownMessageInner({ content, previewContext }: MarkdownMessageProps) {
  const components = useMemo(() => createMarkdownComponents(previewContext), [previewContext])

  return (
    <div className="markdown-content">
      <ReactMarkdown components={components} rehypePlugins={[rehypeHighlight]} remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  )
}

export const MarkdownMessage = memo(
  MarkdownMessageInner,
  (previous, next) =>
    previous.content === next.content &&
    previous.previewContext?.activePreviewKey === next.previewContext?.activePreviewKey &&
    previous.previewContext?.isPreviewRunning === next.previewContext?.isPreviewRunning &&
    previous.previewContext?.sessionId === next.previewContext?.sessionId &&
    previous.previewContext?.onRequestPreview === next.previewContext?.onRequestPreview,
)
