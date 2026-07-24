import {BulletList} from '@/components/platform/bullet-list'
import {CodeBlock} from '@/components/platform/code-block'
import {PageHeader} from '@/components/platform/page-header'

export const metadata = {
  title: 'Pryv MCP reference',
  description: 'Pryv MCP resources, tools, PII controls, and OAuth troubleshooting.',
}

const mcpUrl = process.env.NEXT_PUBLIC_MCP_URL || 'https://mcp.example.com/mcp'

const probeSnippet = `curl -i ${mcpUrl}`

const piiSnippet = `{
  "model": "gpt-5.5",
  "messages": [
    {
      "role": "user",
      "content": "Contact me at user@example.com or +1 202 555 0102"
    }
  ],
  "piiEntities": ["EMAIL_ADDRESS", "PHONE_NUMBER"]
}`

const resourceRows = [
  {
    name: 'pryv://models',
    detail: 'Lists the Pryv model registry exposed through the MCP sidecar.',
  },
  {
    name: 'pryv://capabilities',
    detail: 'Describes supported chat, PII, and capability metadata for the MCP surface.',
  },
]

const toolRows = [
  {
    name: 'chat.run',
    detail:
      'Runs a Pryv chat completion. Standard calls return final structured output, and task mode is optional when the client supports it.',
  },
  {
    name: 'pii.preview',
    detail: 'Builds a Pryv PII-redaction preview without sending the prompt to the model provider.',
  },
  {
    name: 'account.status',
    detail:
      'Returns current Pryv subscription status and access information for the signed-in user.',
  },
]

const piiControlRows = [
  {
    name: 'piiEntities',
    detail: 'Select the exact entity types you want Pryv to detect and redact for this request.',
  },
  {
    name: 'skipPiiRedaction',
    detail:
      'Bypass redaction entirely or per modality with true/false or { text?: boolean, pdf?: boolean, image?: boolean }.',
  },
  {
    name: 'noPiiRedaction',
    detail:
      'Legacy boolean bypass flag that still exists for compatibility with current Pryv request paths.',
  },
  {
    name: 'piiConfig',
    detail: 'Advanced tuning object for jsonMode plus image, pdf, and preview redaction behavior.',
  },
]

const piiDefaultEntityTypes = [
  'CREDIT_CARD',
  'CRYPTO',
  'EMAIL_ADDRESS',
  'IBAN_CODE',
  'IP_ADDRESS',
  'PHONE_NUMBER',
  'MEDICAL_LICENSE',
  'US_BANK_NUMBER',
  'US_DRIVER_LICENSE',
  'US_ITIN',
  'US_PASSPORT',
  'US_SSN',
  'US_EIN',
  'UK_NHS',
  'UK_NINO',
  'ADDRESS',
  'CREDIT_CARD_LAST4',
  'RECEIPT_NUMBER',
]

const piiAdditionalEntityTypes = [
  'DATE',
  'DATE_TIME',
  'LOCATION',
  'NRP',
  'PERSON',
  'URL',
  'ES_NIF',
  'ES_NIE',
  'IT_FISCAL_CODE',
  'IT_DRIVER_LICENSE',
  'IT_VAT_CODE',
  'IT_PASSPORT',
  'IT_IDENTITY_CARD',
  'PL_PESEL',
  'SG_NRIC_FIN',
  'SG_UEN',
  'AU_ABN',
  'AU_ACN',
  'AU_TFN',
  'AU_MEDICARE',
  'IN_PAN',
  'IN_AADHAAR',
  'IN_VEHICLE_REGISTRATION',
  'IN_VOTER',
  'IN_PASSPORT',
  'FI_PERSONAL_IDENTITY_CODE',
]

const troubleshootingItems = [
  'A 401 response from /mcp before login is expected. It means the server is healthy and asking the client to start OAuth.',
  'Pryv API keys are for the Bearer-authenticated /v1/* API. They do not authenticate MCP requests.',
  'If OAuth succeeds but tool calls return subscription_required or 403, confirm the signed-in wallet still has an active Pryv subscription.',
  'If your client requires a fixed callback listener, set mcp_oauth_callback_port and, when needed, mcp_oauth_callback_url.',
]

function InfoRows({items}: {items: readonly {name: string; detail: string}[]}) {
  return (
    <div className='d-muted-stack'>
      {items.map((row) => (
        <div key={row.name} className='d-inset'>
          <p className='d-mono-xs'>{row.name}</p>
          <p className='d-detail-muted'>{row.detail}</p>
        </div>
      ))}
    </div>
  )
}

function EntityPills({items}: {items: readonly string[]}) {
  return <p className='doc-code-list'>{items.join(', ')}</p>
}

export default function PryvMcpReferencePage() {
  return (
    <div className='d-page-wrap'>
      <PageHeader
        kicker='Pryv MCP reference'
        kickerIconSrc='/icon.svg'
        kickerIconAlt=''
        title='MCP resources, tools, PII controls, and troubleshooting.'
        description='Detailed reference material for the OAuth-protected Pryv MCP surface. Setup instructions stay on the main MCP guide.'
      >
        <a href='/docs/mcp' className='p-link-secondary'>
          Back to MCP guide
        </a>
        <a href={mcpUrl} target='_blank' rel='noopener noreferrer' className='p-link-primary'>
          Open MCP endpoint
        </a>
      </PageHeader>

      <div className='d-note'>
        Canonical MCP server URL: <span className='d-mono'>{mcpUrl}</span>
        <span className='mx-2 text-border'>|</span>
        Pryv API keys are for <span className='d-mono'>/v1/*</span>, not MCP.
      </div>

      <section className='d-even-section'>
        <div className='d-panel-lg'>
          <p className='d-kicker'>Resources</p>
          <InfoRows items={resourceRows} />
        </div>
        <div className='d-panel-lg'>
          <p className='d-kicker'>Tools</p>
          <InfoRows items={toolRows} />
        </div>
      </section>

      <section className='cv-auto grid gap-6 lg:grid-cols-[0.95fr_1.05fr]'>
        <div className='grid gap-6'>
          <CodeBlock code={piiSnippet} label='PII preview request shape' />
          <div className='d-panel-lg'>
            <p className='d-kicker'>PII request controls</p>
            <InfoRows items={piiControlRows} />
          </div>
        </div>
        <div className='d-panel-lg'>
          <p className='d-kicker'>PII redaction coverage</p>
          <h2 className='d-h2'>
            Pryv currently advertises 44 redactable PII entity types through MCP.
          </h2>
          <p className='mt-3 text-sm text-muted-foreground'>
            These identifiers come from the same capabilities payload exposed at{' '}
            <span className='d-mono'>pryv://capabilities</span>. If you omit{' '}
            <span className='d-mono'>piiEntities</span>, Pryv falls back to the default set. If you
            include it, you can narrow redaction to the exact entity types you want to scrub from a
            request.
          </p>
          <div className='mt-6 grid gap-4 xl:grid-cols-2'>
            <div className='doc-loose-note'>
              <p className='d-eyebrow'>Default entity types</p>
              <p className='mt-2 text-xs text-muted-foreground'>
                Used automatically when you do not send <span className='d-mono'>piiEntities</span>.
              </p>
              <EntityPills items={piiDefaultEntityTypes} />
            </div>
            <div className='doc-loose-note'>
              <p className='d-eyebrow'>Additional supported types</p>
              <p className='mt-2 text-xs text-muted-foreground'>
                Available when you explicitly request them in{' '}
                <span className='d-mono'>piiEntities</span>.
              </p>
              <EntityPills items={piiAdditionalEntityTypes} />
            </div>
          </div>
        </div>
      </section>

      <section className='cv-auto grid gap-6 lg:grid-cols-[0.95fr_1.05fr]'>
        <CodeBlock code={probeSnippet} label='Unauthenticated probe' />
        <div className='d-panel-lg'>
          <p className='d-kicker'>Troubleshooting</p>
          <BulletList
            items={troubleshootingItems}
            className='d-muted-stack'
            markerClassName='d-brand-marker'
          />
        </div>
      </section>
    </div>
  )
}
