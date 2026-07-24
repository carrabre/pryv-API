# Configuration reference

Copy `.env.example` to `.env.local`. The checked-in values are localhost or reserved
`example.com` placeholders.

## Required for local documentation

No provider credentials are required to render public documentation. `pnpm dev` starts on
`http://localhost:1147`.

## Required for wallet authentication

| Variable | Exposure | Purpose |
| --- | --- | --- |
| `AUTH_SECRET` | Server only | Signs application session cookies; use at least 32 random bytes |
| `AUTH_ORIGIN` | Server only | Trusted public origin used for wallet sign-in verification |
| `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` | Public | Browser application identifier |
| `THIRDWEB_SECRET_KEY` | Server only | Thirdweb verification credential |

Leave `AUTH_COOKIE_DOMAIN` blank for host-only cookies. If a parent domain is necessary, set it
only after confirming that every subdomain is controlled and trusted.

## API services

| Variable | Exposure | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | Public | API origin displayed in docs and used by browser clients |
| `PRIVATE_API_BASE_URL` | Server only | API-key management proxy target |
| `PRIVATE_MPP_API_BASE_URL` | Server only | MPP playground proxy target |
| `PRIVATE_TEE_ENCLAVE_URL` | Server only | Optional legacy subscription rewrite target |
| `NEXT_PUBLIC_MCP_URL` | Public | Separately deployed OAuth-backed MCP server |

The server-only URLs accept only HTTP or HTTPS URLs and must not contain embedded credentials.

## Optional integrations

Stripe and World App variables are documented in `.env.example`. `POSTGRES_URL` enables legacy
database-backed routes and migrations. Do not point development or CI at a production database.

Set `NEXT_PUBLIC_ENABLE_ANALYTICS=1` only after reviewing data collection, retention, user notice,
and vendor terms. Development-only auth and PII debug flags log event labels, not request payloads.

## Mobile

`mobile/.env.example` contains only the web URL to open. All `EXPO_PUBLIC_*` variables are embedded
in the application bundle and must be treated as public.
