import { cn } from '../../../shared/lib/cn'
import { Bot, CircleDollarSign, SendHorizontal, Sigma, Wrench } from 'lucide-react'

import type { SessionDetail, TurnMetrics } from '../../../shared/api/contracts'
import { useI18n } from '../../../shared/i18n/I18nContext'
import { formatCompactUsageCount, formatCost } from '../../../shared/lib/format'
import { estimateOpenAiTextCost } from '../../../shared/lib/pricing'


type ResourceTelemetryBarProps = {
  className?: string
  currentSession?: SessionDetail
  counts?: {
    messageCount: number
    modelCallCount: number
    toolCallCount: number
  }
  isStreaming: boolean
  lastTurnMetrics?: TurnMetrics
  livePreview?: {
    turnUsage?: Record<string, unknown>
    sessionUsage?: Record<string, unknown>
    turnCostUsd?: number | null
    sessionCostUsd?: number | null
  }
}

type CostState = {
  estimated?: boolean
  fallback: string
  value?: number | null
}

function formatCostState({ estimated = false, fallback, value }: CostState) {
  if (typeof value !== 'number') {
    return fallback
  }
  return `${estimated ? '≈' : ''}${formatCost(value)}`
}

function hasUsageMetric(usage: Record<string, unknown>, key: string) {
  return typeof usage[key] === 'number' && Number.isFinite(usage[key])
}

function UsageMetric({
  label,
  value,
  tone,
}: {
  label: string
  value: unknown
  tone: 'total' | 'prompt' | 'completion'
}) {
  return (
    <span className={`resource-telemetry-token resource-telemetry-token-${tone}`}>
      <span>{label}</span>
      <strong>{formatCompactUsageCount(value)}</strong>
    </span>
  )
}

export function ResourceTelemetryBar({
  className,
  currentSession,
  counts,
  isStreaming,
  lastTurnMetrics,
  livePreview,
}: ResourceTelemetryBarProps) {
  const { text } = useI18n()
  const usage =
    (lastTurnMetrics?.session_usage as Record<string, unknown> | undefined) ??
    livePreview?.sessionUsage ??
    (currentSession?.total_usage as Record<string, unknown> | undefined) ??
    {}
  const hasTokenUsage =
    hasUsageMetric(usage, 'total_tokens') ||
    hasUsageMetric(usage, 'prompt_tokens') ||
    hasUsageMetric(usage, 'completion_tokens')
  const agentCount = lastTurnMetrics?.agent_metrics?.length ?? 0
  const turnCost =
    lastTurnMetrics?.turn_cost_usd ??
    livePreview?.turnCostUsd ??
    (lastTurnMetrics
      ? estimateOpenAiTextCost({
          modelName: currentSession?.model_name,
          pricingModel: currentSession?.pricing_model,
          usage: lastTurnMetrics.turn_usage as Record<string, unknown>,
        })
      : livePreview?.turnUsage
        ? estimateOpenAiTextCost({
            modelName: currentSession?.model_name,
            pricingModel: currentSession?.pricing_model,
            usage: livePreview.turnUsage,
          })
      : undefined)
  const turnCostEstimated =
    typeof lastTurnMetrics?.turn_cost_usd !== 'number' &&
    typeof livePreview?.turnCostUsd !== 'number' &&
    typeof turnCost === 'number'
  const sessionCost =
    lastTurnMetrics?.session_cost_usd ??
    livePreview?.sessionCostUsd ??
    currentSession?.total_cost_usd ??
    estimateOpenAiTextCost({
      modelName: currentSession?.model_name,
      pricingModel: currentSession?.pricing_model,
      usage,
    })
  const sessionCostEstimated =
    typeof lastTurnMetrics?.session_cost_usd !== 'number' &&
    typeof livePreview?.sessionCostUsd !== 'number' &&
    typeof currentSession?.total_cost_usd !== 'number' &&
    typeof sessionCost === 'number'

  return (
    <div className={cn('resource-telemetry-bar', className)}>
      <div className={`resource-telemetry-item ${isStreaming ? 'resource-telemetry-item-live' : ''}`}>
        <SendHorizontal size={12} />
        <span>{text('发送', 'Sent')}</span>
        <strong>{counts?.messageCount ?? 0}</strong>
      </div>

      <div className={`resource-telemetry-item ${isStreaming ? 'resource-telemetry-item-live' : ''}`}>
        <Wrench size={12} />
        <span>{text('工具', 'Tools')}</span>
        <strong>{counts?.toolCallCount ?? 0}</strong>
      </div>

      <div className={`resource-telemetry-item ${isStreaming ? 'resource-telemetry-item-live' : ''}`}>
        <Bot size={12} />
        <span>{text('模型', 'Models')}</span>
        <strong>{counts?.modelCallCount ?? 0}</strong>
      </div>

      <div className={`resource-telemetry-item ${isStreaming ? 'resource-telemetry-item-live' : ''}`}>
        <CircleDollarSign size={12} />
        <span>{text('本轮', 'Turn')}</span>
        <strong>
          {formatCostState({
            estimated: turnCostEstimated,
            fallback: lastTurnMetrics ? text('未计价', 'Unpriced') : text('未产生', 'None'),
            value: turnCost,
          })}
        </strong>
      </div>

      <div className={`resource-telemetry-item ${isStreaming ? 'resource-telemetry-item-live' : ''}`}>
        <CircleDollarSign size={12} />
        <span>{text('累计', 'Session')}</span>
        <strong>{formatCostState({ estimated: sessionCostEstimated, fallback: text('未计价', 'Unpriced'), value: sessionCost })}</strong>
      </div>

      <div className={`resource-telemetry-item resource-telemetry-usage ${isStreaming ? 'resource-telemetry-item-live' : ''}`}>
        <Sigma size={12} />
        <span>Token</span>
        {hasTokenUsage ? (
          <div className="resource-telemetry-token-grid">
            <UsageMetric label="Total" tone="total" value={usage.total_tokens} />
            <UsageMetric label="Prompt" tone="prompt" value={usage.prompt_tokens} />
            <UsageMetric label="Output" tone="completion" value={usage.completion_tokens} />
          </div>
        ) : (
          <strong>{text('暂无 usage', 'No usage yet')}</strong>
        )}
      </div>

      {agentCount > 0 ? (
        <div className={`resource-telemetry-item ${isStreaming ? 'resource-telemetry-item-live' : ''}`}>
          <span>Agents</span>
          <strong>{agentCount}</strong>
        </div>
      ) : null}
    </div>
  )
}
