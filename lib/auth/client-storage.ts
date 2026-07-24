export function safeLocalStorageGetItem(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage?.getItem(key) ?? null
  } catch {
    return null
  }
}

export function safeLocalStorageSetItem(key: string, value: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage?.setItem(key, value)
  } catch {
    // ignore storage errors
  }
}

export function safeLocalStorageRemoveItem(key: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage?.removeItem(key)
  } catch {
    // ignore storage errors
  }
}
