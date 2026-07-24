# Open-source release checklist

The local repository is being sanitized independently from the existing private GitHub repository.
Do not change visibility until every blocking item below is complete.

## Blocking security actions

- [ ] Revoke or rotate the two historical provider credentials identified during the audit:
  one OpenAI API credential and one xAI API credential. Treat both as compromised even if they
  appear inactive.
- [ ] Replace the contaminated remote history: force-push the new `main`, remove or independently
  sanitize the four obsolete remote branches, and confirm no tag or pull-request ref retains the
  former commits.
- [ ] Ask collaborators to discard old clones and contact the hosting provider about cached commit,
  diff, archive, and pull-request views after the rewrite.
- [ ] Inspect and remove sensitive content from Actions logs and artifacts, deployment logs,
  releases and draft releases, package/container registries, webhooks, Pages, and repository
  metadata. These surfaces were not writable from the sanitation environment.
- [ ] Confirm the exposed provider credentials were not reused by any deployment, CI job, local
  environment, or downstream service.

## Legal and content review

- [x] Preserve the repository's existing Apache-2.0 license choice and upstream Vercel notice.
- [x] Remove the bundled font and first-party logo copies whose redistribution provenance was not
  established during the audit.
- [x] Replace the browser icon with a new source SVG and retain an Expo starter-asset notice for the
  generic mobile icons.
- [ ] Confirm the organization is authorized to publish and use the project name and associated
  trademarks.
- [ ] Obtain a legal/product decision for the restricted or missing-license MetaMask packages in
  the current Thirdweb dependency path, or remove/replace that path before public distribution.
- [ ] Review source and notice obligations for transitive native and image-processing binaries in
  every packaged mobile, container, or desktop distribution.

## Dependency review

The production license inventory currently includes MetaMask SDK packages whose published
license metadata is restricted or absent. They are transitive dependencies of the required
Thirdweb wallet client. This repository must not be described as an entirely permissive dependency
stack until that issue is resolved.

The final local `pnpm audit --prod` run reported zero critical and zero high-severity advisories.
Three moderate findings remain for legacy `uuid` versions in the MetaMask wallet subtree, and two
low findings remain in the AI SDK. Cross-major replacement of `uuid` was not forced because it may
break wallet behavior; update the owning packages when compatible releases are available.

Run immediately before release:

```bash
pnpm audit --prod
pnpm licenses list --prod --json
```

Review all high-severity advisories, deprecated packages, peer-resolution warnings, and packages
without machine-readable license metadata. Avoid untested cross-major overrides.

## Repository settings

- [ ] Enable private vulnerability reporting, Dependabot alerts, and secret scanning.
- [ ] Protect `main`; require pull requests and the `CI` and `Gitleaks` checks.
- [ ] Disable force-pushes and branch deletion after the one-time sanitized-history replacement.
- [ ] Review the repository description, topics, homepage, social preview, Actions permissions,
  webhook destinations, deploy keys, applications, and environment/repository secrets.
- [ ] Enable Discussions only if maintainers intend to support them.

## Release verification

- [ ] Confirm the final local root commit is the only reachable commit and all old local refs,
  reflogs, and unreachable objects have been pruned.
- [ ] Confirm final filesystem, full-history, build-output, and fresh-clone scans pass with both
  Gitleaks and TruffleHog.
- [ ] Run `pnpm install --frozen-lockfile`, `pnpm format:check`, `pnpm check`, `pnpm build`, the
  Playwright tests, and mobile type/lint checks from a fresh clone.
- [ ] Verify `.env.example` and `mobile/.env.example` contain placeholders only.
- [ ] Do not publish or change repository visibility until credential rotation, remote-history
  replacement, external-surface review, and the dependency-license decision are complete.
