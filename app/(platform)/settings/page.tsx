import {PageHeader} from '@/components/platform/page-header'

const envRows = [
  {
    label: 'Platform URL',
    value: (process.env.NEXT_PUBLIC_PLATFORM_URL ?? '').trim() || '<set NEXT_PUBLIC_PLATFORM_URL>',
  },
  {
    label: 'API Base URL',
    value: (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').trim() || '<set NEXT_PUBLIC_API_BASE_URL>',
  },
]

const securityItems = [
  {
    title: 'Key rotation',
    detail: 'Rotate keys every 60-90 days and revoke unused keys.',
  },
  {
    title: 'Scopes (coming soon)',
    detail: 'Prepare for per-key scopes even if enforcement is not yet enabled.',
  },
  {
    title: 'Rate limits',
    detail: 'Tune RPM/TPM per key to reduce blast radius.',
  },
]

export default function SettingsPage() {
  return settingsPageContent
}

const settingsPageContent = (
  <div className='mx-auto max-w-5xl space-y-10'>
    <PageHeader
      kicker='Settings'
      title='Configure environments, security, and future webhooks.'
      description='The backend is single-owner today, but the UI is ready for organization roles and audit tooling.'
    />

    <section className='grid gap-6 lg:grid-cols-[1.1fr_0.9fr]'>
      <div className='d-panel-lg'>
        <p className='d-kicker'>Environments</p>
        <h2 className='d-h2'>Production vs test</h2>
        <p className='d-muted-sm'>
          Use separate Stripe keys and webhook secrets for test-mode billing.
        </p>
        <div className='mt-5 flex gap-3'>
          <button
            type='button'
            className='rounded-md bg-brand-blue-500 px-4 py-2 text-xs font-semibold text-black'
          >
            Production
          </button>
          <button
            type='button'
            className='rounded-md border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground'
          >
            Test mode
          </button>
        </div>
        <div className='mt-6 space-y-3 text-sm text-muted-foreground'>
          {envRows.map((row) => (
            <div key={row.label} className='d-inset flex items-center justify-between'>
              <span>{row.label}</span>
              <span className='d-mono-xs'>{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className='d-panel-lg'>
        <p className='d-kicker'>Security</p>
        <h2 className='d-h2'>Hardened by design</h2>
        <div className='mt-5 space-y-3 text-sm text-muted-foreground'>
          {securityItems.map((item) => (
            <div key={item.title} className='d-inset'>
              <p className='text-sm font-semibold text-foreground'>{item.title}</p>
              <p className='d-detail-muted'>{item.detail}</p>
            </div>
          ))}
        </div>
        <div className='mt-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800'>
          Frontend must never assert entitlement. Backend is the source of truth.
        </div>
      </div>
    </section>

    <section className='d-panel-lg'>
      <div className='grid gap-6 lg:grid-cols-3'>
        <div>
          <p className='d-kicker'>Webhooks</p>
          <h2 className='d-h2'>Coming soon</h2>
          <p className='d-muted-sm'>
            Stripe webhooks go to the backend only. Frontend never receives payment events.
          </p>
        </div>
        <div className='rounded-md border border-border bg-background p-4 text-sm text-muted-foreground'>
          <p className='text-xs font-semibold uppercase text-foreground'>Events</p>
          <ul className='mt-2 space-y-1 text-xs'>
            <li>billing.checkout.completed</li>
            <li>billing.credits.applied</li>
            <li>billing.checkout.failed</li>
          </ul>
        </div>
        <div className='rounded-md border border-border bg-background p-4 text-sm text-muted-foreground'>
          <p className='text-xs font-semibold uppercase text-foreground'>Delivery</p>
          <p className='mt-2 text-xs'>
            Configure retries, signing secret rotation, and alerting for failures.
          </p>
        </div>
      </div>
    </section>
  </div>
)
