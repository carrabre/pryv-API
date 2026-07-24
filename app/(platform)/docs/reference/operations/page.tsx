import {BulletList} from '@/components/platform/bullet-list'

const errorEnvelopeSnippet = `{
  "error": {
    "message": "Missing or invalid API key",
    "type": "authentication_error",
    "code": "invalid_api_key",
    "details": { "optional": "context" }
  }
}`

const rateLimitSnippet = `export function parseRetryAfterSeconds(res: Response): number | null {
  const ra = res.headers.get('Retry-After')
  if (!ra) return null
  const n = Number(ra)
  return Number.isFinite(n) ? n : null
}`

const errorCodes = [
  {code: '401', detail: 'missing_api_key, invalid_api_key, inactive_api_key, missing_wallet_auth.'},
  {
    code: '403',
    detail: 'Wallet auth failures such as ACTION_MISMATCH, NONCE_REPLAY, SIGNATURE_INVALID.',
  },
  {code: '402', detail: 'insufficient_credits - prompt user to add credits.'},
  {code: '429', detail: 'rate_limit_exceeded_rpm or rate_limit_exceeded_tpm. Respect Retry-After.'},
  {code: '400', detail: 'invalid_model, invalid_params, validation errors.'},
  {code: '500', detail: 'internal_error or billing_error.'},
]

const walletErrorCodes = [
  'ACTION_MISMATCH',
  'KEY_ID_MISMATCH',
  'MISSING_NONCE_OR_TS',
  'INVALID_TS',
  'TS_EXPIRED',
  'NONCE_REPLAY',
  'SIGNATURE_INVALID',
  'SIGNATURE_VERIFY_ERROR',
]

const rateLimitHeaders = [
  'X-RateLimit-Limit-RPM',
  'X-RateLimit-Remaining-RPM',
  'X-RateLimit-Reset-RPM',
  'X-RateLimit-Limit-TPM',
  'X-RateLimit-Remaining-TPM',
  'X-RateLimit-Reset-TPM',
  'Retry-After',
]

const securityNotes = [
  'API key is shown once and cannot be recovered.',
  'Never commit keys; avoid localStorage by default.',
  'Frontend never asserts entitlement; backend is source of truth.',
  'Prefer POST for wallet-auth to reduce URL leakage in logs.',
]

const cachingNotes = [
  'Cache GET /v1/models for hours.',
  'Cache keys and balance for 5 to 15 seconds with manual refresh.',
]

const retryNotes = [
  'Retry idempotent GETs with exponential backoff.',
  'Do not auto-retry key creation or checkout creation without user action.',
]

const telemetryEvents = [
  'api_keys_viewed',
  'api_key_created',
  'api_key_revoked',
  'billing_checkout_started',
  'billing_checkout_completed',
  'credits_balance_viewed',
  'insufficient_credits_error_shown',
  'rate_limit_error_shown',
]

export default function OperationsReferencePage() {
  return (
    <div className='mx-auto max-w-6xl space-y-10'>
      <header className='d-page-header'>
        <div className='d-header-links'>
          <a href='/docs/reference' className='p-link-secondary'>
            Back to reference
          </a>
          <a href='/usage' className='p-link-secondary'>
            Usage
          </a>
          <a href='/billing' className='p-link-secondary'>
            Billing
          </a>
        </div>
        <p className='d-page-eyebrow'>Operations reference</p>
        <h1 className='mt-3 d-page-title'>Errors, limits, retries, and security notes.</h1>
        <p className='d-lead'>
          Use this page for production handling around auth failures, insufficient credits, rate
          limits, key safety, and telemetry.
        </p>
      </header>

      <section className='cv-auto grid gap-6 lg:grid-cols-[1.1fr_0.9fr]'>
        <div className='d-panel-lg'>
          <p className='d-kicker'>Error handling</p>
          <h2 className='d-h2'>Handle auth, credits, and limits</h2>
          <div className='mt-5 space-y-3 text-sm text-muted-foreground'>
            {errorCodes.map((item) => (
              <div key={item.code} className='doc-info-row'>
                <span className='doc-warning-badge'>{item.code}</span>
                <span>{item.detail}</span>
              </div>
            ))}
          </div>
          <div className='mt-6 rounded-md border border-border bg-background px-4 py-3'>
            <p className='d-kicker'>Error envelope</p>
            <pre className='mt-2 overflow-x-auto text-xs text-foreground font-mono'>
              <code>{errorEnvelopeSnippet}</code>
            </pre>
          </div>
          <p className='mt-4 text-xs text-muted-foreground'>
            Wallet error codes: {walletErrorCodes.join(', ')}.
          </p>
        </div>
        <div className='d-panel-lg'>
          <p className='d-kicker'>Rate limits</p>
          <p className='d-muted-sm'>
            Public API responses include rate limit headers and Retry-After on 429.
          </p>
          <div className='mt-4 d-inline-note'>
            <ul className='space-y-1'>
              {rateLimitHeaders.map((header) => (
                <li key={header}>{header}</li>
              ))}
            </ul>
          </div>
          <pre className='mt-4 d-muted-pre'>
            <code>{rateLimitSnippet}</code>
          </pre>
        </div>
      </section>

      <section className='doc-third-section'>
        <div className='d-panel'>
          <p className='d-kicker'>Security</p>
          <BulletList items={securityNotes} />
        </div>
        <div className='d-panel'>
          <p className='d-kicker'>Operations</p>
          <p className='mt-3 text-sm text-muted-foreground'>Caching</p>
          <BulletList
            items={cachingNotes}
            className='mt-2 space-y-2 text-sm text-muted-foreground'
          />
          <p className='mt-4 text-sm text-muted-foreground'>Retries</p>
          <BulletList items={retryNotes} className='mt-2 space-y-2 text-sm text-muted-foreground' />
        </div>
        <div className='d-panel'>
          <p className='d-kicker'>Telemetry events</p>
          <ul className='mt-4 space-y-2 text-sm text-muted-foreground'>
            {telemetryEvents.map((event) => (
              <li key={event} className='doc-code-chip'>
                {event}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
