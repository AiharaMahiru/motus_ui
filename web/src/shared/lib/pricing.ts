type TokenPricing = {
  inputPerMillion: number
  outputPerMillion: number
  cachedInputPerMillion?: number
}

const MODEL_PRICING_ALIASES: Record<string, string> = {
  'gpt-5.4 mini': 'gpt-5.4-mini',
  'gpt-5.4 nano': 'gpt-5.4-nano',
  'gpt-5-mini': 'gpt-5.4-mini',
  'gpt-5-nano': 'gpt-5.4-nano',
}

const OPENAI_TEXT_PRICING: Record<string, TokenPricing> = {
  'gpt-5.4': { inputPerMillion: 2, cachedInputPerMillion: 0.2, outputPerMillion: 8 },
  'gpt-5.4-mini': { inputPerMillion: 0.4, cachedInputPerMillion: 0.04, outputPerMillion: 1.6 },
  'gpt-5.4-nano': { inputPerMillion: 0.05, cachedInputPerMillion: 0.005, outputPerMillion: 0.4 },
  'gpt-5': { inputPerMillion: 2, cachedInputPerMillion: 0.2, outputPerMillion: 8 },
  'gpt-4.1': { inputPerMillion: 2, cachedInputPerMillion: 0.5, outputPerMillion: 8 },
  'gpt-4.1-mini': { inputPerMillion: 0.4, cachedInputPerMillion: 0.1, outputPerMillion: 1.6 },
  'gpt-4.1-nano': { inputPerMillion: 0.1, cachedInputPerMillion: 0.025, outputPerMillion: 0.4 },
  'gpt-4o': { inputPerMillion: 2.5, cachedInputPerMillion: 1.25, outputPerMillion: 10 },
  'gpt-4o-mini': { inputPerMillion: 0.15, cachedInputPerMillion: 0.075, outputPerMillion: 0.6 },
}

function normalizePricingModel(modelName?: string | null) {
  if (!modelName?.trim()) {
    return undefined
  }

  let modelKey = modelName.trim().toLowerCase().split('/').pop() ?? ''
  modelKey = MODEL_PRICING_ALIASES[modelKey] ?? modelKey
  if (modelKey in OPENAI_TEXT_PRICING) {
    return modelKey
  }

  return Object.keys(OPENAI_TEXT_PRICING)
    .sort((left, right) => right.length - left.length)
    .find((candidate) => modelKey.startsWith(`${candidate}-`))
}

function numericUsageValue(usage: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = usage[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
  }
  return 0
}

function cachedInputTokens(usage: Record<string, unknown>) {
  let cachedTokens = numericUsageValue(usage, 'cached_tokens', 'cached_input_tokens')
  const promptDetails = usage.prompt_tokens_details
  if (promptDetails && typeof promptDetails === 'object' && !Array.isArray(promptDetails)) {
    cachedTokens += numericUsageValue(promptDetails as Record<string, unknown>, 'cached_tokens')
  }
  const inputDetails = usage.input_tokens_details
  if (inputDetails && typeof inputDetails === 'object' && !Array.isArray(inputDetails)) {
    cachedTokens += numericUsageValue(inputDetails as Record<string, unknown>, 'cached_tokens')
  }
  return cachedTokens
}

export function estimateOpenAiTextCost({
  modelName,
  pricingModel,
  usage,
}: {
  modelName?: string | null
  pricingModel?: string | null
  usage: Record<string, unknown>
}) {
  const modelKey = normalizePricingModel(pricingModel || modelName)
  if (!modelKey) {
    return undefined
  }

  const pricing = OPENAI_TEXT_PRICING[modelKey]
  if (!pricing) {
    return undefined
  }

  const inputTokens = numericUsageValue(usage, 'prompt_tokens', 'input_tokens')
  const outputTokens = numericUsageValue(usage, 'completion_tokens', 'output_tokens')
  const cachedTokens = Math.min(cachedInputTokens(usage), inputTokens)
  const uncachedInputTokens = Math.max(inputTokens - cachedTokens, 0)
  const cachedInputPrice = pricing.cachedInputPerMillion ?? pricing.inputPerMillion
  const cost =
    (uncachedInputTokens * pricing.inputPerMillion +
      cachedTokens * cachedInputPrice +
      outputTokens * pricing.outputPerMillion) /
    1_000_000

  return inputTokens || outputTokens ? cost : undefined
}
