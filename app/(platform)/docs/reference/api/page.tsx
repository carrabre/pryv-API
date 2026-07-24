const endpoints = [
  {method: 'GET', path: '/v1/models', auth: 'Bearer', note: 'List available models'},
  {method: 'GET', path: '/v1/models/{id}', auth: 'Bearer', note: 'Model details'},
  {
    method: 'POST',
    path: '/v1/chat/completions',
    auth: 'Bearer',
    note: 'Chat completions, including SSE when stream=true',
  },
  {method: 'POST', path: '/v1/pii/preview', auth: 'Bearer', note: 'Paid PII preview'},
  {method: 'GET', path: '/api/v1/billing/credit-packs', auth: 'Public', note: 'List credit packs'},
  {method: 'GET', path: '/api/v1/billing/balance', auth: 'Wallet', note: 'Credits balance'},
  {method: 'GET', path: '/api/v1/billing/ledger', auth: 'Wallet', note: 'Usage ledger'},
  {
    method: 'GET',
    path: '/api/v1/billing/success',
    auth: 'Browser',
    note: 'Checkout success redirect',
  },
  {
    method: 'GET',
    path: '/api/v1/billing/cancel',
    auth: 'Browser',
    note: 'Checkout cancel redirect',
  },
]

const referenceCards = [
  {
    href: '/docs/reference/api/chat',
    label: 'Chat',
    value: '/v1/chat/completions',
    detail: 'Request parameters, streaming SSE handling, and chat-specific notes.',
  },
  {
    href: '/docs/reference/api/privacy',
    label: 'PII preview',
    value: '/v1/pii/preview',
    detail: 'Privacy controls, aliases, PII config fields, and preview sample code.',
  },
]

const implementationNotes = [
  'GET /v1/models returns the models available to your API key. Cache for hours.',
  'Read model prices and preview fees from the deployed service.',
  'Balances may be returned in microusd (1e-6 USD).',
]

export default function ApiSurfaceReferencePage() {
  return (
    <div className='mx-auto max-w-6xl space-y-10'>
      <header className='d-page-header'>
        <div className='d-header-links'>
          <a href='/docs/reference' className='p-link-secondary'>
            Back to reference
          </a>
          <a href='/models' className='p-link-secondary'>
            Model catalog
          </a>
        </div>
        <p className='d-page-eyebrow'>API surface</p>
        <h1 className='mt-3 d-page-title'>Endpoint map and focused API reference sections.</h1>
        <p className='d-lead'>
          Public API routes use Bearer keys. Wallet-authenticated dashboard routes manage credits,
          balances, ledgers, and checkout state. Detailed chat and PII controls are split into
          smaller reference pages.
        </p>
      </header>

      <section className='cv-auto d-panel-lg'>
        <div className='flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between'>
          <div>
            <p className='d-kicker'>Endpoint catalog</p>
            <h2 className='d-h2'>Public and wallet-auth routes</h2>
          </div>
          <div className='flex flex-wrap gap-2'>
            <a href='/usage' className='p-link-secondary'>
              Usage charts
            </a>
            <a href='/api-keys' className='p-link-primary'>
              API keys
            </a>
          </div>
        </div>
        <div className='mt-6 space-y-3 text-sm text-muted-foreground'>
          {endpoints.map((endpoint) => (
            <div key={`${endpoint.method}-${endpoint.path}`} className='doc-meta-row'>
              <span className='doc-primary-badge'>{endpoint.method}</span>
              <code className='doc-code-badge'>{endpoint.path}</code>
              <span className='d-muted-badge'>{endpoint.auth}</span>
              <span className='text-xs'>{endpoint.note}</span>
            </div>
          ))}
        </div>
      </section>

      <section className='cv-auto grid gap-3 md:grid-cols-2'>
        {referenceCards.map((item) => (
          <a key={item.href} href={item.href} className='d-link-card'>
            <p className='d-kicker'>{item.label}</p>
            <p className='d-card-value'>{item.value}</p>
            <p className='d-card-detail'>{item.detail}</p>
          </a>
        ))}
      </section>

      <section className='cv-auto grid gap-6 lg:grid-cols-[0.9fr_1.1fr]'>
        <div>
          <p className='d-kicker'>Model, pricing, and credit notes</p>
          <h2 className='d-h2'>Operational context stays on the route map.</h2>
        </div>
        <div className='grid gap-3'>
          {implementationNotes.map((note) => (
            <div key={note} className='doc-sm-note'>
              {note}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
