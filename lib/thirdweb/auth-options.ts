export const PRYV_IN_APP_AUTH_OPTIONS = [
  'google',
  'email',
  'apple',
  'facebook',
  'x',
  'telegram',
] as const

// Email-only auth for mini app environments where OAuth redirects don't work
export const MINI_APP_AUTH_OPTIONS = ['email'] as const

export type PryvInAppAuthOption = (typeof PRYV_IN_APP_AUTH_OPTIONS)[number]

export type {
  MiniAppEnvironmentInfo,
  MiniKitContext,
  WorldAppContext,
} from '@/lib/thirdweb/mini-app-env'
export {getMiniAppEnvironmentInfo, isMiniAppEnvironment} from '@/lib/thirdweb/mini-app-env'
