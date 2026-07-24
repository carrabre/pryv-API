import {BulletList} from '@/components/platform/bullet-list'
import {PageHeader} from '@/components/platform/page-header'

const routeRows = [
  {
    method: 'GET',
    path: '/mpp/v1/models',
    payment: 'Free',
    note: 'Model ids only. No pricing metadata is returned today.',
  },
  {
    method: 'GET',
    path: '/mpp/v1/chat/completions/capabilities',
    payment: 'Free',
    note: 'Request-field, tool, media, and PII capability discovery.',
  },
  {
    method: 'POST',
    path: '/mpp/v1/pii/preview',
    payment: 'Service-defined fee',
    note: 'Builds a redacted preview and returns piiParameters without calling the model.',
  },
  {
    method: 'POST',
    path: '/mpp/api/v1/keys',
    payment: 'Arbitrary usdAmount',
    note: 'Credits a Pryv account and returns a fresh Pryv API key.',
  },
  {
    method: 'POST',
    path: '/mpp/v1/chat/completions',
    payment: 'Tempo session',
    note: 'Streaming-only chat with incremental prompt and output charging.',
  },
] as const

const canDo = [
  'Use free discovery routes before any payment flow.',
  'Send the same extended Pryv chat payload used by /v1/chat/completions.',
  'Use piiEntities to target only the PII types you want redacted.',
  'Buy a normal Pryv API key with MPP and then switch to Bearer auth on /v1/*.',
  'Receive final usage totals and payment receipts in the same SSE response.',
] as const

const cannotDo = [
  'Use /mpp/v1/chat/completions with stream=false. The current implementation requires stream=true.',
  'Expect byte-for-byte OpenAI SSE. Pryv adds payment-need-voucher, pryv.usage, and payment-receipt events.',
  'Call private service-to-service routes from a browser client.',
  'Fetch price metadata from /mpp/v1/models. The route returns ids only today.',
] as const

const referenceLinks = [
  {
    href: '/docs/mpp/reference/chat',
    label: 'Requests',
    value: 'chat, key purchase, SSE',
    detail: 'MPP chat fields, key-purchase fields, one-shot examples, and event names.',
  },
  {
    href: '/docs/mpp/reference/operations',
    label: 'Operations',
    value: 'limits, errors, settlement',
    detail: 'Deployment-neutral error handling and payment trust-boundary guidance.',
  },
]

function RouteTable() {
  return (
    <div className='mt-5 overflow-x-auto rounded-md border border-border'>
      <div className='doc-route-header'>
        <span>Method</span>
        <span>Route</span>
        <span>Payment</span>
        <span>Notes</span>
      </div>
      {routeRows.map((row) => (
        <div key={`${row.method}-${row.path}`} className='doc-route-row'>
          <span className='font-semibold text-foreground'>{row.method}</span>
          <span className='doc-break-mono'>{row.path}</span>
          <span className='min-w-0'>{row.payment}</span>
          <span className='min-w-0'>{row.note}</span>
        </div>
      ))}
    </div>
  )
}

export default function MppReferencePage() {
  return (
    <div className='d-page-wrap'>
      <PageHeader
        kicker='MPP reference'
        kickerIconSrc='/icon.svg'
        kickerIconAlt=''
        title='MPP route map and reference sections.'
        description='Detailed MPP request, pricing, error, and settlement notes are split into smaller pages so each authenticated reference route stays light.'
      >
        <a href='/docs/mpp' className='p-link-secondary'>
          Back to MPP guide
        </a>
        <a href='/docs' className='p-link-secondary'>
          Back to docs
        </a>
      </PageHeader>

      <div className='d-note'>
        Implementation source of truth: <span className='d-mono'>pryv-tee/docs/MPP_README.md</span>,{' '}
        <span className='d-mono'>mpp-gateway/src/server.mjs</span>,{' '}
        <span className='d-mono'>app.py</span>, and <span className='d-mono'>models.py</span>.
      </div>

      <section className='grid gap-3 md:grid-cols-2'>
        {referenceLinks.map((item) => (
          <a key={item.href} href={item.href} className='d-link-card'>
            <p className='d-kicker'>{item.label}</p>
            <p className='d-card-value'>{item.value}</p>
            <p className='d-card-detail'>{item.detail}</p>
          </a>
        ))}
      </section>

      <section className='cv-auto grid gap-6 lg:grid-cols-[1.2fr_0.8fr]'>
        <div className='d-panel-lg'>
          <p className='d-kicker'>Route map</p>
          <h2 className='d-h2'>What is exposed today</h2>
          <p className='d-muted-sm'>
            Pryv exposes free discovery routes, paid one-shot routes, and a Tempo session chat route
            under <span className='d-mono'>/mpp/*</span>.
          </p>
          <RouteTable />
          <div className='mt-4 d-inline-note'>
            Paid rows return <span className='d-mono'>402 Payment Required</span> until the client
            retries with an MPP credential. Free discovery routes return normal JSON immediately.
          </div>
        </div>
        <div className='grid gap-6'>
          <div className='d-panel'>
            <p className='d-kicker'>You can</p>
            <BulletList items={canDo} className='d-muted-stack' markerClassName='d-brand-marker' />
          </div>
          <div className='d-panel'>
            <p className='d-kicker'>You cannot</p>
            <BulletList items={cannotDo} className='d-muted-stack' />
          </div>
        </div>
      </section>
    </div>
  )
}
