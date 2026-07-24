'use client'

import {useCallback, useMemo, useState} from 'react'
import {PageHeader} from '@/components/platform/page-header'
import {toast} from '@/components/toast-store'
import {getApiBaseUrl} from '@/lib/platform/api-client'

type PlaygroundResponse = {
  output: string
  raw: string
  status: number
}

type ApiSurface = 'bearer' | 'mpp'
type EndpointMode = 'chat' | 'preview'

type UploadedAsset = {
  id: string
  name: string
  contentType: string
  dataUrl: string
  kind: 'image' | 'video'
}

const modelOptions = [
  {id: 'claude-opus-4-7', name: 'Claude Opus 4.7'},
  {id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6'},
  {id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview'},
  {id: 'gpt-5.4', name: 'GPT 5.4'},
  {id: 'gpt-5.5', name: 'GPT 5.5'},
  {id: 'grok-4-1-fast-reasoning', name: 'Grok 4.1 Fast Reasoning'},
] as const

const piiEntityOptions = [
  'EMAIL_ADDRESS',
  'PHONE_NUMBER',
  'PERSON',
  'ADDRESS',
  'US_SSN',
  'US_ITIN',
  'US_PASSPORT',
  'US_DRIVER_LICENSE',
  'CREDIT_CARD',
  'CREDIT_CARD_LAST4',
  'US_BANK_NUMBER',
  'US_EIN',
  'IBAN_CODE',
  'CRYPTO',
  'IP_ADDRESS',
  'DATE_TIME',
  'DATE',
  'URL',
] as const

const piiEntityLabels: Record<(typeof piiEntityOptions)[number], string> = {
  EMAIL_ADDRESS: 'Email',
  PHONE_NUMBER: 'Phone',
  PERSON: 'Person',
  ADDRESS: 'Address',
  US_SSN: 'SSN',
  US_ITIN: 'ITIN',
  US_PASSPORT: 'Passport',
  US_DRIVER_LICENSE: 'Driver License',
  CREDIT_CARD: 'Credit Card',
  CREDIT_CARD_LAST4: 'Card Last 4',
  US_BANK_NUMBER: 'US Bank',
  US_EIN: 'EIN',
  IBAN_CODE: 'IBAN',
  CRYPTO: 'Crypto',
  IP_ADDRESS: 'IP Address',
  DATE_TIME: 'Date/Time',
  DATE: 'Date',
  URL: 'URL',
}

function formatJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function toDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read file.'))
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(file)
  })
}

export default function PlaygroundClient() {
  const apiBaseUrl = getApiBaseUrl()
  const canUseBearerApi = Boolean(apiBaseUrl)
  const [surface, setSurface] = useState<ApiSurface>('bearer')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('gpt-5.5')
  const [prompt, setPrompt] = useState('Hello from the Pryv API Playground.')
  const [stream, setStream] = useState(false)
  const [endpoint, setEndpoint] = useState<EndpointMode>('chat')
  const [piiEntities, setPiiEntities] = useState<Array<(typeof piiEntityOptions)[number]>>([
    'EMAIL_ADDRESS',
    'PHONE_NUMBER',
  ])
  const [assets, setAssets] = useState<UploadedAsset[]>([])
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<PlaygroundResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const messageContent = useMemo(() => {
    if (!assets.length) return prompt
    const parts: Array<
      | {type: 'text'; text: string}
      | {type: 'image_url'; image_url: {url: string; detail?: string}}
      | {type: 'video_url'; video_url: {url: string}}
    > = [{type: 'text', text: prompt}]

    assets.forEach((asset) => {
      if (asset.kind === 'image') {
        parts.push({type: 'image_url', image_url: {url: asset.dataUrl, detail: 'auto'}})
      } else {
        parts.push({type: 'video_url', video_url: {url: asset.dataUrl}})
      }
    })

    return parts
  }, [assets, prompt])

  const requestBody = useMemo(() => {
    if (endpoint === 'preview') {
      return {
        model,
        messages: [{role: 'user', content: messageContent}],
        ...(piiEntities.length ? {piiEntities} : {}),
      }
    }
    return {
      model,
      messages: [{role: 'user', content: messageContent}],
      stream: surface === 'mpp' ? true : stream,
      ...(piiEntities.length ? {piiEntities} : {}),
    }
  }, [endpoint, messageContent, model, piiEntities, stream, surface])

  const requestPreview = useMemo(() => formatJson(requestBody), [requestBody])

  const requestPath = useMemo(() => {
    if (surface === 'mpp') {
      return endpoint === 'preview' ? '/mpp/v1/pii/preview' : '/mpp/v1/chat/completions'
    }
    return endpoint === 'preview' ? '/v1/pii/preview' : '/v1/chat/completions'
  }, [endpoint, surface])

  const requestUrl = useMemo(() => {
    if (surface === 'mpp') {
      return `/api/playground/mpp${requestPath.slice('/mpp'.length)}`
    }
    return `${apiBaseUrl}${requestPath}`
  }, [apiBaseUrl, requestPath, surface])

  const togglePiiEntity = useCallback((entity: (typeof piiEntityOptions)[number]) => {
    setPiiEntities((current) =>
      current.includes(entity) ? current.filter((item) => item !== entity) : [...current, entity],
    )
  }, [])

  const handleUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (!files.length) return

    try {
      const uploaded = await Promise.all(
        files.map(async (file) => {
          const dataUrl = await toDataUrl(file)
          const contentType = file.type || 'application/octet-stream'
          const kind = contentType.startsWith('video') ? 'video' : 'image'
          return {
            id: `${file.name}-${file.size}-${file.lastModified}`,
            name: file.name,
            contentType,
            dataUrl,
            kind,
          } satisfies UploadedAsset
        }),
      )
      setAssets((prev) => [...prev, ...uploaded])
      event.target.value = ''
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload file.'
      toast({type: 'error', description: message})
    }
  }, [])

  const handleRemoveAsset = useCallback((id: string) => {
    setAssets((prev) => prev.filter((asset) => asset.id !== id))
  }, [])

  const handleSubmit = useCallback(async () => {
    if (surface === 'bearer' && !canUseBearerApi) {
      toast({type: 'error', description: 'Missing NEXT_PUBLIC_API_BASE_URL.'})
      return
    }
    if (surface === 'bearer' && !apiKey.trim()) {
      toast({type: 'error', description: 'Add an API key to send a request.'})
      return
    }
    if (!model.trim()) {
      toast({type: 'error', description: 'Model is required.'})
      return
    }
    if (!prompt.trim()) {
      toast({type: 'error', description: 'Prompt is required.'})
      return
    }

    setLoading(true)
    setError(null)
    setResponse(null)

    try {
      const res = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          ...(surface === 'bearer' ? {Authorization: `Bearer ${apiKey.trim()}`} : {}),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!res.ok) {
        const text = await res.text()
        const message = text ? text : `Request failed: ${res.status}`
        setError(message)
        setResponse({output: '', raw: message, status: res.status})
        return
      }

      if (endpoint === 'chat' && (surface === 'mpp' || stream)) {
        if (!res.body) {
          throw new Error('Streaming response was empty.')
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let output = ''
        let raw = ''

        while (true) {
          const {done, value} = await reader.read()
          if (done) break
          buffer += decoder.decode(value, {stream: true})

          const frames = buffer.split('\n\n')
          buffer = frames.pop() || ''

          for (const frame of frames) {
            const line = frame.trim()
            if (!line.startsWith('data:')) continue
            const data = line.slice('data:'.length).trim()
            raw += `data: ${data}\n\n`
            if (data === '[DONE]') {
              setResponse({output, raw, status: res.status})
              return
            }
            const evt = JSON.parse(data)
            const delta = evt?.choices?.[0]?.delta?.content
            if (typeof delta === 'string' && delta) {
              output += delta
              setResponse({output, raw, status: res.status})
            }
          }
        }

        setResponse({output, raw, status: res.status})
        return
      }

      const json = await res.json()
      if (endpoint === 'preview') {
        setResponse({
          output: formatJson(json?.preview ?? json),
          raw: formatJson(json),
          status: res.status,
        })
        return
      }
      const output = json?.choices?.[0]?.message?.content ?? ''
      setResponse({output, raw: formatJson(json), status: res.status})
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Request failed.'
      setError(message)
      setResponse({output: '', raw: message, status: 0})
    } finally {
      setLoading(false)
    }
  }, [apiKey, canUseBearerApi, endpoint, model, prompt, requestBody, requestUrl, stream, surface])

  return (
    <div className='mx-auto max-w-5xl space-y-10'>
      <PageHeader
        kicker='API Playground'
        title='Test Pryv bearer and MPP request shapes.'
        description='Build `/v1/*` or `/mpp/*` requests, choose `piiEntities`, and inspect the raw response or payment challenge.'
      />

      {surface === 'bearer' && !canUseBearerApi ? (
        <div className='rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800'>
          NEXT_PUBLIC_API_BASE_URL is not configured.
        </div>
      ) : null}

      <section className='grid gap-6 lg:grid-cols-[1.05fr_0.95fr]'>
        <div className='rounded-md border border-border bg-background p-6 text-foreground lg:p-8'>
          <h2 className='text-2xl font-semibold text-foreground'>Request builder</h2>
          <p className='mt-2 text-sm text-muted-foreground'>
            Use bearer mode for `pryv_...` keys. Use MPP mode to build direct-pay requests and
            inspect the raw `402 Payment Required` challenge before wiring an MPP client.
          </p>
          <div className='mt-6 grid gap-4'>
            <div>
              <label
                htmlFor='playground-surface'
                className='text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground'
              >
                Surface
              </label>
              <select
                id='playground-surface'
                value={surface}
                onChange={(event) => {
                  const next = event.target.value as ApiSurface
                  setSurface(next)
                  if (next === 'mpp' && endpoint === 'chat') {
                    setStream(true)
                  }
                }}
                className='mt-2 w-full rounded-md border border-input bg-background px-4 py-3 text-sm text-foreground'
              >
                <option value='bearer'>Bearer API (/v1/*)</option>
                <option value='mpp'>MPP direct-pay (/mpp/*)</option>
              </select>
            </div>
            <div>
              <label
                htmlFor='playground-endpoint'
                className='text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground'
              >
                Endpoint
              </label>
              <select
                id='playground-endpoint'
                value={endpoint}
                onChange={(event) => {
                  const next = event.target.value as EndpointMode
                  setEndpoint(next)
                  if (next === 'preview' && surface === 'bearer') setStream(false)
                  if (next === 'chat' && surface === 'mpp') setStream(true)
                }}
                className='mt-2 w-full rounded-md border border-input bg-background px-4 py-3 text-sm text-foreground'
              >
                <option value='chat'>
                  {surface === 'mpp'
                    ? 'POST /mpp/v1/chat/completions'
                    : 'POST /v1/chat/completions'}
                </option>
                <option value='preview'>
                  {surface === 'mpp' ? 'POST /mpp/v1/pii/preview' : 'POST /v1/pii/preview'}
                </option>
              </select>
            </div>
            {surface === 'bearer' ? (
              <div>
                <label
                  htmlFor='playground-api-key'
                  className='text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground'
                >
                  API key
                </label>
                <input
                  id='playground-api-key'
                  type='password'
                  placeholder='pryv_...'
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  className='mt-2 w-full rounded-md border border-input bg-background px-4 py-3 text-sm text-foreground'
                />
              </div>
            ) : (
              <div className='rounded-md border border-border bg-background px-4 py-3 text-sm text-muted-foreground'>
                MPP requests go through the server-side playground proxy so the browser can inspect
                the raw payment challenge. Use an MPP client to retry the request with a credential.
              </div>
            )}
            <div className='grid gap-3 sm:grid-cols-2'>
              <div>
                <label
                  htmlFor='playground-model'
                  className='text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground'
                >
                  Model
                </label>
                <select
                  id='playground-model'
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  className='mt-2 w-full rounded-md border border-input bg-background px-4 py-3 text-sm text-foreground'
                >
                  {modelOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name} ({option.id})
                    </option>
                  ))}
                </select>
              </div>
              <div className='flex items-end'>
                <label className='flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground'>
                  <input
                    type='checkbox'
                    checked={surface === 'mpp' ? true : stream}
                    onChange={(event) => setStream(event.target.checked)}
                    disabled={endpoint === 'preview' || surface === 'mpp'}
                    className='h-4 w-4 rounded border border-input disabled:opacity-60'
                  />
                  Stream response {surface === 'mpp' ? '(required)' : ''}
                </label>
              </div>
            </div>
            <div>
              <label
                htmlFor='playground-prompt'
                className='text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground'
              >
                Prompt
              </label>
              <textarea
                id='playground-prompt'
                rows={6}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                className='mt-2 w-full rounded-md border border-input bg-background px-4 py-3 text-sm text-foreground'
              />
            </div>
            <div>
              <div className='flex items-center justify-between gap-3'>
                <span className='text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground'>
                  PII entities
                </span>
                <button
                  type='button'
                  onClick={() => setPiiEntities([])}
                  className='text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground'
                >
                  Use backend defaults
                </button>
              </div>
              <div className='mt-2 flex flex-wrap gap-2'>
                {piiEntityOptions.map((entity) => {
                  const active = piiEntities.includes(entity)
                  return (
                    <button
                      key={entity}
                      type='button'
                      onClick={() => togglePiiEntity(entity)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        active
                          ? 'border-brand-blue-500 bg-brand-blue-500 text-black'
                          : 'border-border bg-background text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {piiEntityLabels[entity]}
                    </button>
                  )
                })}
              </div>
              <p className='mt-2 text-xs text-muted-foreground'>
                Selected values are sent as{' '}
                <span className='font-mono text-foreground'>piiEntities</span>. Leave this empty to
                let the backend use its current default entity list.
              </p>
            </div>
            <div>
              <label
                htmlFor='playground-uploads'
                className='text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground'
              >
                Uploads (images or videos)
              </label>
              <input
                id='playground-uploads'
                type='file'
                accept='image/*,video/*'
                multiple
                onChange={handleUpload}
                className='mt-2 block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-muted file:px-4 file:py-2 file:text-xs file:font-semibold file:text-foreground hover:file:bg-muted/80'
              />
              {assets.length ? (
                <div className='mt-3 grid gap-2'>
                  {assets.map((asset) => (
                    <div
                      key={asset.id}
                      className='flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground'
                    >
                      <span className='truncate'>
                        {asset.name} ({asset.contentType})
                      </span>
                      <button
                        type='button'
                        onClick={() => handleRemoveAsset(asset.id)}
                        className='rounded-md border border-border bg-background px-2 py-1 text-[11px] font-semibold text-foreground'
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className='mt-2 text-xs text-muted-foreground'>No attachments yet.</p>
              )}
            </div>
            <button
              type='button'
              onClick={handleSubmit}
              disabled={loading}
              className='rounded-md bg-brand-blue-500 px-6 py-3 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60'
            >
              {loading
                ? 'Sending...'
                : surface === 'mpp'
                  ? 'Send request / inspect challenge'
                  : 'Send request'}
            </button>
          </div>
        </div>

        <div className='space-y-6'>
          <div className='rounded-md border border-border bg-background p-6 text-foreground lg:p-8'>
            <p className='text-xs font-semibold uppercase tracking-widest text-muted-foreground'>
              Request preview
            </p>
            <p className='mt-2 text-sm text-muted-foreground'>
              Target route: <span className='font-mono text-foreground'>{requestPath}</span>
            </p>
            <pre className='mt-4 overflow-x-auto rounded-md bg-muted px-4 py-3 text-xs leading-relaxed text-foreground font-mono'>
              <code>{requestPreview}</code>
            </pre>
          </div>
          <div className='rounded-md border border-border bg-background p-6 text-foreground lg:p-8'>
            <p className='text-xs font-semibold uppercase tracking-widest text-muted-foreground'>
              Response
            </p>
            {error ? <p className='mt-3 text-sm text-red-600'>{error}</p> : null}
            {response ? (
              <div className='mt-4 space-y-4 text-sm text-muted-foreground'>
                <div>
                  <p className='text-xs font-semibold uppercase tracking-widest text-muted-foreground'>
                    Output
                  </p>
                  <pre className='mt-2 whitespace-pre-wrap rounded-md bg-background px-4 py-3 text-xs text-foreground'>
                    {response.output || '—'}
                  </pre>
                </div>
                <div>
                  <p className='text-xs font-semibold uppercase tracking-widest text-muted-foreground'>
                    Raw response (status {response.status})
                  </p>
                  <pre className='mt-2 max-h-64 overflow-auto rounded-md bg-background px-4 py-3 text-xs text-foreground font-mono'>
                    {response.raw || '—'}
                  </pre>
                </div>
              </div>
            ) : (
              <p className='mt-3 text-sm text-muted-foreground'>No response yet.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
