export {DEV, PROD, TEST} from '@/lib/runtime'

export const TEE_ENCLAVE_URL = process.env.NEXT_PUBLIC_TEE_ENCLAVE_URL
  ? process.env.NEXT_PUBLIC_TEE_ENCLAVE_URL.replace(/\/+$/, '')
  : undefined

export const buildTeeEnclaveUrl = (path: string) => {
  if (!TEE_ENCLAVE_URL) return undefined
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path
  const base = `${TEE_ENCLAVE_URL}/`
  return new URL(normalizedPath, base).toString()
}

export const buildTeeApiUrl = (path: string, params?: Record<string, string>) => {
  if (!TEE_ENCLAVE_URL) return undefined
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path
  const url = new URL(normalizedPath, `${TEE_ENCLAVE_URL}/`)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
  }
  return url.toString()
}

export const STRIPE_PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

export const DISABLE_STRIPE_LOGS = process.env.NEXT_PUBLIC_DISABLE_STRIPE_LOGS !== '0'

// Expose Stripe Pricing Table ID for embedding multi-plan window on the account page
export const STRIPE_PRICING_TABLE_ID = process.env.NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID

export const guestRegex = /^guest-\d+$/

export const MAX_USER_PROMPT_LENGTH = 10000000
export const MAX_VISION_PAYLOAD_BYTES = 2 * 1024 * 1024
export const MAX_VISION_IMAGES = 5
export const MAX_VISION_IMAGE_MB = 1.5
export const MAX_VISION_IMAGE_BYTES = Math.floor(MAX_VISION_IMAGE_MB * 1024 * 1024)
export const MAX_PDF_MB = 32
export const MAX_PDF_BYTES = MAX_PDF_MB * 1024 * 1024
export const MAX_PDF_PAGES = 100
export const GEMINI_INLINE_MAX_MB = 20
export const GEMINI_INLINE_MAX_BYTES = GEMINI_INLINE_MAX_MB * 1024 * 1024

export const GEMINI_METADATA_CACHE_TTL_MS =
  Number(process.env.NEXT_PUBLIC_GEMINI_METADATA_CACHE_TTL_MS) || 10 * 60 * 1000
