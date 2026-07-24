'use client'

import useSWR from 'swr'
import type {UIArtifact} from '@/components/artifact'
import {useCallback, useMemo, useEffect} from 'react'

export const initialArtifactData: UIArtifact = {
  documentId: 'init',
  content: '',
  kind: 'text',
  title: '',
  status: 'idle',
  isVisible: false,
  boundingBox: {
    top: 0,
    left: 0,
    width: 0,
    height: 0,
  },
}

type Selector<T> = (state: UIArtifact) => T

export function useArtifactSelector<Selected>(selector: Selector<Selected>) {
  const {data: localArtifact} = useSWR<UIArtifact>('artifact', null, {
    fallbackData: initialArtifactData,
  })

  const selectedValue = useMemo(() => {
    if (!localArtifact) return selector(initialArtifactData)
    return selector(localArtifact)
  }, [localArtifact, selector])

  return selectedValue
}

export function useArtifact() {
  const {data: localArtifact, mutate: setLocalArtifact} = useSWR<UIArtifact>('artifact', null, {
    fallbackData: initialArtifactData,
  })

  const artifact = useMemo(() => {
    if (!localArtifact) return initialArtifactData
    return localArtifact
  }, [localArtifact])

  const setArtifact = useCallback(
    (updaterFn: UIArtifact | ((currentArtifact: UIArtifact) => UIArtifact)) => {
      setLocalArtifact((currentArtifact) => {
        const artifactToUpdate = currentArtifact || initialArtifactData

        if (typeof updaterFn === 'function') {
          const updated = updaterFn(artifactToUpdate)

          return updated
        }

        return updaterFn
      })
    },
    [setLocalArtifact],
  )

  // Enhanced fallback mechanism: ensure artifacts with content become visible and handle state recovery
  useEffect(() => {
    // Auto-show completed artifacts that have content but aren't visible
    if (
      artifact.status === 'idle' &&
      artifact.documentId !== 'init' &&
      artifact.content.length > 0 &&
      !artifact.isVisible
    ) {
      setArtifact((current) => ({
        ...current,
        isVisible: true,
      }))
    }
  }, [
    artifact.status,
    artifact.documentId,
    artifact.content.length,
    artifact.isVisible,
    setArtifact,
  ])

  // Improved state persistence: store artifact state in sessionStorage for recovery
  useEffect(() => {
    if (typeof window !== 'undefined' && artifact.documentId !== 'init') {
      try {
        const artifactKey = `artifact-state-${artifact.documentId}`
        const stateToStore = {
          documentId: artifact.documentId,
          title: artifact.title,
          kind: artifact.kind,
          content: artifact.content,
          status: artifact.status,
          timestamp: Date.now(),
        }
        sessionStorage.setItem(artifactKey, JSON.stringify(stateToStore))
      } catch (error) {}
    }
  }, [artifact.documentId, artifact.title, artifact.kind, artifact.content, artifact.status])

  // State recovery mechanism: restore content when reopening artifacts
  const recoverArtifactState = useCallback((documentId: string) => {
    if (typeof window !== 'undefined') {
      try {
        const artifactKey = `artifact-state-${documentId}`
        const storedState = sessionStorage.getItem(artifactKey)

        if (storedState) {
          const parsedState = JSON.parse(storedState)
          const ageMs = Date.now() - parsedState.timestamp

          // Only recover if state is less than 1 hour old
          if (ageMs < 60 * 60 * 1000) {
            return {
              content: parsedState.content,
              title: parsedState.title,
              kind: parsedState.kind,
              status: parsedState.status,
            }
          } else {
            // Clean up old state
            sessionStorage.removeItem(artifactKey)
          }
        }
      } catch (error) {}
    }
    return null
  }, [])

  const {data: localArtifactMetadata, mutate: setLocalArtifactMetadata} = useSWR<any>(
    () => (artifact.documentId ? `artifact-metadata-${artifact.documentId}` : null),
    null,
    {
      fallbackData: null,
    },
  )

  return useMemo(
    () => ({
      artifact,
      setArtifact,
      metadata: localArtifactMetadata,
      setMetadata: setLocalArtifactMetadata,
      recoverArtifactState,
    }),
    [artifact, setArtifact, localArtifactMetadata, setLocalArtifactMetadata, recoverArtifactState],
  )
}
