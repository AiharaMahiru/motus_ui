import { useState } from 'react'

import { ChevronDown, ListChecks } from 'lucide-react'

import type { ChatMessage } from '../../../shared/api/contracts'
import { useI18n } from '../../../shared/i18n/I18nContext'
import type { StepEntry, StepGroup } from '../../../shared/lib/storage'
import { formatIsoTime } from '../../../shared/lib/format'
import { ToolMessageBatchCard } from './ToolMessageGroup'
import { batchToolMessages, resolveMessageTimestamp } from './toolMessageGrouping'
import { parseTodoToolCall } from './todoMessage'


type StepGroupCardProps = {
  deleteDisabled?: boolean
  group: StepGroup
  live?: boolean
  onDeleteToolBatch?: (messages: ChatMessage[]) => void
  toolMessages?: ChatMessage[]
}

type ToolCallLike = {
  function?: {
    name?: string | null
  } | null
  name?: string | null
}

type TimelineStep = {
  step: StepEntry
  toolBatches: ChatMessage[][]
}

function toTimestampMs(value?: string) {
  if (!value) {
    return undefined
  }
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : undefined
}

function resolveBatchTimestamp(messages: ChatMessage[]) {
  const firstTimestamp = resolveMessageTimestamp(messages[0])
  if (firstTimestamp) {
    return firstTimestamp
  }
  const lastMessage = messages[messages.length - 1]
  return lastMessage ? resolveMessageTimestamp(lastMessage) : undefined
}

function buildTimelineSteps(steps: StepEntry[], toolBatches: ChatMessage[][]) {
  if (steps.length === 0) {
    return [] as TimelineStep[]
  }

  const items = steps.map((step) => ({
    step,
    toolBatches: [] as ChatMessage[][],
  }))

  let batchIndex = 0

  for (let stepIndex = 0; stepIndex < steps.length; stepIndex += 1) {
    const nextStep = steps[stepIndex + 1]
    const nextStepTimestamp = toTimestampMs(nextStep?.timestamp)
    const isLastStep = stepIndex === steps.length - 1

    while (batchIndex < toolBatches.length) {
      const batch = toolBatches[batchIndex]
      const batchTimestamp = toTimestampMs(resolveBatchTimestamp(batch))
      const belongsToCurrentStep =
        isLastStep ||
        batchTimestamp === undefined ||
        nextStepTimestamp === undefined ||
        batchTimestamp < nextStepTimestamp

      if (!belongsToCurrentStep) {
        break
      }

      items[stepIndex].toolBatches.push(batch)
      batchIndex += 1
    }
  }

  while (batchIndex < toolBatches.length && items.length) {
    items[items.length - 1].toolBatches.push(toolBatches[batchIndex])
    batchIndex += 1
  }

  return items
}

function buildLatestStepLabel(
  steps: StepEntry[],
  live: boolean,
  toolBatches: ChatMessage[][],
  visibleToolCalls: (toolCalls: ToolCallLike[]) => ToolCallLike[],
  resolveToolCallName: (toolCall: ToolCallLike) => string,
  text: (zh: string, en: string) => string,
) {
  const lastStep = steps[steps.length - 1]
  if (!lastStep) {
    if (toolBatches.length) {
      return `${toolBatches.length} ${text('个工具批次已记录', 'tool batches recorded')}`
    }
    return live
      ? text('等待系统返回更多状态...', 'Waiting for more runtime status...')
      : text('当前轮次没有记录到步骤遥测', 'No step telemetry recorded for this turn')
  }
  if (lastStep.content?.trim()) {
    return lastStep.content.trim()
  }
  const calls = visibleToolCalls(lastStep.toolCalls)
  if (calls.length > 0) {
    return `${text('调用', 'Called')} ${calls.map((toolCall) => resolveToolCallName(toolCall)).join(', ')}`
  }
  return text('步骤已记录', 'Step recorded')
}


export function StepGroupCard({
  group,
  live = false,
  toolMessages = [],
  onDeleteToolBatch,
  deleteDisabled = false,
}: StepGroupCardProps) {
  const { text } = useI18n()
  const [expanded, setExpanded] = useState(false)

  function resolveToolCallName(toolCall: ToolCallLike) {
    return toolCall.function?.name || toolCall.name || 'unknown'
  }

  function visibleToolCalls(toolCalls: ToolCallLike[]) {
    return toolCalls.filter((toolCall) => !parseTodoToolCall(toolCall as Record<string, unknown>)?.length)
  }

  const toolBatches = batchToolMessages(toolMessages)
  const timelineSteps = buildTimelineSteps(group.steps, toolBatches)
  const latestStep = buildLatestStepLabel(group.steps, live, toolBatches, visibleToolCalls, resolveToolCallName, text)

  return (
    <section className="step-group-card">
      <button
        aria-expanded={expanded}
        className="step-group-summary"
        type="button"
        onClick={() => setExpanded((current) => !current)}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="step-group-title">
              <ListChecks size={14} />
              {text('执行时间线', 'Execution timeline')}
            </span>
            <span className="step-group-count">{group.steps.length} {text('步', 'steps')}</span>
            {toolBatches.length ? <span className="step-group-count">{toolBatches.length} {text('批工具', 'tool batches')}</span> : null}
            {live ? (
              <div className="thinking-container">
                <div className="thinking-dot" />
                <span>{text('运行中', 'Running')}</span>
              </div>
            ) : null}
          </div>
          <div className="step-group-latest">{latestStep}</div>
        </div>

        <div className="step-group-summary-meta">
          <span className="text-[10px] font-mono text-zinc-400">{formatIsoTime(group.createdAt)}</span>
          <ChevronDown className={expanded ? 'step-group-chevron step-group-chevron-open' : 'step-group-chevron'} size={16} />
        </div>
      </button>

      {expanded ? (
        <>
          <div className="step-group-copy">
            <span className="step-group-copy-label">{text('用户请求', 'User request')}</span>
            <p className="step-group-copy-content">{group.userContent}</p>
          </div>

          <div className="step-group-body">
            <div className="step-group-timeline">
              {timelineSteps.length === 0 && !live ? (
                <div className="step-timeline-item">
                  <div className="step-timeline-rail">
                    <span className="step-timeline-dot" />
                  </div>
                  <div className="step-node-card step-node-card-empty">
                    <div className="step-node-meta">
                      <span className="step-node-agent step-node-agent-muted">SYSTEM</span>
                      <span className="step-node-time">{formatIsoTime(group.createdAt)}</span>
                    </div>
                    <p className="step-node-content step-node-content-muted">
                      {text('当前轮次没有记录到步骤遥测', 'No step telemetry recorded for this turn')}
                    </p>
                  </div>
                </div>
              ) : null}

              {timelineSteps.map((item, index) => {
                const calls = visibleToolCalls(item.step.toolCalls)
                const isLastStep = index === timelineSteps.length - 1
                const shouldRenderLine = !isLastStep || item.toolBatches.length > 0

                if (!item.step.content?.trim() && calls.length === 0 && item.toolBatches.length === 0) {
                  return null
                }

                return (
                  <div className="step-timeline-item" key={`${group.turnId}:${item.step.timestamp}:${index}`}>
                    <div className="step-timeline-rail">
                      <span className={live && isLastStep ? 'step-timeline-dot step-timeline-dot-live' : 'step-timeline-dot'} />
                      {shouldRenderLine ? <span className="step-timeline-line" /> : null}
                    </div>

                    <div className="step-timeline-main">
                      <div className={live && isLastStep ? 'step-node-card step-node-card-live' : 'step-node-card'}>
                        <div className="step-node-header">
                          <div className="step-node-meta">
                            <span className="step-node-agent">{item.step.agentName?.toUpperCase() || 'AGENT'}</span>
                            <span className="step-node-time">{formatIsoTime(item.step.timestamp)}</span>
                            {calls.length ? <span className="step-node-badge">{calls.length} {text('个工具', 'tools')}</span> : null}
                          </div>
                          {live && isLastStep ? (
                            <div className="thinking-container">
                              <div className="thinking-dot" />
                              <span>{text('运行中', 'Running')}</span>
                            </div>
                          ) : null}
                        </div>

                        {item.step.content?.trim() ? <p className="step-node-content">{item.step.content.trim()}</p> : null}

                        {calls.length ? (
                          <div className="step-node-tools">
                            {calls.map((toolCall, toolIndex) => (
                              <span className="step-node-tool" key={`${group.turnId}:${item.step.timestamp}:${toolIndex}`}>
                                {resolveToolCallName(toolCall)}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      {item.toolBatches.length ? (
                        <div className="step-node-children">
                          {item.toolBatches.map((batch, batchIndex) => {
                            const isLastBatch = batchIndex === item.toolBatches.length - 1
                            return (
                              <div className="step-child-node" key={`${group.turnId}:${item.step.timestamp}:tool:${batchIndex}`}>
                                <div className="step-child-node-rail">
                                  <span className="step-child-node-dot" />
                                  {!isLastBatch ? <span className="step-child-node-line" /> : null}
                                </div>
                                <div className="step-child-node-body">
                                  <ToolMessageBatchCard
                                    deleteDisabled={deleteDisabled}
                                    defaultExpanded={false}
                                    index={batchIndex}
                                    messages={batch}
                                    nested
                                    onDelete={onDeleteToolBatch}
                                  />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              })}

              {live && timelineSteps.length === 0 ? (
                <div className="step-timeline-item">
                  <div className="step-timeline-rail">
                    <span className="step-timeline-dot step-timeline-dot-live" />
                  </div>
                  <div className="step-node-card step-node-card-live">
                    <div className="step-node-meta">
                      <span className="step-node-agent">AGENT</span>
                      <span className="step-node-time">进行中</span>
                    </div>
                    <p className="step-node-content step-node-content-muted">等待系统返回更多状态...</p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </>
      ) : null}

      {group.errorMessage ? <div className="p-2 m-2 bg-red-50 border border-red-100 rounded text-[11px] text-red-600">{group.errorMessage}</div> : null}
    </section>
  )
}
