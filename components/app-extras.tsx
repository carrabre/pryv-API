'use client'

import {useEffect, useState, type ComponentType} from 'react'
import {TOAST_ACTIVITY_EVENT} from '@/components/toast-events'

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: {timeout: number}) => number
  cancelIdleCallback?: (handle: number) => void
  __pryvToastPending?: boolean
}

function scheduleIdle(callback: () => void, timeoutMs: number) {
  const win = window as IdleWindow
  if (win.requestIdleCallback && win.cancelIdleCallback) {
    const handle = win.requestIdleCallback(callback, {timeout: timeoutMs})
    return () => win.cancelIdleCallback?.(handle)
  }

  const handle = window.setTimeout(callback, timeoutMs)
  return () => window.clearTimeout(handle)
}

export function AppExtras() {
  const [ToastViewport, setToastViewport] = useState<ComponentType | null>(null)
  const [Analytics, setAnalytics] = useState<ComponentType | null>(null)

  useEffect(() => {
    let isMounted = true
    let toastLoadRequested = false

    const loadToastViewport = () => {
      if (toastLoadRequested) return
      toastLoadRequested = true
      void import('@/components/toast')
        .then((mod) => {
          if (isMounted) setToastViewport(() => mod.ToastViewport)
        })
        .catch(() => {
          // Toasts should never block the product shell.
        })
    }

    const loadAnalytics = () => {
      if (process.env.NEXT_PUBLIC_ENABLE_ANALYTICS !== '1') return
      void import('@vercel/analytics/react')
        .then((mod) => {
          if (isMounted) setAnalytics(() => mod.Analytics)
        })
        .catch(() => {
          // Analytics should never block the product shell.
        })
    }

    window.addEventListener(TOAST_ACTIVITY_EVENT, loadToastViewport)
    if ((window as IdleWindow).__pryvToastPending) loadToastViewport()
    const cancelAnalyticsLoad = scheduleIdle(loadAnalytics, 3000)

    return () => {
      isMounted = false
      window.removeEventListener(TOAST_ACTIVITY_EVENT, loadToastViewport)
      cancelAnalyticsLoad()
    }
  }, [])

  return (
    <>
      {ToastViewport ? <ToastViewport /> : null}
      {Analytics ? <Analytics /> : null}
    </>
  )
}
