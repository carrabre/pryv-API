import {BulletList} from '@/components/platform/bullet-list'

const streamingSnippet = `export async function streamChatCompletion(
  apiBaseUrl: string,
  apiKey: string,
  req: any,
  onDelta: (text: string) => void
) {
  const res = await fetch(\`\${apiBaseUrl}/v1/chat/completions\`, {
    method: 'POST',
    headers: {
      Authorization: \`Bearer \${apiKey}\`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ ...req, stream: true })
  })

  if (!res.ok || !res.body) {
    const text = await res.text()
    throw new Error(\`stream failed: \${res.status} \${text}\`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const frames = buffer.split('\\n\\n')
    buffer = frames.pop() || ''

    for (const frame of frames) {
      const line = frame.trim()
      if (!line.startsWith('data:')) continue
      const data = line.slice('data:'.length).trim()
      if (data === '[DONE]') return
      const evt = JSON.parse(data)
      const delta = evt?.choices?.[0]?.delta?.content
      if (typeof delta === 'string' && delta) onDelta(delta)
    }
  }
}`

const chatParams = [
  {field: 'model', type: 'string', required: 'yes', detail: 'Model id from GET /v1/models.'},
  {
    field: 'messages',
    type: 'array',
    required: 'yes',
    detail: 'OpenAI-style messages; last message must include text.',
  },
  {field: 'stream', type: 'boolean', required: 'no', detail: 'When true, returns SSE stream.'},
  {field: 'max_tokens', type: 'number', required: 'no', detail: 'Used for rate-limit estimation.'},
  {field: 'tools', type: 'array', required: 'no', detail: 'OpenAI-style tool definitions.'},
  {field: 'urls', type: 'array', required: 'no', detail: 'URL list to fetch and include.'},
  {field: 'pdfs', type: 'array', required: 'no', detail: 'PDFs as { base64, file_name }.'},
  {
    field: 'privacyMode',
    type: 'string',
    required: 'no',
    detail: 'Prompt privacy label; this API frontend sends legacy_plaintext.',
  },
  {field: 'piiEntities', type: 'array', required: 'no', detail: 'List of PII entity strings.'},
  {
    field: 'piiConfig',
    type: 'object',
    required: 'no',
    detail: 'PII config for piiConfig.text.engine, image, or pdf thresholds.',
  },
  {
    field: 'skip_pii_redaction',
    type: 'bool/object',
    required: 'no',
    detail: 'true or { text, image, pdf }.',
  },
]

const chatNotes = [
  'messages[].content can be a string or an array of parts (type: "text" or "image_url").',
  'Aliases accepted: pii_entities, pii_config, skipPiiRedaction, no_pii_redaction, noPiiRedaction.',
  'Optional header X-Request-Id is echoed into ledger entries for correlation.',
]

type ParamRow = {
  field: string
  type: string
  required: string
  detail: string
}

function ParamTable({items}: {items: ParamRow[]}) {
  return (
    <div className='d-param-table'>
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

export default function ApiChatReferencePage() {
  return (
    <div className='d-page-wrap'>
      <header className='d-page-header'>
        <div className='d-header-links'>
          <a href='/docs/reference/api' className='p-link-secondary'>
            Back to API map
          </a>
          <a href='/models' className='p-link-secondary'>
            Model catalog
          </a>
        </div>
        <p className='d-page-eyebrow'>API chat</p>
        <h1 className='mt-3 d-page-title'>Chat parameters and streaming SSE handling.</h1>
        <p className='d-lead'>
          OpenAI-compatible chat completions with optional tools, URLs, PDFs, and PII controls.
        </p>
      </header>

      <section className='cv-auto grid gap-6 lg:grid-cols-[1.2fr_0.8fr]'>
        <div className='d-panel-lg'>
          <p className='d-kicker'>Chat completions</p>
          <h2 className='d-h2'>POST /v1/chat/completions</h2>
          <ParamTable items={chatParams} />
          <BulletList items={chatNotes} className='mt-4 space-y-2 text-xs text-muted-foreground' />
        </div>
        <div className='d-panel-lg'>
          <p className='d-kicker'>Streaming SSE</p>
          <p className='d-muted-sm'>
            Set stream: true to receive text/event-stream chunks. Streaming ends with [DONE].
          </p>
          <pre className='mt-4 d-muted-pre'>
            <code>{streamingSnippet}</code>
          </pre>
        </div>
      </section>
    </div>
  )
}
