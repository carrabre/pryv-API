'use client'

import {useState, useEffect} from 'react'
import {getMiniAppEnvironmentInfo, type MiniAppEnvironmentInfo} from '@/lib/thirdweb/mini-app-env'

/**
 * Hook to detect if the app is running inside a mini app environment (e.g., World App).
 * Returns environment info and CSS class helpers for mini app-specific styling.
 * Uses useEffect to re-check after mount since World App may inject window.WorldApp after initial render.
 */
export function useMiniApp() {
  const [info, setInfo] = useState<MiniAppEnvironmentInfo>(() => getMiniAppEnvironmentInfo())

  // Re-check after mount in case World App injects context after initial render.
  // Poll briefly because some WebViews inject after a delay.
  useEffect(() => {
    let cancelled = false
    let attempts = 0
    const maxAttempts = 16
    const intervalMs = 250

    const checkAndUpdate = () => {
      if (cancelled) return true
      const detected = getMiniAppEnvironmentInfo()
      if (detected.isMiniApp) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[useMiniApp] Mini app detected:', detected.detectionMethod)
        }
        setInfo(detected)
        return true
      }
      return false
    }

    if (checkAndUpdate()) return

    const timer = setInterval(() => {
      attempts += 1
      if (checkAndUpdate() || attempts >= maxAttempts) {
        clearInterval(timer)
      }
    }, intervalMs)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  return {
    ...info,
    /**
     * Mini app chat container spacing.
     * Use full width + comfortable horizontal padding inside the World App frame.
     */
    miniAppChatPadding: info.isMiniApp ? 'w-full max-w-full px-4 sm:px-6 pt-0' : '',
    /**
     * Extra padding class for mini app environments.
     * Mini apps have their own chrome/frame, so we need more breathing room.
     */
    miniAppPadding: info.isMiniApp ? '' : '',
    /**
     * Header padding - relies on outer container padding in mini app mode.
     */
    miniAppHeaderPadding: info.isMiniApp ? '' : 'px-4 md:px-4',
    /**
     * Extra top padding for safe area in mini apps
     */
    miniAppSafeAreaTop: info.isMiniApp ? 'pt-2' : 'pt-4',
    /**
     * Bottom padding for input area - extra space for World App's bottom bar
     */
    miniAppBottomPadding: info.isMiniApp
      ? 'pb-[calc(env(safe-area-inset-bottom,0px)+2.5rem)]'
      : 'pb-6 md:pb-6 lg:pb-6',
    /**
     * Content padding - relies on outer container padding in mini app mode.
     */
    miniAppContentPadding: info.isMiniApp ? '' : 'px-4 md:px-4',
    /**
     * Rounded corners for mini app containers
     */
    miniAppRounded: info.isMiniApp ? 'rounded-xl' : '',
    /**
     * Spacer after the input form so the user always sees breathing room.
     */
    miniAppBottomSpacer: info.isMiniApp ? 'h-6' : '',
  }
}
