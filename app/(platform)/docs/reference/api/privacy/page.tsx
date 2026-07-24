import {CodeBlock} from '@/components/platform/code-block'
import {getApiBaseUrl} from '@/lib/platform/api-client'

const apiBaseUrl = getApiBaseUrl() || 'https://api.example.com'

const previewSnippet = `export async function piiPreview(
  apiBaseUrl: string,
  apiKey: string,
  req: any
) {
  return fetchJson(apiBaseUrl, '/v1/pii/preview', {
    method: 'POST',
    headers: { Authorization: \`Bearer \${apiKey}\` },
    body: JSON.stringify(req)
  })
}`

const listModelsSnippet = `curl ${apiBaseUrl}/v1/models \\
  -H "Authorization: Bearer $PRYV_API_KEY"`

const piiExamples = [
  {title: 'Redact emails only', detail: 'piiEntities: ["EMAIL_ADDRESS"]'},
  {title: 'Disable image redaction', detail: 'skip_pii_redaction: { image: true }'},
  {title: 'Blur faces strongly', detail: 'piiConfig.image.faces = { blur: "strong" }'},
]

const piiConfigFields = [
  'image.faces.* (face blur controls)',
  'piiConfig.text.engine = "model" and piiConfig.text.scoreThreshold',
  'image.scoreThreshold (OCR and PII strictness)',
  'pdf.scoreThreshold, pdf.maxPages',
]

export default function ApiPrivacyReferencePage() {
  return (
    <div className='d-page-wrap'>
      <header className='d-page-header'>
        <div className='d-header-links'>
          <a href='/docs/reference/api' className='p-link-secondary'>
            Back to API map
          </a>
          <a href='/api-keys' className='p-link-secondary'>
            API keys
          </a>
        </div>
        <p className='d-page-eyebrow'>API privacy</p>
        <h1 className='mt-3 d-page-title'>PII preview controls and model lookup.</h1>
        <p className='d-lead'>
          Privacy controls for Bearer-authenticated API calls, including PII config fields and the
          paid preview helper route.
        </p>
      </header>

      <section className='d-even-section'>
        <div className='d-panel-lg'>
          <p className='d-kicker'>PII controls</p>
          <h2 className='d-h2'>Privacy tuning</h2>
          <div className='mt-5 grid gap-4'>
            {piiExamples.map((example) => (
              <div key={example.title} className='d-inset'>
                <p className='text-sm font-semibold text-foreground'>{example.title}</p>
                <p className='d-detail-muted'>{example.detail}</p>
              </div>
            ))}
          </div>
          <div className='mt-5 d-inline-note'>
            <p className='d-strong-label'>PII config fields</p>
            <ul className='mt-2 space-y-1'>
              {piiConfigFields.map((field) => (
                <li key={field}>{field}</li>
              ))}
            </ul>
          </div>
          <p className='mt-4 text-xs text-muted-foreground'>
            Aliases accepted: pii_entities, pii_config, skipPiiRedaction, no_pii_redaction,
            noPiiRedaction.
          </p>
        </div>
        <CodeBlock code={previewSnippet} label='POST /v1/pii/preview' />
      </section>

      <section className='doc-third-section'>
        <div className='d-panel'>
          <p className='d-kicker'>Models</p>
          <p className='mt-3 text-sm text-muted-foreground'>
            GET /v1/models returns the models available to your API key. Cache for hours.
          </p>
          <a href='/models' className='doc-action-brand-tight'>
            Open model catalog
          </a>
        </div>
        <CodeBlock code={listModelsSnippet} label='List models' />
        <div className='d-panel'>
          <p className='d-kicker'>Pricing and credits</p>
          <p className='mt-3 text-sm text-muted-foreground'>
            The configured billing service returns the applicable model price and preview fee.
          </p>
          <div className='mt-4 d-inline-note'>Balance is stored in microusd (1e-6 USD).</div>
        </div>
      </section>
    </div>
  )
}
