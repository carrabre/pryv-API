const errorRows = [
  {
    code: '400',
    detail: 'Invalid parameters, model selection, or unsupported stream mode.',
  },
  {
    code: '402',
    detail: 'Payment challenge required. Compatible clients may retry with a payment credential.',
  },
  {
    code: '429',
    detail: 'Rate limit exceeded. Respect Retry-After and the returned rate-limit headers.',
  },
  {code: '500', detail: 'The configured service could not complete the request.'},
  {code: '503', detail: 'The payment or settlement integration is unavailable.'},
] as const

const operationalNotes = [
  'Read pricing and limits from the deployed service rather than hardcoding values in a client.',
  'Authenticate every service-to-service hop and validate timestamps and nonces where replay matters.',
  'Keep settlement credentials server-side and isolate them from the web application.',
  'Define idempotency, reconciliation, retention, and audit controls before accepting payments.',
] as const

export default function MppOperationsReferencePage() {
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
        <p className='d-page-eyebrow'>MPP operations</p>
        <h1 className='mt-3 d-page-title'>Limits, errors, and settlement guidance.</h1>
        <p className='d-lead'>
          Deployment-neutral guidance for operating direct-payment routes without publishing private
          pricing, infrastructure, or settlement configuration.
        </p>
      </header>

      <section className='cv-auto grid gap-6 lg:grid-cols-[1.15fr_0.85fr]'>
        <div className='d-panel-lg'>
          <p className='d-kicker'>Operational notes</p>
          <h2 className='d-h2'>Treat payment as a separate trust boundary</h2>
          <ul className='mt-5 space-y-3 text-sm text-muted-foreground'>
            {operationalNotes.map((note) => (
              <li key={note} className='flex gap-2'>
                <span className='mt-1 h-1.5 w-1.5 rounded-full bg-muted-foreground' />
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className='d-panel-lg'>
          <p className='d-kicker'>Error handling</p>
          <div className='d-muted-stack'>
            {errorRows.map((item) => (
              <div key={item.code} className='doc-info-row'>
                <span className='doc-warning-badge'>{item.code}</span>
                <span>{item.detail}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
