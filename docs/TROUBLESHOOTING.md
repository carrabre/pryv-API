# Troubleshooting

## Public pages do not start

Confirm Node.js 22 is active, enable Corepack, and reinstall from the lockfile:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Delete `.next` only when it is an expendable local build cache. Do not delete or replace project
files to work around a type or build error.

## Authentication is unavailable

Confirm `AUTH_SECRET` contains at least 32 random bytes, `AUTH_ORIGIN` exactly matches the browser
origin, and the public Thirdweb identifier and server-only verification secret belong to the same
non-production application. Keep cookies host-only while debugging.

## Dashboard requests fail

Public documentation can render without a backend. Authenticated pages need explicit API upstreams.
Use browser network tools to identify the failing same-origin route, then inspect sanitized server
logs. Do not paste raw authorization headers, cookies, wallet signatures, or request bodies into an
issue.

## Mobile launcher rejects a URL

Outside local development the launcher accepts HTTPS only. Set `EXPO_PUBLIC_MOBILE_BASE_URL` or
`EXPO_PUBLIC_WEB_API_BASE_URL` to the deployed web application, then rebuild the app.

## Reporting a bug

Use the issue template with synthetic reproduction data. Report vulnerabilities through the
private process in `SECURITY.md`.
