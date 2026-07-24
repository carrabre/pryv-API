import {PageHeader} from '@/components/platform/page-header'
import {ApiKeysDeferredClient} from './api-keys-deferred-client'

const apiKeysShell = (
  <div className='mx-auto max-w-5xl space-y-10'>
    <PageHeader
      kicker='API Keys'
      title='Issue keys once, store safely, rotate on schedule.'
      description='Create bearer credentials for server-side integrations. Set per-key limits and revoke access instantly.'
    />
  </div>
)

export default function ApiKeysPage() {
  return <ApiKeysDeferredClient>{apiKeysShell}</ApiKeysDeferredClient>
}
