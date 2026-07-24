# Deployment

## Safe baseline

1. Build from a clean checkout with Node.js 22 and the pinned pnpm version.
2. Set a new `AUTH_SECRET` and keep it in the hosting platform's secret store.
3. Set `AUTH_ORIGIN` and `NEXT_PUBLIC_PLATFORM_URL` to the exact HTTPS deployment origin.
4. Configure server-only upstreams for an isolated backend environment.
5. Leave `AUTH_COOKIE_DOMAIN` blank unless cross-subdomain cookies are required.
6. Keep analytics, payment, and World App integrations disabled until separately reviewed.
7. Run the checks below before promotion.

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm check
pnpm build
```

## Production controls

Terminate TLS at a trusted proxy, set restrictive network rules on private upstreams, and prevent
the browser from reaching administrative services directly. Configure rate limiting, request-size
limits, authorization, payment verification, replay protection, logging redaction, retention, and
incident response in the backend and hosting layer.

Do not expose database credentials, provider keys, webhook secrets, or internal URLs through a
`NEXT_PUBLIC_*` or `EXPO_PUBLIC_*` variable. Do not reuse development credentials.

## Containers and packaged builds

This repository does not ship a container image. If one is created, use a minimal runtime stage,
do not copy `.env.local`, source-control metadata, test artifacts, caches, or package-manager
credentials into it, and perform a separate dependency-license and vulnerability review.

## Rollback

Keep deployment versions in the hosting system rather than committed backup archives. A rollback
must not restore a known-vulnerable session secret or a repository revision containing removed
credentials.
