export interface WorldcoinServerConfig {
  appId: `app_${string}`
  actionId: string
  secret?: string
}

let cachedConfig: WorldcoinServerConfig | null = null

export function getWorldcoinServerConfig(): WorldcoinServerConfig {
  if (cachedConfig) return cachedConfig

  const appIdEnv = process.env.WORLD_ID_APP_ID
  const actionIdEnv = process.env.WORLD_ID_ACTION
  const secret = process.env.WORLDCOIN_SECRET

  if (!appIdEnv || !appIdEnv.startsWith('app_')) {
    throw new Error('WORLD_ID_APP_ID must be defined (e.g., app_1234)')
  }
  if (!actionIdEnv) {
    throw new Error('WORLD_ID_ACTION must be defined')
  }

  cachedConfig = {
    appId: appIdEnv as `app_${string}`,
    actionId: actionIdEnv,
    secret: secret ?? undefined,
  }

  return cachedConfig
}
