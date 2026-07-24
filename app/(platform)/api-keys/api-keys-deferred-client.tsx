'use client'

import {lazy, Suspense, type ReactNode} from 'react'
import {DeferredMount} from '../deferred-mount'

const ApiKeysClient = lazy(() => import('./api-keys-client'))

export function ApiKeysDeferredClient({children}: {children: ReactNode}) {
  return (
    <DeferredMount fallback={children}>
      <Suspense fallback={children}>
        <ApiKeysClient />
      </Suspense>
    </DeferredMount>
  )
}
