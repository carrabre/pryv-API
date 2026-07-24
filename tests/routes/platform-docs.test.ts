import {expect, test} from '@playwright/test'
import {createAuthenticatedContext} from '../helpers'

test.describe('platform docs', () => {
  test('uses the docs-template shell across primary platform pages', async ({browser, baseURL}) => {
    const {context, page} = await createAuthenticatedContext({
      browser,
      name: 'platform-docs-template-shell',
    })

    const pages = [
      {path: '/api-keys', heading: 'Issue keys once, store safely, rotate on schedule.'},
      {path: '/billing', heading: 'Prepaid credits with Stripe Checkout.'},
      {path: '/models', heading: 'All supported Pryv API models.'},
      {path: '/usage', heading: 'Track credits, request IDs, and rate limits.'},
      {path: '/playground', heading: 'Test Pryv bearer and MPP request shapes.'},
      {path: '/settings', heading: 'Configure environments, security, and future webhooks.'},
    ]

    try {
      for (const item of pages) {
        await page.goto(`${baseURL}${item.path}`)
        await expect(page.getByRole('heading', {name: item.heading})).toBeVisible()
        await expect(page.locator('main > div.max-w-5xl')).toBeVisible()
        await expect(page.locator('main .rounded-lg.border.border-border.bg-card')).toHaveCount(0)
      }
    } finally {
      await context.close()
    }
  })

  test('renders the docs-template style entry page with AI exports', async ({browser, baseURL}) => {
    const {context, page} = await createAuthenticatedContext({
      browser,
      name: 'platform-docs-ai-ready',
    })

    try {
      await page.goto(`${baseURL}/docs`)

      await expect(
        page.getByRole('heading', {
          name: 'Keys, credits, and private AI docs in one platform.',
        }),
      ).toBeVisible()
      await expect(page.getByRole('navigation', {name: 'Docs sections'})).toBeVisible()
      await expect(page.locator('a[href="/llms.txt"]').first()).toBeVisible()
      await expect(page.locator('a[href="/llms-full.txt"]').first()).toBeVisible()
      await expect(
        page.getByRole('heading', {name: 'Plain-text context for agents and crawlers.'}),
      ).toBeVisible()
    } finally {
      await context.close()
    }
  })

  test('shows validation toast in playground', async ({browser, baseURL}) => {
    const {context, page} = await createAuthenticatedContext({
      browser,
      name: 'platform-playground-toast',
    })

    try {
      await page.goto(`${baseURL}/playground`)
      await page.getByRole('button', {name: 'Send request'}).click()

      const toast = page.getByTestId('toast').filter({hasText: 'Missing NEXT_PUBLIC_API_BASE_URL.'})
      await expect(page.getByLabel('Notifications')).toBeVisible()
      await expect(toast).toBeVisible()

      await toast.getByRole('button', {name: 'Dismiss notification'}).click()
      await expect(page.getByTestId('toast')).toHaveCount(0)
    } finally {
      await context.close()
    }
  })

  test('redirects unauthenticated MCP docs visitors to login', async ({page}) => {
    await page.goto('/docs/mcp')

    await expect(page).toHaveURL(/\/login(?:\?.*)?$/)
  })

  test('renders MCP docs inside the platform layout with visible controls', async ({
    browser,
    baseURL,
  }) => {
    const {context, page} = await createAuthenticatedContext({
      browser,
      name: 'platform-mcp-docs',
    })

    try {
      await page.goto(`${baseURL}/docs/mcp`)

      await expect(page).toHaveURL(`${baseURL}/docs/mcp`)
      await expect(
        page.getByRole('heading', {
          name: 'Connect Pryv to Codex and other remote MCP clients.',
        }),
      ).toBeVisible()

      const mcpNavItem = page.locator('nav a[href="/docs/mcp"]')
      await expect(mcpNavItem).toBeVisible()
      await expect(mcpNavItem).toHaveAttribute('aria-current', 'page')

      const secondaryControls = page.getByTestId('platform-nav-secondary')
      await expect(secondaryControls).toBeVisible()
      await expect(page.getByTestId('platform-production-badge')).toContainText(
        'Configured service',
      )
      await expect(page.getByTestId('platform-host-chips')).toContainText('dashboard:')

      await expect(page.getByTestId('platform-theme-toggle-light')).toBeVisible()
      await expect(page.getByTestId('platform-theme-toggle-dark')).toBeVisible()

      const creditsCard = page.getByTestId('platform-credits-card')
      await expect(creditsCard).toBeVisible()
      await expect(creditsCard).toContainText('Credits')
      const loadBalanceButton = creditsCard.getByRole('button', {name: 'Load balance'})
      await expect(creditsCard).toContainText('Connect wallet to view credits.')
      await expect(loadBalanceButton).toHaveCount(0)
      const navBox = await page.locator('aside nav').boundingBox()
      const secondaryBox = await secondaryControls.boundingBox()
      expect(navBox?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(
        secondaryBox?.y ?? Number.NEGATIVE_INFINITY,
      )
      const creditsBox = await creditsCard.boundingBox()
      const controlsBox = await page.getByRole('group', {name: 'Platform controls'}).boundingBox()
      expect(creditsBox?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(
        controlsBox?.y ?? Number.NEGATIVE_INFINITY,
      )

      const logoutLink = page.getByTestId('platform-logout-link')
      await expect(logoutLink).toBeVisible()
      await expect(logoutLink).toHaveAttribute('href', '/logout')
      await expect(page.locator('aside').getByText('Wallet', {exact: true})).toHaveCount(0)

      await page.getByTestId('platform-theme-toggle-dark').click()
      await expect(page.locator('html')).toHaveClass(/dark/)
    } finally {
      await context.close()
    }
  })

  test('keeps secondary controls below navigation on mobile', async ({browser, baseURL}) => {
    const {context, page} = await createAuthenticatedContext({
      browser,
      name: 'platform-mobile-controls',
    })

    try {
      await page.setViewportSize({width: 390, height: 844})
      await page.goto(`${baseURL}/docs/mcp`)

      const lightToggle = page.getByTestId('platform-theme-toggle-light')
      const darkToggle = page.getByTestId('platform-theme-toggle-dark')
      const logoutLink = page.getByTestId('platform-logout-link')
      const nav = page.locator('aside nav')
      const secondary = page.getByTestId('platform-nav-secondary')

      await expect(nav).toBeVisible()
      await expect(secondary).toBeVisible()
      await expect(lightToggle).toBeVisible()
      await expect(darkToggle).toBeVisible()
      await expect(logoutLink).toBeVisible()

      const navBox = await nav.boundingBox()
      const secondaryBox = await secondary.boundingBox()
      expect(navBox?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(
        secondaryBox?.y ?? Number.NEGATIVE_INFINITY,
      )
      await expect(logoutLink).toContainText('Sign out')
    } finally {
      await context.close()
    }
  })
})
