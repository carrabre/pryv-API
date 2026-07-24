import {BulletList} from '@/components/platform/bullet-list'
import {CodeBlock} from '@/components/platform/code-block'
import {getApiBaseUrl} from '@/lib/platform/api-client'

const apiBaseUrl = getApiBaseUrl() || 'https://api.example.com'
const platformBaseUrl = (process.env.NEXT_PUBLIC_PLATFORM_URL ?? '').trim().replace(/\/+$/, '')

const envSnippet = `NEXT_PUBLIC_PLATFORM_URL=${platformBaseUrl || '<your-platform-url>'}
NEXT_PUBLIC_API_BASE_URL=${apiBaseUrl}`

const walletAuthSnippet = `const message = buildWalletAuthMessage({ action: 'create' })
const { walletAddress, signature } = await signWalletMessage(message)

const body = {
  walletAddress,
  message,
  signature,
  name: 'Production key'
}`

const referenceLinks = [
  {
    href: '/docs/reference/api',
    label: 'API surface',
    value: '/v1/*',
    detail: 'Endpoint catalog, chat parameters, model calls, and PII preview controls.',
  },
  {
    href: '/docs/reference/operations',
    label: 'Operations',
    value: 'errors, limits, security',
    detail: 'Error envelopes, rate-limit headers, retry guidance, telemetry, and key handling.',
  },
  {
    href: '/docs/mcp',
    label: 'MCP',
    value: 'mcp.example.com/mcp',
    detail: 'Remote OAuth-backed MCP setup for Codex and compatible clients.',
  },
  {
    href: '/docs/mpp',
    label: 'MPP',
    value: '/mpp/*',
    detail: 'Machine-payment preview, key purchase, and Tempo streaming chat flows.',
  },
]

const topologyItems = [
  {label: 'Dashboard', value: platformBaseUrl || '<your-platform-url>'},
  {label: 'Public developer API', value: apiBaseUrl},
]

const environmentItems = [
  {title: 'Test', detail: 'Stripe test mode, separate webhook secret, test base URL.'},
  {title: 'Production', detail: 'Live Stripe, production base URL, separate WAF and rate limits.'},
]

const keyConcepts = [
  {label: 'userId', detail: 'Salted hash of a wallet address.'},
  {label: 'Credits unit', detail: 'Balance values may be returned in microusd (1e-6 USD).'},
  {label: 'Preview cost', detail: 'Read the current preview fee from the deployed service.'},
  {
    label: 'Pricing',
    detail: 'The deployed billing service defines model prices, fees, and adjustments.',
  },
]

const jobs = [
  'Purchase credits -> create key -> call /v1/chat/completions -> ship.',
  'Rotate keys, restrict usage, respond to insufficient credits.',
  'Inspect usage, balances, and request_id for debugging.',
]

export default function ApiReferencePage() {
  return (
    <div className='mx-auto max-w-6xl space-y-10'>
      <header className='d-page-header'>
        <div className='d-header-links'>
          <a href='/docs' className='p-link-secondary'>
            Back to docs
          </a>
          <a href='/llms-full.txt' className='p-link-secondary'>
            Full AI context
          </a>
        </div>
        <p className='d-page-eyebrow'>API reference</p>
        <div className='mt-3 max-w-3xl'>
          <h1 className='d-page-title'>Reference sections split by task.</h1>
          <p className='mt-4 text-base leading-7 text-muted-foreground'>
            Use this index for platform topology and wallet-auth rules. Endpoint parameters and
            operational guidance are split into smaller pages so each reference view loads less
            markup.
          </p>
        </div>
      </header>

      <section className='grid gap-3 md:grid-cols-2'>
        {referenceLinks.map((item) => (
          <a key={item.href} href={item.href} className='d-link-card'>
            <p className='d-kicker'>{item.label}</p>
            <p className='d-card-value'>{item.value}</p>
            <p className='d-card-detail'>{item.detail}</p>
          </a>
        ))}
      </section>

      <section className='doc-third-section'>
        <div className='d-panel'>
          <p className='d-kicker'>Topology</p>
          <p className='mt-3 text-sm text-muted-foreground'>
            Keep the dashboard and API on separate hosts for security and CORS control.
          </p>
          <div className='d-muted-stack'>
            {topologyItems.map((item) => (
              <div key={item.label} className='d-inset-sm'>
                <p className='d-strong-label'>{item.label}</p>
                <p className='mt-1 font-mono text-xs text-muted-foreground'>{item.value}</p>
              </div>
            ))}
          </div>
        </div>
        <CodeBlock code={envSnippet} label='Env config' />
        <div className='d-panel'>
          <p className='d-kicker'>Environments</p>
          <div className='d-muted-stack'>
            {environmentItems.map((item) => (
              <div key={item.title} className='d-inset-sm'>
                <p className='d-strong-label'>{item.title}</p>
                <p className='mt-1 text-sm text-muted-foreground'>{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className='doc-balanced-section'>
        <div className='d-panel-lg'>
          <p className='d-kicker'>Auth model</p>
          <h2 className='d-h2'>Wallet management, Bearer public API.</h2>
          <div className='mt-5 grid gap-3 text-sm text-muted-foreground md:grid-cols-2'>
            <div className='d-inset'>
              <p className='d-strong-label'>Public API</p>
              <p className='mt-1'>Authorization: Bearer $PRYV_API_KEY</p>
            </div>
            <div className='d-inset'>
              <p className='d-strong-label'>Management</p>
              <p className='mt-1'>walletAddress + message + signature (anti-replay)</p>
            </div>
          </div>
          <p className='d-muted-sm'>
            Wallet auth fields can be passed in query params for GET requests or JSON body for POST
            and DELETE requests.
          </p>
          <BulletList
            items={jobs}
            className='mt-5 space-y-2 text-sm text-muted-foreground'
            markerClassName='d-brand-marker'
          />
        </div>
        <CodeBlock code={walletAuthSnippet} label='Wallet signature payload' />
      </section>

      <section className='d-even-section'>
        <div className='d-panel-lg'>
          <p className='d-kicker'>Key concepts</p>
          <div className='mt-5 grid gap-3'>
            {keyConcepts.map((item) => (
              <div key={item.label} className='d-inset'>
                <p className='d-strong-label'>{item.label}</p>
                <p className='d-detail-muted'>{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
        <div className='d-panel-lg'>
          <p className='d-kicker'>Next sections</p>
          <div className='mt-5 grid gap-3'>
            <a href='/docs/reference/api' className='p-link-secondary'>
              Open API surface reference
            </a>
            <a href='/docs/reference/operations' className='p-link-secondary'>
              Open operations reference
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
