import {PageHeader} from '@/components/platform/page-header'
import {UsageDeferredClient} from './usage-deferred-client'

const usageShell = (
  <div className='mx-auto max-w-5xl space-y-10'>
    <PageHeader
      kicker='Usage'
      title='Track credits, request IDs, and rate limits.'
      description='Ledger entries roll up to daily spend. Use request IDs to correlate with backend logs and support.'
    />
  </div>
)

export default function UsagePage() {
  return <UsageDeferredClient>{usageShell}</UsageDeferredClient>
}
