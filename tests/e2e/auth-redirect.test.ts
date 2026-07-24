import {expect, test} from '@playwright/test'
import {createSignedThirdwebLoginPayload, createSignedThirdwebSession} from '../helpers'
import {makeAuthCookieValue, PRYV_AUTH_COOKIE} from '@/lib/auth/server-auth-cookie-issue'

test.describe('Auth gating', () => {
  test('logout shell includes a no-hydration redirect fallback', async ({request, baseURL}) => {
    const response = await request.get(`${baseURL}/logout`)
    expect(response.ok()).toBeTruthy()

    const html = await response.text()
    expect(html).toContain('logout-bootstrap')
    expect(html).toContain('/api/auth/thirdweb')
    expect(html).toContain('pryv-logged-out')
    expect(html).toContain("new URL('/login'")
  })

  test('redirects unauthenticated platform routes to /login', async ({page}) => {
    await page.goto('/docs/mcp')

    await expect(page).toHaveURL(/\/login(?:\?.*)?$/)
    await expect(page.getByTestId('multimodal-input')).toHaveCount(0)
  })

  test.describe('World App first launch', () => {
    test.use({
      userAgent: 'WorldApp',
    })

    test('redirects unauthenticated / to /login in mini app', async ({page}) => {
      await page.goto('/')
      await expect(page).toHaveURL(/\/login(\?.*)?$/)
    })
  })

  test('rejects incomplete Worldcoin auth completion before verification', async ({page}) => {
    const missingParams = await page.request.post('/api/worldcoin/complete-auth', {data: {}})
    expect(missingParams.status()).toBe(400)
    expect(await missingParams.json()).toMatchObject({error: 'Missing parameters'})

    const invalidNonce = await page.request.post('/api/worldcoin/complete-auth', {
      data: {
        walletPayload: {status: 'success'},
        verifyPayload: {status: 'success'},
        nonce: 'missing-cookie',
      },
    })
    expect(invalidNonce.status()).toBe(401)
    expect(await invalidNonce.json()).toMatchObject({error: 'Invalid nonce'})
  })

  test('issues a Worldcoin nonce cookie', async ({page}) => {
    const response = await page.request.get('/api/worldcoin/nonce')
    expect(response.ok()).toBeTruthy()

    const body = (await response.json()) as {nonce?: string}
    expect(body.nonce).toMatch(/^[a-f0-9]{32}$/)

    const setCookie = response.headers()['set-cookie'] ?? ''
    expect(setCookie).toContain('worldcoin-nonce=')
    expect(setCookie).toContain('Max-Age=300')
    expect(setCookie).toContain('HttpOnly')
  })

  test('rejects placeholder wallet values before creating login payloads', async ({page}) => {
    const response = await page.request.post('/api/auth/thirdweb/payload', {
      data: {
        address: 'connected',
      },
    })

    expect(response.status()).toBe(400)
    expect(await response.json()).toMatchObject({
      errorCode: 'invalid_wallet_address',
    })
  })

  test('logout clears access and stays on /login', async ({page}) => {
    const {loginResponse} = await createSignedThirdwebSession(page.request)
    expect(loginResponse.ok()).toBeTruthy()

    await page.goto('/docs/mcp')
    await expect(page).toHaveURL(/\/docs\/mcp/)

    const logoutResponse = await page.request.delete('/api/auth/thirdweb')
    expect(logoutResponse.ok()).toBeTruthy()

    await page.goto('/docs/mcp')
    await expect(page).toHaveURL(/\/login(?:\?.*)?$/)

    await page.goto('/login')
    await expect(page).toHaveURL('/login')
  })

  test('logout page confirms sign-out before redirecting to plain /login', async ({page}) => {
    const {loginResponse} = await createSignedThirdwebSession(page.request)
    expect(loginResponse.ok()).toBeTruthy()

    await page.goto('/docs/mcp')
    await expect(page).toHaveURL(/\/docs\/mcp/)

    await page.goto('/logout')
    await expect(page).toHaveURL(/\/login$/)

    const authResponse = await page.request.get('/api/auth/thirdweb')
    expect(authResponse.ok()).toBeTruthy()
    expect(await authResponse.json()).toMatchObject({
      authenticated: false,
      loggedOut: true,
    })

    await page.goto('/docs/mcp')
    await expect(page).toHaveURL(/\/login(?:\?.*)?$/)
  })

  test('logout page sends already signed-out visitors to plain /login', async ({page}) => {
    await page.goto('/logout')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('logged-out marker blocks stale authenticated cookies', async ({page, baseURL}) => {
    const appUrl = baseURL ?? 'http://localhost:1147'
    const {loginResponse} = await createSignedThirdwebSession(page.request)
    expect(loginResponse.ok()).toBeTruthy()

    await page.context().addCookies([
      {name: 'pryv-logged-out', value: '1', url: `${appUrl}/`},
      {name: 'authjs.session-token.0', value: 'stale-session-chunk', url: `${appUrl}/`},
    ])

    await page.goto('/login')
    await expect(page).toHaveURL(/\/login$/)

    const authResponse = await page.request.get('/api/auth/thirdweb')
    expect(authResponse.ok()).toBeTruthy()
    const authBody = await authResponse.json()
    expect(authBody).toMatchObject({
      authenticated: false,
      loggedOut: true,
    })

    await page.goto('/docs/mcp')
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByTestId('multimodal-input')).toHaveCount(0)

    const cookieNames = (await page.context().cookies(appUrl)).map((cookie) => cookie.name)
    expect(cookieNames).not.toContain('authjs.session-token.0')
  })

  test('fresh sign-in does not bounce between /login and platform routes', async ({page}) => {
    await page.goto('/docs/mcp')
    await expect(page).toHaveURL(/\/login(?:\?.*)?$/)

    const {loginResponse} = await createSignedThirdwebSession(page.request)
    expect(loginResponse.ok()).toBeTruthy()

    await page.goto('/login?redirect=/docs/mcp')
    await expect(page).toHaveURL('/docs/mcp')
    await page.waitForTimeout(500)
    await expect(page).toHaveURL('/docs/mcp')
  })

  test('accepts overlapping thirdweb login payloads without nonce overwrite', async ({page}) => {
    const first = await createSignedThirdwebLoginPayload(page.request)
    const second = await createSignedThirdwebLoginPayload(page.request)

    const [firstLogin, secondLogin] = await Promise.all([
      page.request.post('/api/auth/thirdweb', {
        data: {...first.signedPayload, authMethod: 'thirdweb'},
      }),
      page.request.post('/api/auth/thirdweb', {
        data: {...second.signedPayload, authMethod: 'thirdweb'},
      }),
    ])

    expect(firstLogin.ok()).toBeTruthy()
    expect(secondLogin.ok()).toBeTruthy()
  })

  test('accepts a valid auth cookie when a stale duplicate appears first', async ({page}) => {
    const address = '0x0000000000000000000000000000000000000004'
    const validAuthCookie = makeAuthCookieValue(address)
    const duplicateCookieHeader = `${PRYV_AUTH_COOKIE}=stale.invalid.cookie; ${PRYV_AUTH_COOKIE}=${validAuthCookie}`

    const sessionResponse = await page.request.get('/api/auth/session', {
      headers: {cookie: duplicateCookieHeader},
    })
    expect(sessionResponse.ok()).toBeTruthy()
    expect(await sessionResponse.json()).toMatchObject({
      authenticated: true,
      address,
    })

    const protectedResponse = await page.request.get('/docs/mcp', {
      headers: {cookie: duplicateCookieHeader},
      maxRedirects: 0,
    })
    expect(protectedResponse.status()).toBe(200)
  })

  test('rejects unsigned thirdweb session creation', async ({page}) => {
    const response = await page.request.post('/api/auth/thirdweb', {
      data: {
        address: '0x0000000000000000000000000000000000000003',
        authMethod: 'thirdweb',
      },
    })
    expect(response.status()).toBe(401)
    const body = (await response.json()) as {errorCode?: string}
    expect(body.errorCode).toBe('missing_wallet_signature')
  })
})
