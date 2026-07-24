import {expect, test} from '@playwright/test'
import {createAuthenticatedContext} from '../helpers'

test.describe('/login', () => {
  test('renders only the sign-in surface in the first HTML response', async ({
    request,
    baseURL,
  }) => {
    const response = await request.get(`${baseURL}/login`)
    expect(response.ok()).toBeTruthy()

    const html = await response.text()
    const body = html.slice(Math.max(0, html.indexOf('<body')))
    const visibleShell = body.split('<section aria-label="Notifications')[0] ?? body

    expect(visibleShell).toContain('Pryv')
    expect(visibleShell).toContain('Sign in')
    expect(visibleShell).not.toContain('Privacy-first AI')
    expect(visibleShell).not.toContain('Get started')
    expect(visibleShell).not.toContain('Create a key')
    expect(visibleShell).not.toContain('Ask AI')
    expect(visibleShell).not.toContain('llms.txt')
    expect(visibleShell).not.toContain('animate-pulse rounded-md bg-muted')
  })

  test('redirects authenticated users to the requested target before rendering login', async ({
    browser,
    baseURL,
  }) => {
    const {context, page} = await createAuthenticatedContext({
      browser,
      name: 'login-redirect',
    })

    try {
      await page.goto(`${baseURL}/login?redirect=${encodeURIComponent('/usage')}`, {
        waitUntil: 'networkidle',
      })
      await page.waitForURL(`${baseURL}/usage`, {timeout: 15_000})
      expect(page.url()).toBe(`${baseURL}/usage`)
    } finally {
      await context.close()
    }
  })

  test('sends authenticated root redirects to platform docs', async ({browser, baseURL}) => {
    const {context, page} = await createAuthenticatedContext({
      browser,
      name: 'login-root-redirect',
    })

    try {
      await page.goto(`${baseURL}/login?redirect=${encodeURIComponent('/')}`, {
        waitUntil: 'networkidle',
      })
      await page.waitForURL(`${baseURL}/docs`, {timeout: 15_000})
      expect(page.url()).toBe(`${baseURL}/docs`)
    } finally {
      await context.close()
    }
  })
})
