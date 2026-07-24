# Pryv API Platform

Pryv API Platform is a Next.js dashboard and documentation site for configurable AI API services.
It provides wallet authentication, API-key management, usage and billing views, an API playground,
and documentation for bearer-key, MPP, and MCP surfaces.

This repository contains the web client and a small Expo launcher. It intentionally excludes the
API/TEE backend, production configuration, customer data, provider credentials, internal
operational documentation, and hosted-service infrastructure. Authenticated product flows require
a compatible backend configured by the deployer.

## Features

- Developer dashboard for API keys, credits, billing, usage, models, and settings
- Bearer API and MPP playgrounds routed through same-origin server proxies
- Thirdweb wallet authentication with optional World App sign-in
- API, privacy, MPP, and remote MCP documentation
- Responsive web UI plus an Expo launcher that opens the configured web deployment
- Playwright route and end-to-end test suites

## Requirements

- Node.js 22
- pnpm 10 through Corepack
- A compatible API backend for live API, billing, and key-management flows
- A Thirdweb client ID for wallet sign-in

## Quick start

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

The web app starts at [http://localhost:1147](http://localhost:1147). The public documentation can
render without a backend, while authenticated dashboard actions need the API origins configured in
`.env.local`.

Generate a local cookie-signing secret before testing authentication:

```bash
openssl rand -base64 32
```

Paste the result into `AUTH_SECRET` in `.env.local`. Never commit `.env.local` or real credentials.

## Configuration

The placeholder-only [`.env.example`](.env.example) is the source of truth for web configuration. The
smallest useful local setup is:

| Variable | Purpose |
| --- | --- |
| `AUTH_SECRET` | Server-only signing key for authenticated cookies |
| `AUTH_ORIGIN` | Trusted platform origin used when verifying wallet sign-in |
| `AUTH_COOKIE_DOMAIN` | Optional trusted parent domain; blank keeps cookies host-only |
| `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` | Browser-safe Thirdweb application ID |
| `NEXT_PUBLIC_API_BASE_URL` | Public API origin shown in docs and used by browser API calls |
| `PRIVATE_API_BASE_URL` | Server-only target for API-key proxy routes |
| `PRIVATE_MPP_API_BASE_URL` | Server-only target for the MPP playground proxy |
| `PRIVATE_TEE_ENCLAVE_URL` | Server-only target for legacy subscription rewrites |
| `NEXT_PUBLIC_PLATFORM_URL` | Canonical platform origin |
| `NEXT_PUBLIC_MCP_URL` | Public URL of the separately deployed MCP server |

Variables beginning with `NEXT_PUBLIC_` or `EXPO_PUBLIC_` are embedded in client bundles. Never put
private keys, provider secrets, database URLs, webhook secrets, or server API tokens in them.

Optional Stripe, World App, database, and analytics integrations are grouped in `.env.example`.
Analytics is off unless explicitly enabled.

## Architecture

```text
Browser / Expo app
        |
        v
Next.js App Router
  |-- public docs and model catalog
  |-- wallet-authenticated dashboard
  |-- /api/v1/* same-origin proxy --------> configured API / TEE
  `-- /api/playground/mpp/* proxy --------> MPP gateway
```

Important directories:

- `app/(platform)` — dashboard and documentation routes
- `app/(auth)` — login and Thirdweb session routes
- `app/api` — server-side proxy and World App routes
- `components/platform` — reusable platform documentation UI
- `lib/platform` — proxy helpers and the API client
- `mobile` — Expo client workspace
- `tests` — Playwright route and end-to-end suites
- `docs` — public architecture, configuration, deployment, privacy, and troubleshooting references

## Development commands

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the web development server on port 1147 |
| `pnpm dev:clean` | Clear local build caches, free port 1147, and start the server |
| `pnpm build` | Create a production build |
| `pnpm lint` | Run Biome lint checks without changing files |
| `pnpm lint:fix` | Apply safe Biome lint fixes |
| `pnpm format` | Format tracked source files |
| `pnpm format:check` | Check formatting without changing files |
| `pnpm typecheck` | Run TypeScript without emitting files |
| `pnpm test` | Run fast unit tests |
| `pnpm test:e2e` | Run the Playwright suites |
| `pnpm check` | Run lint, type checking, and unit tests |

The Playwright suites start the app with synthetic configuration. Backend-connected flows should
only be tested against an isolated non-production service.

## Mobile client

```bash
cp mobile/.env.example mobile/.env.local
pnpm --dir mobile start
```

All `EXPO_PUBLIC_*` values are readable from the built application. The launcher accepts only HTTPS
URLs outside local development and never receives cookies or tokens from the web application.

## MCP

The MCP service is separate from the bearer-key `/v1/*` API. Configure your deployed URL:

```bash
codex mcp add pryv --url https://mcp.example.com/mcp
codex mcp login pryv
```

See the source under `app/(platform)/docs/mcp`.

## Safe deployment

Start from [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). The checked-in defaults use localhost or
reserved example.com names and cannot connect to the former hosted environment. Configure trusted
origins and server-only upstreams explicitly, keep secrets outside the client bundle, and use an
isolated test backend before enabling authenticated or payment flows.

## Security and privacy limitations

This client does not make a deployment secure or compliant by itself. The separately operated
backend remains responsible for authorization, rate limiting, payment validation, PII processing,
retention, provider data handling, and audit controls. Review [SECURITY.md](SECURITY.md) and
[docs/PRIVACY.md](docs/PRIVACY.md) before deployment.

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Please report security issues
privately as described in [SECURITY.md](SECURITY.md), not in a public issue. Community participation
is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License and attribution

Licensed under the [Apache License 2.0](LICENSE). This project is derived in part from Vercel's AI
Chatbot/Chat SDK template; attribution is preserved in [NOTICE](NOTICE). Review
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) before distributing bundled builds.
