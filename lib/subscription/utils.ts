import type {SubscriptionData, SubscriptionTier} from './types'

const PRICE_TO_TIER: Record<string, 'basic' | 'pro'> = {
  [process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO || '']: 'pro',
}

export function normalizeSubscriptionResponse(
  data: any,
  walletAddress: string,
): SubscriptionData | null {
  if (!data || typeof data !== 'object' || !data.status) return null

  return {
    status: data.status,
    stripeSubId: data.subscription_id || '',
    customerId: '',
    periodEnd: data.expires_at
      ? Number(data.expires_at)
      : data.current_period_end
        ? Number(data.current_period_end)
        : 0,
    priceId: data.plan_id || '',
    walletAddress,
    cancelAtPeriodEnd:
      typeof data.cancel_at_period_end === 'boolean'
        ? Boolean(data.cancel_at_period_end)
        : undefined,
    cancelAt: data.cancel_at ? Number(data.cancel_at) : null,
    tier:
      (data.tier && ['free', 'basic', 'pro'].includes(data.tier)
        ? (data.tier as 'free' | 'basic' | 'pro')
        : PRICE_TO_TIER[(data.plan_id as string) || '']) || undefined,
    uiState: data.ui_state,
    hasPendingUpdate:
      typeof data.has_pending_update === 'boolean' ? Boolean(data.has_pending_update) : undefined,
    previousPlanId: data.previous_plan_id ?? null,
    previousTier: data.previous_tier ?? null,
    planChange: data.plan_change ?? null,
    planChangedAt: data.plan_changed_at ? Number(data.plan_changed_at) : null,
    expiresAt:
      typeof data.expires_at !== 'undefined'
        ? Number(data.expires_at)
        : typeof data.current_period_end !== 'undefined'
          ? Number(data.current_period_end)
          : null,
  }
}

export function deriveTierFromSubscription(
  subscription: SubscriptionData | null | undefined,
): SubscriptionTier | null {
  if (!subscription) return null
  if (subscription.tier && ['free', 'basic', 'pro'].includes(subscription.tier)) {
    return subscription.tier
  }

  switch (subscription.uiState) {
    case 'subscribed_basic':
      return 'basic'
    case 'subscribed_pro':
      return 'pro'
    case 'free':
      return 'free'
    default:
      return null
  }
}
