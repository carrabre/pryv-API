import type {APIRequestContext, Browser, BrowserContext, Page} from '@playwright/test'
import {makeAuthCookieValue, PRYV_AUTH_COOKIE} from '@/lib/auth/server-auth-cookie-issue'
import {createThirdwebClient} from 'thirdweb'
import {signLoginPayload} from 'thirdweb/auth'
import {privateKeyToAccount} from 'thirdweb/wallets'
import {keccak256, toBytes} from 'viem'

export type UserContext = {
  context: BrowserContext
  page: Page
  request: APIRequestContext
}

const testThirdwebClient = createThirdwebClient({clientId: 'test-client'})
// Derive a disposable public test account without storing credential-shaped material in source.
const TEST_WALLET_PRIVATE_KEY = keccak256(toBytes('pryv-public-e2e-test-wallet-v1'))

function makeTestWalletAddress(seed: string): `0x${string}` {
  const s = seed.replace(/[^a-f0-9]/gi, 'a').toLowerCase()
  const hex = (s + '0'.repeat(40)).slice(0, 40)
  return `0x${hex}` as `0x${string}`
}

export async function createAuthenticatedContext({
  browser,
  name,
}: {
  browser: Browser
  name: string
}): Promise<UserContext> {
  const PORT = process.env.PORT || 1147
  const baseURL = `http://localhost:${PORT}`
  const baseURLAlt = `http://127.0.0.1:${PORT}`

  // The app uses cookie-based session gating in middleware. For Playwright E2E,
  // set the documented local session cookies without going through wallet UI.
  const address = makeTestWalletAddress(name)
  const pryvAuth = makeAuthCookieValue(address)
  const context = await browser.newContext()
  await context.addCookies([
    {name: 'thirdweb-session', value: address, url: `${baseURL}/`},
    {name: 'walletAddress', value: address, url: `${baseURL}/`},
    {name: 'pryv-session-confirmed', value: '1', url: `${baseURL}/`},
    {name: PRYV_AUTH_COOKIE, value: pryvAuth, url: `${baseURL}/`, httpOnly: true},
    {name: 'thirdweb-session', value: address, url: `${baseURLAlt}/`},
    {name: 'walletAddress', value: address, url: `${baseURLAlt}/`},
    {name: 'pryv-session-confirmed', value: '1', url: `${baseURLAlt}/`},
    {name: PRYV_AUTH_COOKIE, value: pryvAuth, url: `${baseURLAlt}/`, httpOnly: true},
  ])
  const cookieSnapshot = await context.cookies(baseURL)
  const hasThirdweb = cookieSnapshot.some((c) => c.name === 'thirdweb-session')
  const hasWallet = cookieSnapshot.some((c) => c.name === 'walletAddress')
  const hasConfirmed = cookieSnapshot.some((c) => c.name === 'pryv-session-confirmed')
  if (!hasThirdweb || !hasWallet || !hasConfirmed) {
    throw new Error(
      `Playwright auth cookies not set as expected. got=${JSON.stringify(cookieSnapshot.map((c) => c.name))}`,
    )
  }
  const page = await context.newPage()

  // Navigate once to ensure middleware accepts our cookies.
  await page.goto(`${baseURL}/docs`)
  const urlAfter = page.url()
  if (!urlAfter.includes('/docs')) {
    throw new Error(`Failed to enter /docs with local test authentication. url=${urlAfter}`)
  }

  return {
    context,
    page,
    request: context.request,
  }
}

export async function createSignedThirdwebSession(request: APIRequestContext) {
  const {signedPayload} = await createSignedThirdwebLoginPayload(request)
  const loginResponse = await request.post('/api/auth/thirdweb', {
    data: {...signedPayload, authMethod: 'thirdweb'},
  })
  return {loginResponse}
}

export async function createSignedThirdwebLoginPayload(request: APIRequestContext) {
  const account = privateKeyToAccount({
    client: testThirdwebClient,
    privateKey: TEST_WALLET_PRIVATE_KEY,
  })
  const payloadResponse = await request.post('/api/auth/thirdweb/payload', {
    data: {address: account.address},
  })
  if (!payloadResponse.ok()) {
    throw new Error(`Failed to create thirdweb login payload: ${payloadResponse.status()}`)
  }
  const payloadBody = (await payloadResponse.json()) as {payload?: any}
  if (!payloadBody.payload) {
    throw new Error('Thirdweb login payload response did not include payload')
  }
  const signedPayload = await signLoginPayload({
    account,
    payload: payloadBody.payload,
  })
  return {account, signedPayload}
}
