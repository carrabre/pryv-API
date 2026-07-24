'use client'

import {lazy, Suspense, type ReactNode} from 'react'
import {DeferredMount} from '../deferred-mount'

const UsageClient = lazy(() => import('./usage-client'))

export function UsageDeferredClient({children}: {children: ReactNode}) {
  return (
    <DeferredMount fallback={children}>
      <Suspense fallback={children}>
        <UsageClient />
      </Suspense>
    </DeferredMount>
  )
}
