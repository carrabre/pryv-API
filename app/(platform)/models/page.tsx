import {PageHeader} from '@/components/platform/page-header'
import {BulletList} from '@/components/platform/bullet-list'
import {Models} from '@/lib/ai/model-catalog'

const providerOrder = ['openai', 'google', 'anthropic', 'xai'] as const

const providerMeta = {
  openai: {label: 'OpenAI'},
  google: {label: 'Google'},
  anthropic: {label: 'Anthropic'},
  xai: {label: 'xAI'},
} as const

type Model = (typeof Models)[keyof typeof Models]

const hiddenModelIds = new Set<Model['id']>([])

const sortedModels = [...Object.values(Models)].sort((a, b) => {
  const aPriority = providerOrder.indexOf(a.provider)
  const bPriority = providerOrder.indexOf(b.provider)
  if (aPriority !== bPriority) return aPriority - bPriority
  return a.name.localeCompare(b.name)
})

const publicModels = sortedModels.filter((model) => !model.devOnly && !hiddenModelIds.has(model.id))

const usageTips = [
  'Cache model lists for hours and refresh on demand.',
  'Show capability badges (vision, PDF, web search) in selectors.',
  'Use /v1/models/{id} for a single model detail view.',
]

function getCapabilitySummary(model: Model) {
  return [
    `Vision ${model.supportsVision ? 'yes' : 'no'}`,
    `PDF ${model.supportsPdf ? 'yes' : 'no'}`,
    `Web search ${model.supportsWebSearch ? 'yes' : 'no'}`,
  ].join(' / ')
}

function createModelRow(model: Model) {
  const provider = providerMeta[model.provider]
  return (
    <div key={model.id} className='d-model-row'>
      <span>{provider.label}</span>
      <span className='font-semibold text-foreground'>{model.name}</span>
      <span className='font-mono text-xs text-foreground'>{model.id}</span>
      <span className='min-w-0'>{getCapabilitySummary(model)}</span>
    </div>
  )
}

const modelRows = publicModels.map(createModelRow)

export default function ModelsPage() {
  return modelsPageContent
}

const modelsPageContent = (
  <div className='mx-auto max-w-5xl space-y-10'>
    <PageHeader
      kicker='Model catalog'
      title='All supported Pryv API models.'
      description='This list mirrors the current production model registry exposed by GET /v1/models and GET /mpp/v1/models.'
    >
      <a href='/docs' className='p-link-secondary'>
        Back to docs
      </a>
      <a href='/api-keys' className='p-link-primary'>
        Create API key
      </a>
    </PageHeader>

    <section className='grid gap-6 lg:grid-cols-[1.1fr_0.9fr]'>
      <div className='d-panel-lg'>
        <p className='d-kicker'>How to query models</p>
        <h2 className='d-h2'>Public model list</h2>
        <p className='d-muted-sm'>
          Use GET /v1/models to populate selectors, then cache the list for hours. Use GET
          /v1/models/{'{id}'} for a single model details response.
        </p>
        <div className='mt-4 d-inline-note'>
          The response is a list of {`{ id, object, created, owned_by }`} entries.
        </div>
      </div>
      <div className='d-panel-lg'>
        <p className='d-kicker'>Reference</p>
        <p className='d-muted-sm'>
          Curl examples and model lookup notes live in the focused API privacy reference now, so
          this catalog can stay compact.
        </p>
        <a href='/docs/reference/api/privacy' className='mt-5 inline-flex p-link-primary'>
          Model lookup reference
        </a>
      </div>
    </section>

    <section className='cv-auto grid gap-6 lg:grid-cols-3'>
      <div className='d-panel'>
        <p className='d-kicker'>Capability legend</p>
        <div className='d-muted-stack'>
          <div className='d-inset-sm'>
            <p className='text-xs font-semibold uppercase text-foreground'>Vision</p>
            <p className='mt-1'>Supports images via messages content parts.</p>
          </div>
          <div className='d-inset-sm'>
            <p className='text-xs font-semibold uppercase text-foreground'>PDF</p>
            <p className='mt-1'>Supports PDF uploads via the pdfs field.</p>
          </div>
          <div className='d-inset-sm'>
            <p className='text-xs font-semibold uppercase text-foreground'>Web search</p>
            <p className='mt-1'>Supports web search and URL fetching in the pipeline.</p>
          </div>
        </div>
      </div>
      <div className='d-panel'>
        <p className='d-kicker'>Availability</p>
        <p className='mt-3 text-sm text-muted-foreground'>
          These are the models exposed to API keys.
        </p>
      </div>
      <div className='d-panel'>
        <p className='d-kicker'>Usage tips</p>
        <BulletList items={usageTips} />
      </div>
    </section>

    <section className='cv-auto space-y-6'>
      <div>
        <p className='d-kicker'>Production models</p>
        <h2 className='d-h2'>{publicModels.length} public models</h2>
        <p className='d-muted-sm'>These appear in GET /v1/models for production API keys.</p>
      </div>
      <div className='mt-5 overflow-x-auto rounded-md border border-border'>
        <div className='d-model-head'>
          <span>Provider</span>
          <span>Model</span>
          <span>ID</span>
          <span>Capabilities</span>
        </div>
        {modelRows}
      </div>
    </section>
  </div>
)
