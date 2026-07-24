'use client'

import {usePathname} from 'next/navigation'
import {useEffect, useState} from 'react'
import {DeferredPlatformCreditsCard, PlatformThemeControls} from './platform-nav-client'

type PlatformIconName =
  | 'chart-column'
  | 'book-open'
  | 'coins'
  | 'credit-card'
  | 'flask-conical'
  | 'key-round'
  | 'layers'
  | 'log-out'
  | 'moon'
  | 'settings'
  | 'sun'

type NavItem = {
  name: string
  href: string
  icon: PlatformIconName
}

const navItems: NavItem[] = [
  {name: 'Docs', href: '/docs', icon: 'book-open'},
  {name: 'Playground', href: '/playground', icon: 'flask-conical'},
  {name: 'Models', href: '/models', icon: 'layers'},
  {name: 'MCP', href: '/docs/mcp', icon: 'book-open'},
  {name: 'MPP', href: '/docs/mpp', icon: 'coins'},
  {name: 'API Keys', href: '/api-keys', icon: 'key-round'},
  {name: 'Usage', href: '/usage', icon: 'chart-column'},
  {name: 'Billing', href: '/billing', icon: 'credit-card'},
  {name: 'Settings', href: '/settings', icon: 'settings'},
]

const platformBrandLink = (
  <a href='/docs' className='p-brand-link'>
    <div className='p-brand-icon'>
      <img src='/icon.svg' alt='' width={32} height={32} className='h-8 w-8' />
    </div>
    <div className='min-w-0'>
      <p className='d-kicker'>Pryv</p>
      <p className='p-brand-title'>API Platform</p>
    </div>
  </a>
)

function PlatformIcon({name, className}: {name: PlatformIconName; className: string}) {
  return (
    <svg className={className} viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
      <use href={`/platform-icons.svg#${name}`} />
    </svg>
  )
}

function isActive(pathname: string, href: string) {
  if (href === '/docs') {
    return (
      pathname === '/' ||
      (pathname.startsWith('/docs') &&
        !pathname.startsWith('/docs/mcp') &&
        !pathname.startsWith('/docs/mpp'))
    )
  }
  if (pathname === href) return true
  return pathname.startsWith(`${href}/`)
}

const platformEnvironmentBadge = (
  <div className='p-prod-badge' data-testid='platform-production-badge'>
    <span className='h-2 w-2 rounded-full bg-emerald-500' />
    Configured service
  </div>
)

const platformCreditsLoadIcon = <PlatformIcon name='coins' className='h-3.5 w-3.5' />
const platformLightIcon = <PlatformIcon name='sun' className='h-3.5 w-3.5' />
const platformDarkIcon = <PlatformIcon name='moon' className='h-3.5 w-3.5' />
const platformSignOutLink = (
  <a href='/logout' data-testid='platform-logout-link' className='p-danger-link'>
    <PlatformIcon name='log-out' className='h-3.5 w-3.5' />
    Sign out
  </a>
)

export function PlatformNav({
  dashboardHost,
  apiHost,
}: {
  dashboardHost: string | null
  apiHost: string | null
}) {
  const pathname = usePathname() || '/'
  const [showSecondary, setShowSecondary] = useState(false)

  useEffect(() => {
    setShowSecondary(true)
  }, [])

  return (
    <aside className='p-sidebar'>
      <div className='p-brand-row'>{platformBrandLink}</div>

      <nav className='platform-nav-list'>
        {navItems.map((item) => (
          <a
            key={item.href}
            href={item.href}
            data-p-nav-link
            data-href={item.href}
            className='p-nav-link'
            aria-current={isActive(pathname, item.href) ? 'page' : undefined}
          >
            <PlatformIcon name={item.icon} className='p-nav-icon' />
            <span>{item.name}</span>
          </a>
        ))}
      </nav>

      {showSecondary ? (
        <PlatformNavSecondary dashboardHost={dashboardHost} apiHost={apiHost} />
      ) : null}
    </aside>
  )
}

function PlatformNavSecondary({
  dashboardHost,
  apiHost,
}: {
  dashboardHost: string | null
  apiHost: string | null
}) {
  return (
    <div className='flex flex-col gap-4 lg:mt-auto' data-testid='platform-nav-secondary'>
      {platformEnvironmentBadge}

      <DeferredPlatformCreditsCard loadIcon={platformCreditsLoadIcon} />

      <div className='p-host-chips' data-testid='platform-host-chips'>
        <span className='p-chip'>
          {dashboardHost ? `dashboard: ${dashboardHost}` : 'dashboard: --'}
        </span>
        <span className='p-chip'>{apiHost ? `api: ${apiHost}` : 'api: --'}</span>
      </div>

      <div className='p-controls' role='group' aria-label='Platform controls'>
        <PlatformThemeControls lightIcon={platformLightIcon} darkIcon={platformDarkIcon} />
        {platformSignOutLink}
      </div>
    </div>
  )
}
