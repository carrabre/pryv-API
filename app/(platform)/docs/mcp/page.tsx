import {CodeBlock} from '@/components/platform/code-block'
import {PageHeader} from '@/components/platform/page-header'
import {BulletList} from '@/components/platform/bullet-list'

import {CopyPageButton} from './copy-page-button'

export const metadata = {
  title: 'Pryv MCP',
  description: 'Connect Pryv MCP to Codex and other remote MCP clients with OAuth.',
}

const mcpUrl = process.env.NEXT_PUBLIC_MCP_URL || 'https://mcp.example.com/mcp'
const platformUrl = process.env.NEXT_PUBLIC_PLATFORM_URL || 'http://localhost:1147'

const codexAddSnippet = `codex mcp add pryv --url ${mcpUrl}`

const codexConfigSnippet = `[mcp_servers.pryv]
url = "${mcpUrl}"`

const codexLoginSnippet = `codex mcp login pryv`

const callbackSnippet = `# Optional OAuth callback overrides
mcp_oauth_callback_port = 5555
mcp_oauth_callback_url = "https://callback.example.com/oauth"`

const codexSteps = [
  `Run codex mcp add pryv --url ${mcpUrl} or add the same URL to config.toml manually.`,
  'Run codex mcp login pryv.',
  'Complete the Pryv web sign-in and OAuth consent flow with the wallet tied to your active Pryv subscription.',
  'Return to Codex and call account.status or chat.run to confirm access.',
]

const genericSteps = [
  `Add Pryv as a remote Streamable HTTP MCP server using ${mcpUrl}.`,
  'Choose OAuth when your client asks how to authenticate.',
  'Complete the Pryv web sign-in and OAuth consent flow.',
  'Reconnect the client and verify the server can call account.status, pii.preview, or chat.run.',
]

const accessRequirements = [
  'An active Pryv Basic or Pro subscription.',
  'A browser-capable OAuth flow so you can sign in with your wallet.',
  'OAuth consent for the MCP client.',
  'A client that supports remote MCP over Streamable HTTP with OAuth.',
]

const referenceCards = [
  {
    label: 'Resources',
    value: 'pryv://models',
    detail: 'Model and capability resources exposed through the MCP sidecar.',
  },
  {
    label: 'Tools',
    value: 'chat.run, pii.preview',
    detail: 'Remote tool names and what each call returns to compatible MCP clients.',
  },
  {
    label: 'PII controls',
    value: '44 entity types',
    detail: 'Default and optional redaction identifiers plus per-request control fields.',
  },
  {
    label: 'Troubleshooting',
    value: '401, 403, callbacks',
    detail: 'Expected pre-login responses, subscription errors, and callback overrides.',
  },
]

export default function PryvMcpDocsPage() {
  return pryvMcpDocsPageContent
}

const pryvMcpDocsPageContent = (
  <div className='d-page-wrap' data-copy-root='mcp-docs'>
    <PageHeader
      kicker='Pryv MCP'
      kickerIconSrc='/icon.svg'
      kickerIconAlt=''
      title='Connect Pryv to Codex and other remote MCP clients.'
      description='Pryv MCP is the OAuth-protected remote MCP surface for secure chat execution, PII preview, and account status. Use it when you want tool-style access from Codex or another Streamable HTTP MCP client.'
    >
      <a href={mcpUrl} target='_blank' rel='noopener noreferrer' className='p-link-primary'>
        Open MCP endpoint
      </a>
      <a href={platformUrl} target='_blank' rel='noopener noreferrer' className='p-link-secondary'>
        Open API platform
      </a>
      <a href='/docs/mcp/reference' className='p-link-secondary'>
        MCP reference
      </a>
      <CopyPageButton />
    </PageHeader>

    <div className='d-note'>
      Canonical MCP server URL: <span className='d-mono'>{mcpUrl}</span>
      <span className='mx-2 text-border'>|</span>
      Pryv API keys are for <span className='d-mono'>/v1/*</span>, not MCP.
    </div>

    <section className='grid gap-6 lg:grid-cols-[1.1fr_0.9fr]'>
      <div className='d-panel-lg'>
        <p className='d-kicker'>Codex setup</p>
        <h2 className='d-h2'>Add Pryv with the CLI or config.toml, then log in with OAuth.</h2>
        <ol className='mt-6 space-y-4 text-sm text-muted-foreground'>
          {codexSteps.map((step, index) => (
            <li key={step} className='flex gap-4'>
              <span className='d-step-badge'>{index + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <div className='mt-6 d-inline-note'>
          The Codex CLI and IDE extension share the same MCP config. Once Pryv is configured, both
          clients can use the same saved server entry.
        </div>
      </div>
      <div className='grid gap-6'>
        <CodeBlock code={codexAddSnippet} label='Codex CLI add' />
        <CodeBlock code={codexConfigSnippet} label='~/.codex/config.toml' />
        <CodeBlock code={codexLoginSnippet} label='Codex OAuth login' />
      </div>
    </section>

    <section className='grid gap-6 lg:grid-cols-[0.95fr_1.05fr]'>
      <CodeBlock code={callbackSnippet} label='Optional callback overrides' />
      <div className='d-panel-lg'>
        <p className='d-kicker'>Any compatible client</p>
        <h2 className='d-h2'>Pryv works with remote Streamable HTTP + OAuth MCP clients.</h2>
        <ol className='mt-6 space-y-4 text-sm text-muted-foreground'>
          {genericSteps.map((step, index) => (
            <li key={step} className='flex gap-4'>
              <span className='d-step-badge'>{index + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <div className='mt-6 d-inline-note'>
          Pryv MCP is a remote HTTP service. There is no stdio wrapper or API-key-only MCP auth path
          in v1.
        </div>
      </div>
    </section>

    <section className='d-even-section'>
      <div className='d-panel-lg'>
        <p className='d-kicker'>Access requirements</p>
        <BulletList
          items={accessRequirements}
          className='d-muted-stack'
          markerClassName='d-brand-marker'
        />
      </div>
      <div className='d-panel-lg'>
        <p className='d-kicker'>Use the right Pryv surface</p>
        <div className='d-muted-stack'>
          <div className='d-inset'>
            <p className='d-eyebrow'>MCP</p>
            <p className='mt-2'>
              Use Pryv MCP when you want remote tool access from Codex or another MCP client.
            </p>
          </div>
          <div className='d-inset'>
            <p className='d-eyebrow'>API</p>
            <p className='mt-2'>
              Use Pryv API keys and <span className='d-mono'>/v1/*</span> when you are integrating
              directly against Pryv&apos;s HTTP API.
            </p>
          </div>
          <div className='d-inset'>
            <p className='d-eyebrow'>MPP</p>
            <p className='mt-2'>
              Use MPP when you need machine-payment flows on <span className='d-mono'>/mpp/*</span>.
              MPP is not the same surface as MCP.
            </p>
          </div>
        </div>
      </div>
    </section>

    <section className='d-split'>
      <div>
        <p className='d-kicker'>Reference</p>
        <h2 className='d-h2'>Tools, PII controls, and troubleshooting are split out.</h2>
        <p className='d-muted-sm'>
          The detailed MCP reference keeps the full resource list, tool behavior, PII entity
          catalog, and OAuth troubleshooting available without attaching it to every setup-page
          response.
        </p>
      </div>
      <div className='grid gap-3 md:grid-cols-2'>
        {referenceCards.map((item) => (
          <a key={item.label} href='/docs/mcp/reference' className='d-link-card'>
            <p className='d-kicker'>{item.label}</p>
            <p className='d-card-value'>{item.value}</p>
            <p className='d-card-detail'>{item.detail}</p>
          </a>
        ))}
      </div>
    </section>
  </div>
)
