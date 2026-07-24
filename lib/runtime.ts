export const PROD = process.env.NODE_ENV === 'production'
export const DEV = process.env.NODE_ENV === 'development'
export const TEST = Boolean(
  process.env.PLAYWRIGHT_TEST_BASE_URL || process.env.PLAYWRIGHT || process.env.CI_PLAYWRIGHT,
)
