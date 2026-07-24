# Privacy considerations

This repository contains no production datasets or customer fixtures. Tests must use synthetic
identities, reserved domains, and non-routable example addresses.

The client can handle wallet addresses, API keys, billing status, usage records, prompts, uploaded
content, and PII-preview requests when connected to a backend. Those data categories can be
personal or sensitive even when they are pseudonymous.

Deployers are responsible for defining and documenting:

- the purpose and legal basis for each data flow;
- processors involved in authentication, payment, model inference, telemetry, and hosting;
- collection, retention, deletion, access, and incident-response procedures;
- regional transfer and user-notice requirements;
- access controls for logs, traces, support records, and backups.

Do not put tokens, wallet activity, prompts, uploaded documents, request bodies, or user identifiers
in client or server logs. Analytics is disabled by default because enabling it can create new data
flows. The presence of PII-redaction controls does not guarantee that every identifier is detected
or removed.

The Expo launcher opens the configured site in the system browser. It intentionally does not bridge
cookies, OAuth results, document contents, or access tokens to native code.
