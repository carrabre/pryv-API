import {Models, type Model, type ModelId, type ModelName} from '@/lib/ai/model-catalog'
export {Models} from '@/lib/ai/model-catalog'
export type {ModelId, ModelName, ModelProvider} from '@/lib/ai/model-catalog'

const DEV = process.env.NODE_ENV === 'development'

/** Indexed by model name, mapping onto model ID. */
const nameToId: {[name in ModelName]: ModelId} = Object.values(Models).reduce(
  (acc, model) => {
    acc[model.name] = model.id
    return acc
  },
  {} as {[name in ModelName]: ModelId},
)

const FALLBACK_MODEL_ID = 'gpt-5.5' as const
const MODEL_ID_ALIASES: Record<string, ModelId> = {
  'gpt-5.1': 'gpt-5.5',
  'gpt-5.2': 'gpt-5.5',
  'gpt-5.3': 'gpt-5.5',
  'gpt-5.4-pro': 'gpt-5.4',
  'gemini-2.5-pro': 'gemini-3.1-pro-preview',
  'gemini-2.5-flash': 'gemini-3.1-pro-preview',
  'gemini-3-pro-preview': 'gemini-3.1-pro-preview',
  'claude-sonnet-4-5': 'claude-sonnet-4-6',
  'claude-opus-4-5': 'claude-opus-4-7',
  'claude-opus-4-6': 'claude-opus-4-7',
  'grok-4': 'grok-4-1-fast-reasoning',
  'grok-4-fast-reasoning': 'grok-4-1-fast-reasoning',
}

/**
 * Resolve deprecated/aliased model IDs to the canonical model ID.
 * This lets us remove models from the UI while keeping backwards compatibility
 * for persisted chats / localStorage values that referenced older IDs.
 */
export function resolveModelId(id: string | null | undefined): ModelId {
  if (typeof id !== 'string') return FALLBACK_MODEL_ID
  if (id in Models) return id as ModelId
  return MODEL_ID_ALIASES[id] ?? FALLBACK_MODEL_ID
}

export function isModelId(id: string | null | undefined): id is ModelId {
  return typeof id === 'string' && id in Models
}

export function isModelName(name: string | null | undefined): name is ModelName {
  return typeof name === 'string' && name in nameToId
}

export function getModel(idName: ModelId | ModelName | string | null | undefined): Model {
  if (isModelId(idName)) return Models[resolveModelId(idName)]
  if (isModelName(idName)) return Models[resolveModelId(nameToId[idName])]
  return Models[resolveModelId(idName)]
}

export const chatModels = Object.values(Models).filter(({devOnly}) => !devOnly || DEV)

export const DEFAULT_CHAT_MODEL: ModelId = FALLBACK_MODEL_ID
export const DEFAULT_VISION_MODEL: ModelId = FALLBACK_MODEL_ID

export function isVisionModel(id: ModelId): boolean {
  return Boolean(Models[resolveModelId(id)]?.supportsVision)
}

export function ensureVisionModel(id: ModelId): ModelId {
  const resolved = resolveModelId(id)
  return isVisionModel(resolved) ? resolved : DEFAULT_VISION_MODEL
}

export function supportsWebSearch(id: ModelId): boolean {
  return Boolean(Models[resolveModelId(id)]?.supportsWebSearch)
}

export function supportsPdf(id: ModelId): boolean {
  return Boolean(Models[resolveModelId(id)]?.supportsPdf)
}
