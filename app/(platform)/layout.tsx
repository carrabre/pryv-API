import {PlatformNav} from './platform-nav'
import {DeferredAppExtras} from '@/components/deferred-app-extras'
import {ThirdwebClientProvider} from '@/components/thirdweb-provider'
import {getApiBaseUrl} from '@/lib/platform/api-client'

const themeBootstrapScript = `try{var e=document.documentElement,t=localStorage.theme||'system',d=t=='dark'||t=='system'&&matchMedia('(prefers-color-scheme: dark)').matches,c=d?'dark':'light';e.classList.remove('light','dark');e.classList.add(c);e.style.colorScheme=c}catch(e){}`

const platformDashboardHost = (() => {
  const platformUrl = (process.env.NEXT_PUBLIC_PLATFORM_URL ?? '').trim()
  if (!platformUrl) return null
  try {
    return new URL(platformUrl).host
  } catch {
    return null
  }
})()

const platformApiHost = (() => {
  const apiBaseUrl = getApiBaseUrl()
  if (!apiBaseUrl) return null
  try {
    return new URL(apiBaseUrl).host
  } catch {
    return null
  }
})()

export const metadata = {
  alternates: {
    types: {
      'text/plain': '/llms.txt',
    },
  },
  other: {
    'llms.txt': '/llms.txt',
    'llms-full.txt': '/llms-full.txt',
  },
}

export default function PlatformLayout({children}: {children: React.ReactNode}) {
  return (
    <>
      <script
        id='platform-theme-bootstrap'
        // Keep the platform shell on the stored/system theme before hydration.
        dangerouslySetInnerHTML={{__html: themeBootstrapScript}}
      />
      <ThirdwebClientProvider>
        <div className='p-shell'>
          <div className='p-shell-frame'>
            <PlatformNav dashboardHost={platformDashboardHost} apiHost={platformApiHost} />
            <main className='p-main'>{children}</main>
          </div>
        </div>
        <DeferredAppExtras />
      </ThirdwebClientProvider>
    </>
  )
}
