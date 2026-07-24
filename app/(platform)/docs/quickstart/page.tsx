import {CodeBlock} from '@/components/platform/code-block'
import {getApiBaseUrl} from '@/lib/platform/api-client'

const apiBaseUrl = getApiBaseUrl() || 'https://api.example.com'

const helloWorldSnippet = `const apiKey = process.env.PRYV_API_KEY

const res = await fetch('${apiBaseUrl}/v1/chat/completions', {
  method: 'POST',
  headers: {
    Authorization: \`Bearer \${apiKey}\`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'gpt-5.5',
    messages: [{ role: 'user', content: 'Hello Pryv!' }],
    stream: false
  })
})

const data = await res.json()
console.log(data.choices[0].message.content)`

const quickstartSteps = [
  'Set NEXT_PUBLIC_API_BASE_URL and NEXT_PUBLIC_PLATFORM_URL.',
  'Create an API key (shown once).',
  'Buy credits with usdAmount and wait for balance to update.',
  'Call /v1/chat/completions with Bearer auth.',
  'Handle 402 insufficient_credits and 429 rate limits.',
]

const playgroundSteps = [
  'Open the API Playground from the sidebar.',
  'Paste a freshly created API key.',
  'Pick a model and prompt.',
  'Toggle stream to test SSE responses.',
  'Inspect raw responses and status codes.',
]

export default function DocsQuickstartPage() {
  return (
    <div className='d-page-wrap'>
      <header className='d-page-header'>
        <div className='d-header-links'>
          <a href='/docs' className='p-link-secondary'>
            Back to docs
          </a>
          <a href='/docs/reference/api' className='p-link-secondary'>
            API map
          </a>
        </div>
        <p className='d-page-eyebrow'>Quickstart</p>
        <h1 className='mt-3 d-page-title'>Purchase credits, mint a key, ship a request.</h1>
        <p className='d-lead'>
          Create a wallet-managed API key, fund it with credits, and validate a chat completion
          before integrating directly.
        </p>
      </header>

      <section className='doc-two-col-section'>
        <div>
          <p className='d-kicker'>Setup path</p>
          <h2 className='mt-3 text-2xl font-semibold text-foreground'>
            Get to the first request quickly.
          </h2>
          <ol className='mt-6 divide-y divide-border border-y border-border text-sm text-muted-foreground'>
            {quickstartSteps.map((step, index) => (
              <li key={step} className='d-step-pad'>
                <span className='d-mono-muted-xs'>{String(index + 1).padStart(2, '0')}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
        <CodeBlock code={helloWorldSnippet} label='Hello world request' />
      </section>

      <section className='doc-two-col-section'>
        <div>
          <p className='d-kicker'>Test in the UI</p>
          <h2 className='d-h2'>API Playground</h2>
          <p className='d-muted-sm'>
            Validate <span className='d-mono'>/v1/chat/completions</span> with your API key before
            shipping.
          </p>
          <ol className='mt-6 space-y-3 text-sm text-muted-foreground'>
            {playgroundSteps.map((step, index) => (
              <li key={step} className='d-step-row'>
                <span className='d-mono-muted-xs'>{String(index + 1).padStart(2, '0')}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <a href='/playground' className='doc-action-dark-sm'>
            Launch Playground
          </a>
        </div>
        <div className='rounded-md border border-border bg-background p-5'>
          <p className='d-kicker'>Remote MCP access</p>
          <h3 className='mt-2 text-lg font-semibold text-foreground'>
            Need Pryv in Codex or another MCP client?
          </h3>
          <p className='mt-2 text-sm leading-6 text-muted-foreground'>
            A configured Pryv MCP deployment lives at{' '}
            <span className='d-mono'>https://mcp.example.com/mcp</span> and uses OAuth. Pryv Bearer
            API keys are still only for <span className='d-mono'>/v1/*</span>.
          </p>
          <a href='/docs/mcp' className='doc-action-outline-sm'>
            Open MCP guide
          </a>
        </div>
      </section>
    </div>
  )
}
