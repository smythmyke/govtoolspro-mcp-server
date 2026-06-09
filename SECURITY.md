# Security Policy

## Supported versions

The latest published `govtoolspro-mcp-server` release on npm receives security
updates. Older versions are not maintained — please upgrade to the latest.

## Reporting a vulnerability

Please report security issues **privately** — do not open a public issue for a
suspected vulnerability.

- **Preferred:** open a private advisory via GitHub Security Advisories
  (the repository's **Security → Report a vulnerability** tab).
- **Email:** smythmyke@gmail.com with subject `SECURITY: govtoolspro-mcp-server`.

Please include a description of the issue, affected version(s), and reproduction
steps or a proof of concept.

### Response targets

- **Acknowledgement:** within 3 business days.
- **Triage / initial assessment:** within 7 business days.
- **Fix or mitigation plan:** communicated after triage, prioritized by severity.

We follow coordinated disclosure: we ask that you give us a reasonable window to
release a fix before any public disclosure, and we will credit reporters who wish
to be acknowledged.

## Scope & architecture notes

This package is a thin MCP client wrapper. It speaks JSON-RPC over stdio and
forwards tool calls to the GovToolsPro backend at `https://mcp.govtoolspro.com`
over HTTPS.

- The only secret consumed is `GOVTOOLSPRO_API_KEY`, read from the environment and
  sent as a bearer credential to the GovToolsPro API. It is never logged.
- The server makes **no** outbound network connections other than to the
  GovToolsPro API base (configurable via `GOVTOOLSPRO_API_BASE`).
- The server reads no local files and requires no filesystem mounts.

Vulnerabilities in the GovToolsPro **backend API** (as opposed to this client
wrapper) should also be reported via the channels above.
