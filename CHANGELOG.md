# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.4] - 2026-06-12

### Added
- Continuous integration (GitHub Actions): build + keyless protocol test on
  Node 18/20/22, plus a production dependency audit.
- Dependabot for npm, GitHub Actions, and Docker.
- `SECURITY.md` with a coordinated-disclosure policy.
- Hardened container release workflow (multi-arch GHCR image, SPDX SBOM, and
  Sigstore-signed SLSA provenance) on version tags, for the ToolHive registry.
- `npm test` — keyless protocol test (`scripts/protocol-test.mjs`) asserting the
  MCP handshake and full 10-tool list, plus a `toText` output-parity test
  (`scripts/totext-test.mjs`) covering all 10 tools.

### Changed
- Internal: every tool refactored to a canonical `ToolDef` (schema + annotations
  + `run` + `toText`) under `src/tool-kit`, with a thin MCP adapter; the
  `index.ts` dispatch collapses to a single registry. No change to tool behavior
  or output (locked by the parity test). Groundwork for emitting the same
  definitions as WebMCP in-page tools from a browser build.

## [0.1.3] - 2026-06-05

### Added
- Three market-intelligence tools: `lookup_labor_rates` (GSA CALC + BLS),
  `analyze_award_patterns`, and `analyze_market` — bringing the server to 10 tools.

## [0.1.2] - 2026-06-01

### Changed
- Documentation: key-minting instructions point to the GovToolsPro extension
  **Profile → API Keys** tab.

## [0.1.1] - 2026-06-01

### Added
- Tool output schemas and tool annotations (`readOnlyHint`).
- Lazy configuration so the server starts without a key for protocol-level requests.

## [0.1.0] - 2026-05-30

### Added
- Initial GovToolsPro MCP server with 7 tools: `balance`, `get_solicitation`,
  `score_go_no_go`, `find_incumbents`, `find_partners_near`, `predict_recompete`,
  and `lookup_neco_data`.

[Unreleased]: https://github.com/smythmyke/govtoolspro-mcp-server/compare/v0.1.4...HEAD
[0.1.4]: https://github.com/smythmyke/govtoolspro-mcp-server/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/smythmyke/govtoolspro-mcp-server/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/smythmyke/govtoolspro-mcp-server/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/smythmyke/govtoolspro-mcp-server/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/smythmyke/govtoolspro-mcp-server/releases/tag/v0.1.0
