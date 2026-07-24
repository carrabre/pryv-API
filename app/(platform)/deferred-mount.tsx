'use client'

import {useEffect, useState, type ReactNode} from 'react'

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: {timeout: number}) => number
  cancelIdleCallback?: (handle: number) => void
}

export function DeferredMount({
  children,
  fallback,
  delayMs = 600,
  timeoutMs = 2500,
}: {
  children: ReactNode
  fallback: ReactNode
  delayMs?: number
  timeoutMs?: number
}) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const win = window as IdleWindow
    let idleHandle: number | null = null

    const delayHandle = window.setTimeout(() => {
      if (win.requestIdleCallback) {
        idleHandle = win.requestIdleCallback(() => setReady(true), {
          timeout: timeoutMs - delayMs,
        })
        return
      }

      setReady(true)
    }, delayMs)

    return () => {
      window.clearTimeout(delayHandle)
      if (idleHandle != null) win.cancelIdleCallback?.(idleHandle)
    }
  }, [delayMs, timeoutMs])

  return ready ? children : fallback
}
