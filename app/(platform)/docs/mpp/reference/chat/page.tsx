import {CodeBlock} from '@/components/platform/code-block'
import {getApiBaseUrl} from '@/lib/platform/api-client'

const apiBaseUrl = getApiBaseUrl() || 'https://api.example.com'

const chatParams = [
  {field: 'model', type: 'string', required: 'yes', detail: 'Model id from GET /mpp/v1/models.'},
  {
    field: 'messages',
    type: 'array',
    required: 'yes',
    detail: 'OpenAI-style messages. The last message must include text content.',
  },
  {field: 'stream', type: 'boolean', required: 'yes', detail: 'Must be true on MPP chat.'},
  {field: 'tools', type: 'array', required: 'no', detail: 'Supports web_search.'},
  {field: 'urls', type: 'array', required: 'no', detail: 'Optional URL grounding list.'},
  {field: 'pdfs', type: 'array', required: 'no', detail: 'Optional PDF attachments.'},
  {
    field: 'skipPiiRedaction',
    type: 'bool/object',
    required: 'no',
    detail: 'true or { text, pdf, image }. Alias: skip_pii_redaction.',
  },
  {
    field: 'piiEntities',
    type: 'array',
    required: 'no',
    detail: 'Explicit entity list. Alias: pii_entities.',
  },
] as const

const keyParams = [
  {field: 'usdAmount', type: 'number', required: 'yes', detail: 'Purchase amount in USD.'},
  {field: 'name', type: 'string', required: 'no', detail: 'Display name for the new Pryv key.'},
  {
    field: 'rateLimitRpm',
    type: 'number',
    required: 'no',
    detail: 'Optional key-level RPM override. Alias: rate_limit_rpm.',
  },
  {
    field: 'rateLimitTpm',
    type: 'number',
    required: 'no',
    detail: 'Optional key-level TPM override. Alias: rate_limit_tpm.',
  },
  {
    field: 'dailySpendLimitUsd',
    type: 'number',
    required: 'no',
    detail: 'Optional daily spend cap. Alias: daily_spend_limit_usd.',
  },
  {
    field: 'expiresInDays',
    type: 'number',
    required: 'no',
    detail: 'Optional relative expiration. Alias: expires_in_days.',
  },
] as const

const sseEvents = [
  {
    event: 'message',
    detail: 'OpenAI-style chat.completion.chunk payloads plus the terminal [DONE] marker.',
  },
  {
    event: 'payment-need-voucher',
    detail: 'Sent when the current channel needs a larger cumulative voucher to continue.',
  },
  {
    event: 'pryv.usage',
    detail: 'Final token counts, input/output microusd, and total_microusd.',
  },
  {
    event: 'payment-receipt',
    detail: 'Final Tempo receipt with channel id, accepted cumulative amount, and spend.',
  },
] as const

const oneShotSnippet = `const preview = await fetch('${apiBaseUrl}/mpp/v1/pii/preview', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'gpt-5.5',
    messages: [{ role: 'user', content: 'Email me at test@example.com' }],
    piiEntities: ['EMAIL_ADDRESS']
  })
}).then((r) => r.json())

const keyPurchase = await fetch('${apiBaseUrl}/mpp/api/v1/keys', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    usdAmount: 5,
    name: 'MPP Key',
    rateLimitRpm: 120,
    rateLimitTpm: 200000
  })
}).then((r) => r.json())`

const chatBodySnippet = `{
  "model": "gpt-5.5",
  "stream": true,
  "messages": [
    {
      "role": "user",
      "content": [
        { "type": "text", "text": "Summarize this file." },
        {
          "type": "image_url",
          "image_url": {
            "url": "https://example.com/screenshot.png",
            "detail": "high"
          }
        }
      ]
    }
  ],
  "tools": ["web_search"],
  "urls": ["https://example.com/context"],
  "pdfs": [{ "base64": "<base64-pdf>" }],
  "piiEntities": ["EMAIL_ADDRESS", "US_SSN"],
  "skipPiiRedaction": { "image": true }
}`

const bearerSnippet = `curl ${apiBaseUrl}/v1/chat/completions \\
  -H "Authorization: Bearer $PRYV_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-5.5",
    "messages": [{ "role": "user", "content": "Hello Pryv" }],
    "stream": false
  }'`

type ParamRow = {
  field: string
  type: string
  required: string
  detail: string
}

function ParamTable({items}: {items: readonly ParamRow[]}) {
  return (
    <div className='d-param-table d-param-wide'>
      <div>
        <span>Field</span>
        <span>Type</span>
        <span>Req</span>
        <span>Notes</span>
      </div>
      {items.map((item) => (
        <div key={item.field}>
          <span className='d-mono'>{item.field}</span>
          <span>{item.type}</span>
          <span>{item.required}</span>
          <span>{item.detail}</span>
        </div>
      ))}
    </div>
  )
}

export default function MppChatReferencePage() {
  return (
    <div className='d-page-wrap'>
      <header className='d-page-header'>
        <div className='d-header-links'>
          <a href='/docs/mpp/reference' className='p-link-secondary'>
            Back to MPP reference
          </a>
          <a href='/docs/mpp' className='p-link-secondary'>
            MPP guide
          </a>
        </div>
        <p className='d-page-eyebrow'>MPP requests</p>
        <h1 className='mt-3 d-page-title'>Chat, key purchase, and SSE response shapes.</h1>
        <p className='d-lead'>
          The current MPP chat route is streaming-only and compatible with Pryv&apos;s extended chat
          payload surface.
        </p>
      </header>

      <section className='d-even-section'>
        <div className='d-panel-lg'>
          <p className='d-kicker'>Chat request shape</p>
          <h2 className='d-h2'>POST /mpp/v1/chat/completions</h2>
          <ParamTable items={chatParams} />
          <div className='mt-5 d-inline-note'>
            Use <span className='d-mono'>piiEntities</span> for exact entity selection and{' '}
            <span className='d-mono'>skipPiiRedaction</span> for per-modality bypass control.
          </div>
        </div>
        <CodeBlock code={chatBodySnippet} label='Example MPP chat body' />
      </section>

      <section className='d-even-section'>
        <div className='d-panel-lg'>
          <p className='d-kicker'>Key purchase body</p>
          <h2 className='d-h2'>POST /mpp/api/v1/keys</h2>
          <ParamTable items={keyParams} />
          <div className='mt-5 d-inline-note'>
            Current default bounds are <span className='d-mono'>API_CREDIT_MIN_USD=1.00</span> and{' '}
            <span className='d-mono'>API_CREDIT_MAX_USD=1000000.00</span> when not overridden.
          </div>
        </div>
        <div className='grid gap-6'>
          <div className='d-panel'>
            <p className='d-kicker'>SSE events</p>
            <div className='d-muted-stack'>
              {sseEvents.map((item) => (
                <div key={item.event} className='d-inset'>
                  <p className='d-mono-xs'>{item.event}</p>
                  <p className='d-detail-muted'>{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
          <div className='d-panel'>
            <p className='d-kicker'>Bearer bridge</p>
            <p className='mt-3 text-sm text-muted-foreground'>
              After MPP key purchase returns <span className='d-mono'>pryv_...</span>, use the
              regular Pryv API on <span className='d-mono'>/v1/*</span>.
            </p>
            <pre className='mt-4 d-muted-pre'>
              <code>{bearerSnippet}</code>
            </pre>
          </div>
        </div>
      </section>

      <section className='d-even-section'>
        <CodeBlock code={oneShotSnippet} label='One-shot preview and key purchase' />
        <div className='d-panel-lg'>
          <p className='d-kicker'>Session smoke</p>
          <p className='d-muted-sm'>
            The repo includes <span className='d-mono'>mpp-gateway/scripts/session-smoke.mjs</span>{' '}
            for a working Tempo session test.
          </p>
        </div>
      </section>
    </div>
  )
}
