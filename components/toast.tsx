'use client'

import {useEffect, useState} from 'react'
import {CheckCircleFillIcon, CrossSmallIcon, WarningIcon} from './icons'
import {subscribe, TOAST_TIMEOUT_MS, type ToastItem} from './toast-store'

export function ToastViewport() {
  return (
    <section
      aria-label='Notifications'
      aria-live='polite'
      aria-relevant='additions text'
      className='fixed bottom-4 right-4 z-[9999] flex w-[calc(100vw-2rem)] max-w-[356px] flex-col gap-2 sm:bottom-8 sm:right-8'
    >
      <ToastViewportContent />
    </section>
  )
}

function ToastViewportContent() {
  const [items, setItems] = useState<ToastItem[]>([])

  const removeToast = (id: number) => {
    setItems((current) => current.filter((item) => item.id !== id))
  }

  useEffect(() => {
    const timers: number[] = []
    const unsubscribe = subscribe((item) => {
      setItems((current) => [item, ...current.filter((existing) => existing.id !== item.id)])
      timers.push(
        window.setTimeout(() => {
          setItems((current) => current.filter((existing) => existing.id !== item.id))
        }, TOAST_TIMEOUT_MS),
      )
    })

    return () => {
      unsubscribe()
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [])

  return items.map((item) => <ToastCard key={item.id} item={item} onDismiss={removeToast} />)
}

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem
  onDismiss: (id: number) => void
}) {
  return (
    <div
      data-testid='toast'
      className='flex w-full items-start gap-3 rounded-lg border border-zinc-200 bg-zinc-100 p-3 text-zinc-950 shadow-lg'
    >
      <div
        data-type={item.type}
        className='mt-0.5 shrink-0 data-[type=error]:text-red-600 data-[type=success]:text-green-600'
      >
        {item.type === 'success' ? <CheckCircleFillIcon /> : <WarningIcon />}
      </div>
      <div className='min-w-0 flex-1 text-sm leading-5'>{item.description}</div>
      <button
        type='button'
        aria-label='Dismiss notification'
        onClick={() => onDismiss(item.id)}
        className='-m-1 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900'
      >
        <CrossSmallIcon size={14} />
      </button>
    </div>
  )
}
