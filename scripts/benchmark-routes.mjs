import {createHmac} from 'node:crypto'
import {readFileSync, writeFileSync} from 'node:fs'
import {gzipSync} from 'node:zlib'

const DEFAULT_BASE_URL = 'http://localhost:1147'
const DEFAULT_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678'
const DEFAULT_ITERATIONS = 20
const DEFAULT_WARMUP = 2

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function parsePositiveNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function makeAuthCookie({
  address = process.env.BENCHMARK_WALLET_ADDRESS || DEFAULT_ADDRESS,
  secret = process.env.AUTH_SECRET,
} = {}) {
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new Error('Set AUTH_SECRET to at least 32 characters before running authenticated routes')
  }
  const exp = Math.floor(Date.now() / 1000) + 3600
  const addr = Buffer.from(address).toString('base64url')
  const sig = createHmac('sha256', secret).update(`${address}|${exp}`).digest('base64url')
  return `pryv-auth=${addr}.${exp}.${sig}`
}

function percentile(samples, ratio) {
  return samples[Math.min(samples.length - 1, Math.floor(samples.length * ratio))]
}

function formatMs(value) {
  return `${value.toFixed(1)}ms`
}

function formatRatio(value) {
  return `${value.toFixed(2)}x`
}

function readBenchmarkResults(path) {
  if (!path) return null
  const parsed = JSON.parse(readFileSync(path, 'utf8'))
  const results = Array.isArray(parsed) ? parsed : parsed.results
  if (!Array.isArray(results)) {
    throw new Error(`Benchmark baseline must be an array or an object with results[]: ${path}`)
  }
  return new Map(results.map((result) => [result.name, result]))
}

function parseRouteFilter(value) {
  const names = value
    ?.split(',')
    .map((name) => name.trim())
    .filter(Boolean)
  return names?.length ? new Set(names) : null
}

const baseUrl = (process.env.BENCHMARK_BASE_URL || process.argv[2] || DEFAULT_BASE_URL).replace(
  /\/+$/,
  '',
)
const iterations = parsePositiveInteger(process.env.BENCHMARK_ITERATIONS, DEFAULT_ITERATIONS)
const warmup = parsePositiveInteger(process.env.BENCHMARK_WARMUP, DEFAULT_WARMUP)
const outputJsonPath = process.env.BENCHMARK_OUTPUT_JSON
const baselineJsonPath = process.env.BENCHMARK_BASELINE_JSON
const minSpeedup = parsePositiveNumber(process.env.BENCHMARK_MIN_SPEEDUP)
const routeFilter = parseRouteFilter(process.env.BENCHMARK_ROUTES)
const authCookie = process.env.BENCHMARK_AUTH_COOKIE || makeAuthCookie()
const authHeaders = {cookie: authCookie}
const worldcoinVerifiedHeaders = {cookie: 'worldcoin-verified=1'}
const jsonHeaders = {'content-type': 'application/json'}
const thirdwebPayloadBody = JSON.stringify({
  address: process.env.BENCHMARK_WALLET_ADDRESS || DEFAULT_ADDRESS,
  chainId: 1,
})
const thirdwebLogoutHeaders = {
  cookie: [
    `thirdweb-session=${process.env.BENCHMARK_WALLET_ADDRESS || DEFAULT_ADDRESS}`,
    `walletAddress=${process.env.BENCHMARK_WALLET_ADDRESS || DEFAULT_ADDRESS}`,
    'pryv-session-confirmed=1',
    'authjs.session-token=legacy-session',
  ].join('; '),
}

const routes = [
  {name: 'ping', path: '/ping'},
  {name: 'auth-session-none', path: '/api/auth/session'},
  {name: 'auth-session-valid', path: '/api/auth/session', headers: authHeaders},
  {
    name: 'thirdweb-payload-valid',
    path: '/api/auth/thirdweb/payload',
    method: 'POST',
    headers: jsonHeaders,
    body: thirdwebPayloadBody,
  },
  {
    name: 'thirdweb-delete',
    path: '/api/auth/thirdweb',
    method: 'DELETE',
    headers: thirdwebLogoutHeaders,
  },
  {name: 'worldcoin-status-none', path: '/api/worldcoin/status'},
  {
    name: 'worldcoin-status-ok',
    path: '/api/worldcoin/status',
    headers: worldcoinVerifiedHeaders,
  },
  {name: 'worldcoin-config', path: '/api/worldcoin/config'},
  {name: 'worldcoin-nonce', path: '/api/worldcoin/nonce'},
  {name: 'llms', path: '/llms.txt'},
  {name: 'llms-full', path: '/llms-full.txt'},
  {name: 'robots', path: '/robots.txt'},
  {name: 'sitemap', path: '/sitemap.xml'},
  {name: 'icon', path: '/icon.svg'},
  {name: 'login', path: '/login'},
  {name: 'logout', path: '/logout'},
  {name: 'docs-auth', path: '/docs', headers: authHeaders},
  {name: 'docs-quickstart-auth', path: '/docs/quickstart', headers: authHeaders},
  {name: 'docs-reference-auth', path: '/docs/reference', headers: authHeaders},
  {name: 'docs-reference-api-auth', path: '/docs/reference/api', headers: authHeaders},
  {name: 'docs-reference-api-chat-auth', path: '/docs/reference/api/chat', headers: authHeaders},
  {
    name: 'docs-reference-api-privacy-auth',
    path: '/docs/reference/api/privacy',
    headers: authHeaders,
  },
  {
    name: 'docs-reference-operations-auth',
    path: '/docs/reference/operations',
    headers: authHeaders,
  },
  {name: 'docs-mcp-auth', path: '/docs/mcp', headers: authHeaders},
  {name: 'docs-mcp-reference-auth', path: '/docs/mcp/reference', headers: authHeaders},
  {name: 'docs-mpp-auth', path: '/docs/mpp', headers: authHeaders},
  {name: 'docs-mpp-reference-auth', path: '/docs/mpp/reference', headers: authHeaders},
  {name: 'docs-mpp-reference-chat-auth', path: '/docs/mpp/reference/chat', headers: authHeaders},
  {
    name: 'docs-mpp-reference-operations-auth',
    path: '/docs/mpp/reference/operations',
    headers: authHeaders,
  },
  {name: 'models-auth', path: '/models', headers: authHeaders},
  {name: 'api-keys-auth', path: '/api-keys', headers: authHeaders},
  {name: 'billing-auth', path: '/billing', headers: authHeaders},
  {name: 'usage-auth', path: '/usage', headers: authHeaders},
  {name: 'playground-auth', path: '/playground', headers: authHeaders},
  {name: 'settings-auth', path: '/settings', headers: authHeaders},
]

const selectedRoutes = routeFilter ? routes.filter((route) => routeFilter.has(route.name)) : routes
if (!selectedRoutes.length) {
  throw new Error(`BENCHMARK_ROUTES did not match any routes: ${process.env.BENCHMARK_ROUTES}`)
}

async function readResponseBody(res) {
  return Buffer.from(await res.arrayBuffer())
}

async function sampleRoute(route) {
  for (let i = 0; i < warmup; i += 1) {
    const res = await fetch(`${baseUrl}${route.path}`, {
      method: route.method,
      headers: route.headers,
      body: route.body,
      redirect: 'manual',
    })
    await readResponseBody(res)
  }

  const samples = []
  let status = 0
  let bytes = 0
  let gzipBytes = 0
  for (let i = 0; i < iterations; i += 1) {
    const start = performance.now()
    const res = await fetch(`${baseUrl}${route.path}`, {
      method: route.method,
      headers: route.headers,
      body: route.body,
      redirect: 'manual',
    })
    status = res.status
    const body = await readResponseBody(res)
    samples.push(performance.now() - start)
    bytes = body.byteLength
    gzipBytes = gzipSync(body).byteLength
  }
  samples.sort((a, b) => a - b)

  const {body: _body, headers: _headers, ...safeRoute} = route
  return {
    ...safeRoute,
    status,
    bytes,
    gzipBytes,
    min: samples[0],
    median: percentile(samples, 0.5),
    p95: percentile(samples, 0.95),
    max: samples.at(-1),
  }
}

const baselineResults = readBenchmarkResults(baselineJsonPath)
const results = []
const speedupFailures = []

if (minSpeedup && !baselineResults) {
  throw new Error('BENCHMARK_MIN_SPEEDUP requires BENCHMARK_BASELINE_JSON')
}

console.log(`Benchmarking ${baseUrl} (${iterations} samples, ${warmup} warmups per route)\n`)

for (const route of selectedRoutes) {
  const result = await sampleRoute(route)
  results.push(result)

  const baseline = baselineResults?.get(result.name)
  const medianSpeedup = baseline?.median ? baseline.median / result.median : null
  const gzipReduction = baseline?.gzipBytes ? baseline.gzipBytes / result.gzipBytes : null
  const comparison = baseline
    ? ` speedup=${medianSpeedup ? formatRatio(medianSpeedup) : 'n/a'} gzip-ratio=${gzipReduction ? formatRatio(gzipReduction) : 'n/a'}`
    : ''
  if (minSpeedup) {
    if (!baseline) {
      speedupFailures.push({name: result.name, reason: 'missing baseline'})
    } else if (medianSpeedup === null) {
      speedupFailures.push({name: result.name, reason: 'invalid baseline median'})
    } else if (medianSpeedup < minSpeedup) {
      speedupFailures.push({name: result.name, speedup: medianSpeedup})
    }
  }

  console.log(
    `${result.name.padEnd(24)} status=${String(result.status).padEnd(3)} bytes=${String(
      result.bytes,
    ).padStart(7)} gzip=${String(result.gzipBytes).padStart(6)} median=${formatMs(
      result.median,
    ).padStart(7)} p95=${formatMs(result.p95).padStart(7)} min=${formatMs(result.min).padStart(
      7,
    )} max=${formatMs(result.max).padStart(7)}${comparison}`,
  )
}

if (outputJsonPath) {
  writeFileSync(
    outputJsonPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        baseUrl,
        iterations,
        warmup,
        results,
      },
      null,
      2,
    )}\n`,
  )
  console.log(`\nWrote benchmark JSON to ${outputJsonPath}`)
}

if (speedupFailures.length) {
  console.error(`\nFAIL ${speedupFailures.length} routes below ${formatRatio(minSpeedup)} speedup`)
  for (const failure of speedupFailures) {
    const detail =
      failure.speedup === undefined ? failure.reason : `speedup=${formatRatio(failure.speedup)}`
    console.error(`  ${failure.name} ${detail}`)
  }
  process.exit(1)
}
