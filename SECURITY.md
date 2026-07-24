# Security policy

## Supported versions

Security fixes are applied to the current `main` branch. Older commits and unmaintained forks are
not supported.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Use GitHub's private vulnerability
reporting flow:

https://github.com/imbueworld/pryv-API/security/advisories/new

Include the affected route or component, reproduction steps, impact, and any suggested mitigation.
Remove secrets and personal data from the report. Maintainers will coordinate disclosure after a
fix is available.

If private vulnerability reporting is not yet enabled, contact the repository owner privately and
ask them to enable it before sharing technical details.

## Credential exposure

Treat any credential committed to Git—even briefly—as compromised. Revoke or rotate it first, then
remove it from the full Git history. Deleting it only from the latest commit is not sufficient.

Values prefixed with `NEXT_PUBLIC_` or `EXPO_PUBLIC_` are public by design and must never contain
credentials, private keys, signing secrets, database URLs, or privileged provider tokens.
