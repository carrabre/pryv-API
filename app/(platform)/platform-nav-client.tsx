'use client'

import {useEffect, useState, type ComponentType, type ReactNode} from 'react'

type PlatformTheme = 'light' | 'dark' | 'system'

const THEME_STORAGE_KEY = 'theme'
const THEME_QUERY = '(prefers-color-scheme: dark)'
const THEME_BUTTON_ACTIVE_CLASS = 'p-theme-on'
const THEME_BUTTON_INACTIVE_CLASS = 'p-theme-off'

let platformWalletCreditsPromise: Promise<ComponentType> | null = null

function loadPlatformWalletCredits() {
  platformWalletCreditsPromise ??= import('./platform-wallet-credits').then(
    (mod) => mod.PlatformWalletCredits,
  )
  return platformWalletCreditsPromise
}

function getSystemTheme(): Exclude<PlatformTheme, 'system'> {
  return window.matchMedia(THEME_QUERY).matches ? 'dark' : 'light'
}

function getStoredTheme(): PlatformTheme {
  try {
    const storedTheme = window.localStorage[THEME_STORAGE_KEY]
    if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system') {
      return storedTheme
    }
  } catch {
    // Treat storage failures the same as a missing preference.
  }
  return 'system'
}

function applyTheme(
  theme: PlatformTheme,
  setResolvedTheme: (theme: Exclude<PlatformTheme, 'system'>) => void,
) {
  const resolved = theme === 'system' ? getSystemTheme() : theme
  document.documentElement.classList.remove('light', 'dark')
  document.documentElement.classList.add(resolved)
  document.documentElement.style.colorScheme = resolved
  setResolvedTheme(resolved)
}

function usePlatformTheme() {
  const [resolvedTheme, setResolvedTheme] = useState<Exclude<PlatformTheme, 'system'>>('light')

  useEffect(() => {
    applyTheme(getStoredTheme(), setResolvedTheme)

    const mediaQuery = window.matchMedia(THEME_QUERY)
    const handleSystemThemeChange = () => {
      if (getStoredTheme() === 'system') applyTheme('system', setResolvedTheme)
    }
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) applyTheme(getStoredTheme(), setResolvedTheme)
    }

    mediaQuery.addEventListener('change', handleSystemThemeChange)
    window.addEventListener('storage', handleStorageChange)

    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  const setTheme = (theme: PlatformTheme) => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // The visual toggle should still work if storage is unavailable.
    }
    applyTheme(theme, setResolvedTheme)
  }

  return {resolvedTheme, setTheme}
}

function PlatformCreditsCardShell({
  onLoadCredits,
  loadIcon = null,
  statusText = 'Loading balance...',
}: {
  onLoadCredits?: () => void
  loadIcon?: ReactNode
  statusText?: string
}) {
  return (
    <div data-testid='platform-credits-card' className='p-credits-card'>
      <p className='d-kicker'>Credits</p>
      <p className='mt-2 text-2xl font-semibold'>--</p>
      <p className='d-detail-muted'>{statusText}</p>
      <div className='p-credits-actions'>
        {onLoadCredits ? (
          <button type='button' onClick={onLoadCredits} className='p-load-button'>
            {loadIcon}
            Load balance
          </button>
        ) : null}
        <a href='/billing' className='p-credit-primary'>
          Add credits
        </a>
        <a href='/usage' className='p-credit-secondary'>
          View usage
        </a>
      </div>
    </div>
  )
}

export function DeferredPlatformCreditsCard({loadIcon}: {loadIcon?: ReactNode}) {
  const [showWalletCredits, setShowWalletCredits] = useState(true)
  const [PlatformWalletCredits, setPlatformWalletCredits] = useState<ComponentType | null>(null)

  useEffect(() => {
    if (!showWalletCredits || PlatformWalletCredits) return
    let cancelled = false
    void loadPlatformWalletCredits().then((Component) => {
      if (!cancelled) setPlatformWalletCredits(() => Component)
    })
    return () => {
      cancelled = true
    }
  }, [PlatformWalletCredits, showWalletCredits])

  if (!showWalletCredits) {
    return (
      <PlatformCreditsCardShell
        loadIcon={loadIcon}
        statusText='Connect wallet to view credits.'
        onLoadCredits={() => setShowWalletCredits(true)}
      />
    )
  }

  return PlatformWalletCredits ? <PlatformWalletCredits /> : <PlatformCreditsCardShell />
}

export function PlatformThemeControls({
  lightIcon,
  darkIcon,
}: {
  lightIcon: ReactNode
  darkIcon: ReactNode
}) {
  const {resolvedTheme, setTheme} = usePlatformTheme()
  const isDarkMode = resolvedTheme === 'dark'

  return (
    <div
      className='flex min-w-[10rem] flex-1 items-center gap-2 lg:flex-none'
      role='group'
      aria-label='Theme controls'
    >
      <button
        type='button'
        onClick={() => setTheme('light')}
        aria-pressed={!isDarkMode}
        data-testid='platform-theme-toggle-light'
        className={!isDarkMode ? THEME_BUTTON_ACTIVE_CLASS : THEME_BUTTON_INACTIVE_CLASS}
      >
        {lightIcon}
        Light
      </button>
      <button
        type='button'
        onClick={() => setTheme('dark')}
        aria-pressed={isDarkMode}
        data-testid='platform-theme-toggle-dark'
        className={isDarkMode ? THEME_BUTTON_ACTIVE_CLASS : THEME_BUTTON_INACTIVE_CLASS}
      >
        {darkIcon}
        Dark
      </button>
    </div>
  )
}
