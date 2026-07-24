'use client'

import {useEffect, useState, type ComponentType} from 'react'

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: {timeout: number}) => number
  cancelIdleCallback?: (handle: number) => void
}

let appExtrasPromise: Promise<ComponentType> | null = null

function loadAppExtras() {
  appExtrasPromise ??= import('@/components/app-extras').then((mod) => mod.AppExtras)
  return appExtrasPromise
}

export function DeferredAppExtras() {
  const [AppExtras, setAppExtras] = useState<ComponentType | null>(null)

  useEffect(() => {
    let cancelled = false
    const win = window as IdleWindow

    const load = () => {
      void loadAppExtras().then((Component) => {
        if (!cancelled) setAppExtras(() => Component)
      })
    }

    if (win.requestIdleCallback) {
      const handle = win.requestIdleCallback(load, {timeout: 3000})
      return () => {
        cancelled = true
        win.cancelIdleCallback?.(handle)
      }
    }

    const handle = window.setTimeout(load, 1500)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [])

  return AppExtras ? <AppExtras /> : null
}
