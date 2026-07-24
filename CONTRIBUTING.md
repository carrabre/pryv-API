# Contributing

Thank you for helping improve the Pryv API Platform.

## Before you start

- Search existing issues and pull requests before opening a duplicate.
- Use an issue to discuss large features, architecture changes, or breaking API changes first.
- Report vulnerabilities privately according to [SECURITY.md](SECURITY.md).
- Never include customer data, wallet activity, access tokens, private keys, or real credentials in
  issues, fixtures, logs, screenshots, commits, or pull requests.

## Local setup

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

Node.js 22 is used in CI. The public docs can render without a backend, but authenticated and
payment flows require the services described in [README.md](README.md).

## Making changes

1. Create a focused branch from `main`.
2. Keep changes scoped and add or update tests for changed behavior.
3. Update docs and `.env.example` when configuration or user-visible behavior changes.
4. Run the local checks:

   ```bash
   pnpm check
   pnpm format:check
   pnpm build
   ```

5. Run `pnpm test:e2e` when changing routes, authentication, middleware, or critical UI flows.

Use synthetic `example.com` addresses and documented public test accounts in fixtures. Add a
`gitleaks:allow` comment only for a deterministic, publicly documented test value and explain why it
is safe.

## Pull requests

Pull requests should explain the problem, the approach, verification performed, and any migration
or deployment impact. Keep unrelated refactors separate. By submitting a contribution, you agree
that it is licensed under the repository's Apache-2.0 license, as described by Section 5 of the
license.
