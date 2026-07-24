'use client'

import {lazy, Suspense, type ReactNode} from 'react'
import {DeferredMount} from '../deferred-mount'

const PlaygroundClient = lazy(() => import('./playground-client'))

export function PlaygroundDeferredClient({children}: {children: ReactNode}) {
  return (
    <DeferredMount fallback={children} delayMs={300} timeoutMs={1200}>
      <Suspense fallback={children}>
        <PlaygroundClient />
      </Suspense>
    </DeferredMount>
  )
}
