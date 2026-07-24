import {BulletList} from '@/components/platform/bullet-list'

const mppGuideNotes = [
  'Free discovery routes under /mpp/v1/*.',
  'One-shot paid preview and API-key purchase routes.',
  'Streaming-only Tempo session chat with payment-specific SSE events.',
]

const docsNavigation = [
  {href: '#overview', label: 'Overview'},
  {href: '#start', label: 'Start'},
  {href: '#ai-ready', label: 'AI-ready docs'},
  {href: '#machine-payments', label: 'Machine payments'},
  {href: '/docs/quickstart', label: 'Quickstart'},
  {href: '/docs/reference', label: 'API reference'},
]

const aiResourceLinks = [
  {
    href: '/llms.txt',
    label: 'llms.txt',
    detail: 'Compact index for AI crawlers and coding agents.',
  },
  {
    href: '/llms-full.txt',
    label: 'llms-full.txt',
    detail: 'Full plain-text API, billing, MCP, MPP, and privacy context.',
  },
  {
    href: '/docs/reference',
    label: 'API reference',
    detail: 'Endpoint catalog, auth model, privacy controls, limits, and operations.',
  },
  {
    href: '/docs/mcp',
    label: 'MCP guide',
    detail: 'Remote MCP setup for Codex and compatible clients.',
  },
]

const surfaceCards = [
  {
    label: 'HTTP API',
    value: '/v1/*',
    detail: 'Bearer-key calls for chat, models, and PII preview.',
  },
  {
    label: 'MCP',
    value: 'mcp.example.com/mcp',
    detail: 'OAuth remote tool access for Codex and MCP clients.',
  },
  {
    label: 'MPP',
    value: '/mpp/*',
    detail: 'Machine-payment preview, key purchase, and Tempo streams.',
  },
]

const startCards = [
  {
    href: '/docs/quickstart',
    label: 'Quickstart',
    value: 'credits, key, request',
    detail: 'Step-by-step setup, hello-world request, and Playground validation.',
  },
  {
    href: '/playground',
    label: 'Playground',
    value: '/v1/chat/completions',
    detail: 'Paste a key, pick a model, test streaming, and inspect raw responses.',
  },
  {
    href: '/docs/reference/api',
    label: 'API map',
    value: '/v1/* and billing',
    detail: 'Endpoint rows with focused chat, PII, operations, and rate-limit sections.',
  },
  {
    href: '/docs/mcp',
    label: 'MCP',
    value: 'mcp.example.com/mcp',
    detail: 'Remote OAuth access for Codex and other MCP clients.',
  },
]

export default function DocsPage() {
  return (
    <div className='mx-auto max-w-[1380px]'>
      <div className='doc-shell-grid'>
        <aside className='hidden xl:block'>
          <div className='sticky top-10 space-y-6 text-sm'>
            <div>
              <p className='d-kicker'>Guides</p>
              <nav className='mt-3 space-y-1' aria-label='Docs sections'>
                {docsNavigation.map((item) => (
                  <a key={item.href} href={item.href} className='docs-section-link'>
                    {item.label}
                  </a>
                ))}
              </nav>
            </div>
            <div className='border-t border-border pt-4 text-xs text-muted-foreground'>
              <p className='font-semibold uppercase tracking-widest text-foreground'>
                Canonical guide
              </p>
              <p className='mt-2 font-mono'>docs/ARCHITECTURE.md</p>
            </div>
          </div>
        </aside>

        <article className='min-w-0 space-y-10'>
          <header id='overview' className='scroll-mt-8 border-b border-border pb-10'>
            <p className='doc-kicker-brand'>
              <span className='h-2 w-2 rounded-full bg-brand-blue-500' />
              Pryv API Platform
            </p>
            <div className='mt-4 max-w-3xl'>
              <h1 className='d-page-title'>Keys, credits, and private AI docs in one platform.</h1>
              <p className='mt-4 text-base leading-7 text-muted-foreground'>
                Create wallet-managed API keys, add credits, and call Pryv&apos;s public API with
                Bearer auth. The detailed endpoint catalog now lives in the API reference so this
                overview stays fast.
              </p>
            </div>
            <div className='mt-7 flex flex-wrap gap-2'>
              <a href='/api-keys' className='doc-action-dark'>
                Create API key
              </a>
              <a href='/docs/quickstart' className='p-link-secondary'>
                Quickstart
              </a>
              <a href='/docs/reference' className='p-link-secondary'>
                API reference
              </a>
              <a href='/llms-full.txt' className='p-link-secondary'>
                llms-full.txt
              </a>
            </div>
            <div className='mt-8 grid gap-3 md:grid-cols-3'>
              {surfaceCards.map((surface) => (
                <div key={surface.label} className='doc-card'>
                  <p className='d-kicker'>{surface.label}</p>
                  <p className='d-card-value'>{surface.value}</p>
                  <p className='d-card-detail'>{surface.detail}</p>
                </div>
              ))}
            </div>
          </header>

          <section id='start' className='scroll-mt-8'>
            <div className='max-w-3xl'>
              <p className='d-kicker'>Start</p>
              <h2 className='d-h2'>Pick the right entry point.</h2>
              <p className='doc-section-copy'>
                Setup steps, samples, and endpoint details now live on focused routes so this
                overview stays small.
              </p>
            </div>
            <div className='mt-6 grid gap-3 md:grid-cols-2'>
              {startCards.map((item) => (
                <a key={item.href} href={item.href} className='d-link-card'>
                  <p className='d-kicker'>{item.label}</p>
                  <p className='d-card-value'>{item.value}</p>
                  <p className='d-card-detail'>{item.detail}</p>
                </a>
              ))}
            </div>
          </section>

          <section id='ai-ready' className='scroll-mt-8 border-y border-border py-8'>
            <div className='max-w-3xl'>
              <p className='d-kicker'>AI-ready docs</p>
              <h2 className='d-h2'>Plain-text context for agents and crawlers.</h2>
              <p className='doc-section-copy'>
                Stable plain-text exports summarize product context, auth rules, endpoint contracts,
                error handling, and MCP/MPP surfaces without requiring a browser session.
              </p>
            </div>
            <div className='mt-6 grid gap-3 md:grid-cols-2'>
              {aiResourceLinks.map((item) => (
                <a key={item.href} href={item.href} className='d-link-card'>
                  <span className='d-mono-strong'>{item.label}</span>
                  <span className='mt-2 block text-xs leading-5 text-muted-foreground'>
                    {item.detail}
                  </span>
                </a>
              ))}
            </div>
          </section>

          <section
            id='machine-payments'
            className='cv-auto scroll-mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]'
          >
            <div className='d-panel-lg'>
              <p className='d-kicker'>Machine payments</p>
              <h2 className='d-h2'>Need direct paid MPP access?</h2>
              <p className='d-muted-sm'>
                Pryv also exposes an MPP surface under <span className='d-mono'>/mpp/*</span> for
                direct paid preview, API-key purchase, and Tempo-based streaming chat.
              </p>
              <a href='/docs/mpp' className='doc-action-brand-sm'>
                Open MPP guide
              </a>
            </div>
            <div className='d-panel-lg'>
              <p className='d-kicker'>MPP highlights</p>
              <BulletList
                items={mppGuideNotes}
                className='d-muted-stack'
                markerClassName='d-brand-marker'
              />
            </div>
          </section>

          <section className='d-split'>
            <div>
              <p className='d-kicker'>Reference</p>
              <h2 className='d-h2'>Full endpoint details are split out.</h2>
              <p className='d-muted-sm'>
                The API reference includes topology, wallet auth, endpoint rows, chat parameters,
                PII controls, error envelopes, rate limits, and operational notes.
              </p>
            </div>
            <div className='d-panel'>
              <p className='d-kicker'>Open when needed</p>
              <p className='d-muted-sm'>
                Keeping reference content on its own route cuts the first `/docs` response while
                preserving the detailed material for humans and authenticated agents.
              </p>
              <a href='/docs/reference' className='mt-5 inline-flex p-link-primary'>
                Open API reference
              </a>
            </div>
          </section>
        </article>

        <aside className='hidden 2xl:block'>
          <div className='sticky top-10 space-y-4 text-xs text-muted-foreground'>
            <p className='font-semibold uppercase tracking-widest text-foreground'>Resources</p>
            <nav className='space-y-1' aria-label='Docs resources'>
              <a href='/docs/reference' className='doc-plain-link'>
                API reference
              </a>
              <a href='/docs/mcp' className='doc-plain-link'>
                MCP guide
              </a>
              <a href='/docs/mpp' className='doc-plain-link'>
                MPP guide
              </a>
              <a href='/llms-full.txt' className='doc-plain-link'>
                llms-full.txt
              </a>
            </nav>
          </div>
        </aside>
      </div>
    </div>
  )
}
