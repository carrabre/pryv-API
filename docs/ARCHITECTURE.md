# Architecture

## Scope

This repository is a client and management surface. It does not include an AI model gateway,
confidential-computing service, payment processor, MCP server, or production infrastructure.

```text
Browser
  |
  v
Next.js application
  |-- public documentation and model pages
  |-- wallet-authenticated management UI
  |-- server-side API proxy ----------> configured API service
  `-- server-side MPP proxy ----------> configured MPP service

Expo launcher ------------------------> configured HTTPS web application
```

The Next.js process is the trust boundary between browser-visible configuration and server-only
upstream URLs. Variables prefixed with `NEXT_PUBLIC_` and `EXPO_PUBLIC_` are not secrets.

## Authentication

Thirdweb verifies the wallet payload. The application issues a signed, HTTP-only session cookie
using `AUTH_SECRET`. `AUTH_ORIGIN` defines the trusted origin used for sign-in verification.
Cookies are host-only unless an explicit `AUTH_COOKIE_DOMAIN` passes hostname validation.

Legacy database-backed authentication code remains for migration compatibility. Deployers that do
not use it should leave `POSTGRES_URL` unset and should not expose its routes.

## Data flow

Dashboard clients call same-origin routes. Those server routes forward requests only to the
explicit server-only upstreams. Proxy responses omit common infrastructure and cookie headers.
The backend must independently authorize every request; a client-side wallet state is not an
authorization decision.

The mobile workspace does not embed a WebView bridge. It validates a configured URL and opens the
system browser, so it does not copy cookies, OAuth results, or tokens into the native process.

## Optional integrations

Stripe, World App, and analytics are optional. Analytics is disabled by default. Each integration
introduces a separate data processor and must be reviewed before it is enabled.
