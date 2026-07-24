'use client'

import {lazy, Suspense, type ReactNode} from 'react'
import {DeferredMount} from '../deferred-mount'

const BillingClient = lazy(() => import('./billing-client'))

export function BillingDeferredClient({children}: {children: ReactNode}) {
  return (
    <DeferredMount fallback={children}>
      <Suspense fallback={children}>
        <BillingClient />
      </Suspense>
    </DeferredMount>
  )
}
