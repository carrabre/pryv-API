import {PageHeader} from '@/components/platform/page-header'
import {PlaygroundDeferredClient} from './playground-deferred-client'

const playgroundShell = (
  <div className='mx-auto max-w-5xl space-y-10'>
    <PageHeader
      kicker='API Playground'
      title='Test Pryv bearer and MPP request shapes.'
      description='Build `/v1/*` or `/mpp/*` requests, choose `piiEntities`, and inspect the raw response or payment challenge.'
    />
  </div>
)

export default function PlaygroundPage() {
  return <PlaygroundDeferredClient>{playgroundShell}</PlaygroundDeferredClient>
}
