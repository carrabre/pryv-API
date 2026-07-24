import {expect, test} from '@playwright/test'

test.describe('AI docs routes', () => {
  test('serves llms.txt without authentication', async ({request}) => {
    const response = await request.get('/llms.txt')
    const body = await response.text()

    expect(response.ok()).toBe(true)
    expect(response.headers()['content-type']).toContain('text/plain')
    expect(body).toContain('# Pryv API Platform')
    expect(body).toContain('/llms-full.txt')
    expect(body).toContain('https://mcp.example.com/mcp')
  })

  test('serves full plain-text context without authentication', async ({request}) => {
    const response = await request.get('/llms-full.txt')
    const body = await response.text()

    expect(response.ok()).toBe(true)
    expect(response.headers()['content-type']).toContain('text/plain')
    expect(body).toContain('# Pryv API Platform AI Context')
    expect(body).toContain('POST /v1/chat/completions')
    expect(body).toContain('Wallet auth messages include action')
  })

  test('publishes robots.txt and sitemap.xml for discovery', async ({request}) => {
    const robots = await request.get('/robots.txt')
    const sitemap = await request.get('/sitemap.xml')
    const robotsBody = await robots.text()
    const sitemapBody = await sitemap.text()

    expect(robots.ok()).toBe(true)
    expect(sitemap.ok()).toBe(true)
    expect(robotsBody).toContain('Allow: /llms.txt')
    expect(robotsBody).toContain('Sitemap:')
    expect(sitemapBody).toContain('<loc>')
    expect(sitemapBody).toContain('/llms-full.txt')
  })
})
