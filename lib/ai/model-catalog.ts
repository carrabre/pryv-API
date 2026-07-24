/**
 * The model definitions in this file
 * should always be kept in-sync with `models.py` in `pryv-tee`.
 * If any model is added here, add it in `pryv-tee` too.
 */

interface BasicModelInfo {
  id: string
  name: string
  description: string
  provider: 'openai' | 'xai' | 'anthropic' | 'google'
  devOnly: boolean
}

interface ModelInfo extends BasicModelInfo {
  supportsVision: boolean
  supportsPdf: boolean
  supportsWebSearch: boolean
}

export const Models = {
  'gpt-5.5': {
    id: 'gpt-5.5',
    name: 'GPT 5.5',
    description: "OpenAI's default flagship model",
    provider: 'openai',
    devOnly: false,
    supportsVision: true,
    supportsPdf: true,
    supportsWebSearch: true,
  },
  'gpt-5.4': {
    id: 'gpt-5.4',
    name: 'GPT 5.4',
    description: "OpenAI's previous flagship model",
    provider: 'openai',
    devOnly: false,
    supportsVision: true,
    supportsPdf: true,
    supportsWebSearch: true,
  },
  'gemini-3.1-pro-preview': {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro Preview',
    description: 'Preview release of Gemini 3.1 Pro (Google)',
    provider: 'google',
    devOnly: false,
    supportsVision: true,
    supportsPdf: true,
    supportsWebSearch: true,
  },
  'claude-sonnet-4-6': {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    description: 'Anthropic multimodal model',
    provider: 'anthropic',
    devOnly: false,
    supportsVision: true,
    supportsPdf: true,
    supportsWebSearch: false,
  },
  'claude-opus-4-7': {
    id: 'claude-opus-4-7',
    name: 'Claude Opus 4.7',
    description: 'Anthropic flagship reasoning model',
    provider: 'anthropic',
    devOnly: false,
    supportsVision: true,
    supportsPdf: true,
    supportsWebSearch: false,
  },
  'grok-4-1-fast-reasoning': {
    id: 'grok-4-1-fast-reasoning',
    name: 'Grok 4.1 Fast Reasoning',
    description: 'Fast reasoning model from xAI (4.1)',
    provider: 'xai',
    devOnly: false,
    supportsVision: true,
    supportsPdf: true,
    supportsWebSearch: true,
  },
} as const satisfies Record<string, ModelInfo>

export type ModelId = keyof typeof Models
export type Model = (typeof Models)[ModelId]
export type ModelName = Model['name']
export type ModelProvider = Model['provider']
