# GovToolsPro MCP Server

[![npm version](https://img.shields.io/npm/v/govtoolspro-mcp-server.svg)](https://www.npmjs.com/package/govtoolspro-mcp-server)
[![MCP Registry](https://img.shields.io/badge/MCP%20Registry-active-2da44e)](https://registry.modelcontextprotocol.io/v0/servers?search=govtoolspro)
[![Glama](https://img.shields.io/badge/Glama-listed-blue)](https://glama.ai/mcp/servers/smythmyke/govtoolspro-mcp-server)
[![smithery badge](https://smithery.ai/badge/smythmyke/govtoolspro-mcp-server)](https://smithery.ai/servers/smythmyke/govtoolspro-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An [MCP](https://modelcontextprotocol.io) server that gives Claude (and any MCP client) **workflow tools for federal contractors** — not raw data access, but decisions: go/no-go scoring, incumbent intelligence, teaming-partner search, recompete prediction, Navy NECO lookup, and SAM.gov solicitation retrieval.

It wraps the live [GovToolsPro](https://govtoolspro.com) API. You bring an API key; the server proxies your calls.

## Tools

| Tool | Cost | What it does |
|---|---|---|
| `balance` | free | Credit balance + subscription status. |
| `get_solicitation` | free | Notice ID (or solicitation number) → structured SAM.gov fields (NAICS, PSC, set-aside, place of performance, deadline, contacts, attachment links). The workflow entry point. |
| `score_go_no_go` | free | Score a solicitation GO / NO-GO (0–100) against your company profile, with hard-blocker detection (CMMC, geographic, set-aside). |
| `find_incumbents` | free | Identify the current incumbent via USAspending + FPDS, with competition signals and anticipated next-award date. |
| `find_partners_near` | free | Rank nearby teaming partners / subcontractors by proximity for a place of performance. |
| `predict_recompete` | free | Discover expiring contracts (recompete opportunities) by NAICS/PSC/state/value, enriched with option-exercise signals. |
| `lookup_neco_data` | free | Parse a Navy NECO (neco.navy.mil) solicitation into structured fields. No other govcon MCP has this. |

Every tool returns decision-support output with a disclaimer — verify against the official solicitation before relying on results.

## Install

Add to your MCP client config (Claude Desktop, Claude Code, Cursor, Cline, Zed, …):

```jsonc
{
  "mcpServers": {
    "govtoolspro": {
      "command": "npx",
      "args": ["-y", "govtoolspro-mcp-server"],
      "env": { "GOVTOOLSPRO_API_KEY": "gtp_live_..." }
    }
  }
}
```

### Get an API key

Create a key in the **GovToolsPro extension → Profile → API Keys** tab (format `gtp_live_...` / `gtp_test_...`).

## Configuration

| Env var | Required | Default |
|---|---|---|
| `GOVTOOLSPRO_API_KEY` | yes | — |
| `GOVTOOLSPRO_API_BASE` | no | `https://mcp.govtoolspro.com/api/v1/workflows` |

## Local development

```bash
npm install
npm run build

# end-to-end stdio smoke test against the live API
GOVTOOLSPRO_API_KEY=gtp_test_... npm run smoke
```

To point a client at your local build:

```jsonc
{
  "command": "node",
  "args": ["/absolute/path/to/govtoolspro-mcp-server/dist/index.js"],
  "env": { "GOVTOOLSPRO_API_KEY": "gtp_test_..." }
}
```

## Notes

- **Workflow MCP, not a data wrapper.** Competing govcon MCPs return raw SAM.gov/FPDS JSON; these tools return synthesized decisions.
- **CUI safety.** The API rejects content with CUI / FOUO / Distribution-Statement markings; those rejections surface to the client as clear errors. Do not submit controlled content.
- **No warranty.** Output is decision support only — not legal, contractual, or award-outcome advice.

## License

MIT © Michael Smyth
