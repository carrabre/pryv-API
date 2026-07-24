import {TOAST_ACTIVITY_EVENT} from './toast-events'

export type ToastType = 'success' | 'error'

export interface ToastInput {
  type: ToastType
  description: string
}

export interface ToastItem extends ToastInput {
  id: number
}

export type ToastListener = (toast: ToastItem) => void

export const TOAST_TIMEOUT_MS = 4000
const listeners = new Set<ToastListener>()
const pendingToasts: ToastItem[] = []
let nextToastId = 1

type ToastWindow = Window & {
  __pryvToastPending?: boolean
}

function markToastActivity(hasPendingToast: boolean) {
  if (typeof window === 'undefined') return
  const toastWindow = window as ToastWindow
  toastWindow.__pryvToastPending = hasPendingToast
  if (hasPendingToast) window.dispatchEvent(new Event(TOAST_ACTIVITY_EVENT))
}

export function toast(props: ToastInput) {
  const item = {id: nextToastId++, ...props}

  if (listeners.size === 0) {
    pendingToasts.push(item)
    markToastActivity(true)
  } else {
    listeners.forEach((listener) => listener(item))
    markToastActivity(false)
  }

  return item.id
}

export function subscribe(listener: ToastListener) {
  listeners.add(listener)
  for (const item of pendingToasts.splice(0)) {
    listener(item)
  }
  if (pendingToasts.length === 0) markToastActivity(false)
  return () => listeners.delete(listener)
}
