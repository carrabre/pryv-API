import {PageHeader} from '@/components/platform/page-header'
import {BillingDeferredClient} from './billing-deferred-client'

const billingShell = (
  <div className='mx-auto max-w-5xl space-y-10'>
    <PageHeader
      kicker='Billing & Credits'
      title='Prepaid credits with Stripe Checkout.'
      description='Purchase credits in any amount, then watch the balance update from webhook confirmations.'
    />
  </div>
)

export default function BillingPage() {
  return <BillingDeferredClient>{billingShell}</BillingDeferredClient>
}
