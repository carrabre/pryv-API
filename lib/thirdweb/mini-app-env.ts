/**
 * World App injects this object when running inside the World App browser/WebView.
 * This is available even without MiniKit SDK integration.
 */
export interface WorldAppContext {
  world_app_version: string
  device_os: 'ios' | 'android'
  [key: string]: unknown
}

/**
 * MiniKit is the World App SDK for building mini apps.
 * It provides deeper integration with World App features.
 */
export interface MiniKitContext {
  [key: string]: unknown
}

declare global {
  interface Window {
    WorldApp?: WorldAppContext
    MiniKit?: MiniKitContext
  }
}

export interface MiniAppEnvironmentInfo {
  isMiniApp: boolean
  isWorldApp: boolean
  hasMiniKit: boolean
  worldAppVersion?: string
  deviceOS?: 'ios' | 'android'
  detectionMethod: 'WorldApp' | 'MiniKit' | 'userAgent' | 'urlParam' | 'none'
}

export function getMiniAppEnvironmentInfo(): MiniAppEnvironmentInfo {
  if (typeof window === 'undefined') {
    return {
      isMiniApp: false,
      isWorldApp: false,
      hasMiniKit: false,
      detectionMethod: 'none',
    }
  }

  const worldAppContext = (window as any).WorldApp ?? (window as any).worldApp
  const miniKitContext = (window as any).MiniKit ?? (window as any).minikit
  const isWorldApp = worldAppContext !== undefined
  const hasMiniKit = miniKitContext !== undefined

  if (isWorldApp) {
    return {
      isMiniApp: true,
      isWorldApp: true,
      hasMiniKit,
      worldAppVersion: worldAppContext?.world_app_version,
      deviceOS: worldAppContext?.device_os,
      detectionMethod: 'WorldApp',
    }
  }

  if (hasMiniKit) {
    return {
      isMiniApp: true,
      isWorldApp: true,
      hasMiniKit: true,
      detectionMethod: 'MiniKit',
    }
  }

  if (typeof navigator !== 'undefined' && navigator.userAgent) {
    const normalized = navigator.userAgent.toLowerCase()
    if (
      normalized.includes('worldapp') ||
      normalized.includes('world app') ||
      normalized.includes('minikit')
    ) {
      return {
        isMiniApp: true,
        isWorldApp: true,
        hasMiniKit: false,
        detectionMethod: 'userAgent',
      }
    }
  }

  if (window.location) {
    const params = new URLSearchParams(window.location.search)
    if (params.get('miniapp') === '1' || params.get('miniapp') === 'true') {
      return {
        isMiniApp: true,
        isWorldApp: false,
        hasMiniKit: false,
        detectionMethod: 'urlParam',
      }
    }
  }

  return {
    isMiniApp: false,
    isWorldApp: false,
    hasMiniKit: false,
    detectionMethod: 'none',
  }
}

export function isMiniAppEnvironment(): boolean {
  return getMiniAppEnvironmentInfo().isMiniApp
}
