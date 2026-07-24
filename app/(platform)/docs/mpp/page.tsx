import {BulletList} from '@/components/platform/bullet-list'
import {PageHeader} from '@/components/platform/page-header'

const routeCards = [
  {
    label: 'Discovery',
    value: 'GET /mpp/v1/models',
    detail: 'Free model-id discovery before any payment flow.',
  },
  {
    label: 'Preview',
    value: 'POST /mpp/v1/pii/preview',
    detail: 'Fixed-price paid PII preview without calling the model.',
  },
  {
    label: 'Key purchase',
    value: 'POST /mpp/api/v1/keys',
    detail: 'Buy credits and receive a normal Pryv Bearer API key.',
  },
  {
    label: 'Tempo chat',
    value: 'POST /mpp/v1/chat/completions',
    detail: 'Streaming-only chat with payment SSE events and final receipts.',
  },
]

const gettingStartedSteps = [
  'Configure gateway env vars and confirm /health is configured.',
  'Call free discovery routes before any paid request.',
  'Use MPP-capable clients for preview, key purchase, or Tempo chat.',
  'Switch to Authorization: Bearer $PRYV_API_KEY after an MPP key purchase.',
  'Handle 402 challenges, 429 limits, validation errors, and payment SSE events explicitly.',
]

const canDo = [
  'Use the same extended Pryv chat payload shape as /v1/chat/completions.',
  'Include tools, urls, pdfs, piiEntities, piiConfig, and OpenAI-style image_url parts.',
  'Receive final usage totals and payment receipts in the SSE response.',
]

const cannotDo = [
  'Use /mpp/v1/chat/completions with stream=false today.',
  'Expect byte-for-byte OpenAI SSE; Pryv adds payment and usage events.',
  'Call private service-to-service routes from a browser client.',
]

export default function MppDocsPage() {
  return (
    <div className='d-page-wrap'>
      <PageHeader
        kicker='MPP guide'
        kickerIconSrc='/icon.svg'
        kickerIconAlt=''
        title='Machine-payments access to Pryv endpoints.'
        description='Use /mpp/* for direct paid preview, API-key purchase, and Tempo-based streaming chat. Detailed route tables, pricing math, request bodies, and operational notes now live in the MPP reference.'
      >
        <a href='/docs' className='p-link-secondary'>
          Back to docs
        </a>
        <a href='/docs/mpp/reference' className='p-link-primary'>
          MPP reference
        </a>
      </PageHeader>

      <section className='grid gap-6 lg:grid-cols-[1.05fr_0.95fr]'>
        <div className='d-panel-lg'>
          <p className='d-kicker'>MCP vs MPP</p>
          <h2 className='d-h2'>Looking for OAuth-based MCP access instead?</h2>
          <p className='d-muted-sm'>
            Pryv MCP is the remote Streamable HTTP + OAuth surface for Codex and other MCP clients.
            MPP is a different surface for machine-payment flows on{' '}
            <span className='d-mono'>/mpp/*</span>.
          </p>
          <a href='/docs/mcp' className='doc-action-brand-sm'>
            Open public MCP guide
          </a>
        </div>
        <div className='d-panel-lg'>
          <p className='d-kicker'>Quick distinction</p>
          <div className='d-muted-stack'>
            <div className='d-inset'>
              <p className='d-eyebrow'>MCP</p>
              <p className='mt-2'>
                Subscription-gated remote tool access with OAuth and browser wallet login.
              </p>
            </div>
            <div className='d-inset'>
              <p className='d-eyebrow'>MPP</p>
              <p className='mt-2'>
                Direct paid preview, API-key purchase, and Tempo-based streaming chat.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className='cv-auto grid gap-3 md:grid-cols-2'>
        {routeCards.map((item) => (
          <a key={item.value} href='/docs/mpp/reference' className='d-link-card'>
            <p className='d-kicker'>{item.label}</p>
            <p className='d-card-value'>{item.value}</p>
            <p className='d-card-detail'>{item.detail}</p>
          </a>
        ))}
      </section>

      <section className='doc-balanced-section'>
        <div className='d-panel-lg'>
          <p className='d-kicker'>Getting started</p>
          <h2 className='d-h2'>Bring a client online fast</h2>
          <ol className='mt-6 space-y-4 text-sm text-muted-foreground'>
            {gettingStartedSteps.map((step, index) => (
              <li key={step} className='flex gap-4'>
                <span className='d-step-badge'>{index + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
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

      <section className='d-split'>
        <div>
          <p className='d-kicker'>Full reference</p>
          <h2 className='d-h2'>Route tables and payment details are split out.</h2>
          <p className='d-muted-sm'>
            The detailed MPP reference includes pricing math, route rows, request shapes, SSE
            events, key-purchase fields, errors, rate limits, and settlement notes.
          </p>
        </div>
        <div className='d-panel'>
          <p className='d-kicker'>Open when needed</p>
          <p className='d-muted-sm'>
            Keeping the detailed MPP content on its own route cuts the first guide response without
            removing the current implementation notes.
          </p>
          <a href='/docs/mpp/reference' className='mt-5 inline-flex p-link-primary'>
            Open MPP reference
          </a>
        </div>
      </section>
    </div>
  )
}
