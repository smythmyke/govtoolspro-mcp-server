# Claude Connector Plan — GovToolsPro (Remote MCP + WorkOS OAuth)

**Goal:** list GovToolsPro in the **Claude Connector Directory** (the mainstream Claude-user funnel; complementary to ToolHive for federal/CUI). GovToolsPro **can go fully public** — it owns `govtoolspro.com`, so production WorkOS AuthKit works (custom domain via CNAME).

**Replication of the JackpotKeywords pilot (proven end-to-end via Claude 2026-06-03).** Full gotcha list + reference implementation: `C:/Projects/JackpotKeywords/docs/api-deployment/CLAUDE-CONNECTOR-REPLICATION-RUNBOOK.md` (copy `mcpOAuth.ts` + `mcp.ts` verbatim; only the tool set + env differ).

## ⚠️ Key difference from MarkItUp/JK: where the code goes
This repo (`govtoolspro-mcp-server`) is the **stdio** npm server — it stays as-is for npm/Smithery/Glama. The Claude connector needs a **REMOTE (Streamable HTTP) MCP endpoint, which belongs in the GovToolsPro BACKEND**, not here. The backend `workflowsApi` is already deployed at **`mcp.govtoolspro.com`** — that's where `mcp.ts` + `mcpOAuth.ts` get added. Strategy is tracked in the backend roadmap (`…/Projects/GovToolsPro/ROADMAP.md`); this doc is the connector-specific reference.

## Prereqs (mostly the existing PUB/ANNOT items)
- **ANNOT-1** (this repo) — ✅ **DONE / verified 2026-06-04.** All 7 tools carry `title` + `readOnlyHint: true` + `destructiveHint: false` + `idempotentHint: true` + `openWorldHint: true` (in `src/tools/*.ts`; propagated to `dist/tools/*.js` + `manifest-rich-tools.json`, shipped in v0.1.2). NOTE: the original prereq text was boilerplate — there are **no `generate_*` tools** in this server; all 7 are read/analyze/lookup tools (balance, get_solicitation, lookup_neco_data, predict_recompete, find_incumbents, find_partners_near, score_go_no_go), so `readOnlyHint: true` is correct across the board. The backend remote-MCP `tools/list` must echo these same annotations. **(Was the #1 Connector-Directory rejection cause — now cleared.)**
- Publishing (PUB-1..4) — npm/GitHub/Smithery done; Registry/Glama pending (not blocking the connector).

## Build steps (in the BACKEND repo, copy from JK) — ✅ PORTED 2026-06-04
**Code-complete + in-process smoke-tested (13/13); NOT yet deployed (gated on WorkOS Phase 0 env).** Files added in `server/workflows-api/`:
- `mcp/index.js` — `mcpApi` Function: stateless hand-rolled JSON-RPC (CommonJS), wraps the SAME 7 workflow handlers + `cuiGate` via a synthetic req/res adapter (zero changes to the existing handler files → can't regress workflowsApi). Tool schemas+annotations mirror `govtoolspro-mcp-server/src/tools/*` (two sources of truth — keep in sync). Isolated Function: `firebase deploy --only functions:mcpApi` won't touch workflowsApi/keysApi.
- `mcp/oauth.js` — JK's `mcpOAuth.ts` ported to CommonJS (jose-free `node:crypto` JWKS verify, RFC 9728 PRM, WorkOS email lookup, fetch timeouts). Identity = verified email; **no per-call customer minting** (GovToolsPro keys credits by email; workflow tools are free). Auth-at-CONNECT 401 + `WWW-Authenticate` on every unauth POST incl. initialize ✓. PRM at `/api/mcp/.well-known/oauth-protected-resource` ✓.
- `mcp/__smoke__.js` — added to `npm run smoke` (now workflows 113 / keys 43 / mcp 13).
- Wired `exports.mcpApi` in `index.js`; added Hosting rewrite `/api/mcp/** → mcpApi` on the `mcp` target → connector URL = **`https://mcp.govtoolspro.com/api/mcp`**.
- Env the code expects (set during WorkOS Phase 0, gitignored `.env`): `WORKOS_AUTHKIT_DOMAIN`, `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, optional `GTP_MCP_RESOURCE_URL` (default `https://mcp.govtoolspro.com/api/mcp`). Dev/test bypass: `GTP_MCP_DEV_AUTH=1` + `x-dev-email` header.
- ⬜ FOLLOW-UP POLISH (non-blocking): tool result text is currently capped pretty-JSON of `data` + disclaimer (structuredContent carries the full payload). Port the richer per-tool `run*()` formatters from the stdio repo if reviewers want prettier transcripts.

### Original step list (now done unless noted)
1. **Remote MCP transport** — add `mcp.ts` to the backend (the service behind `mcp.govtoolspro.com`): stateless hand-rolled JSON-RPC over HTTP (CommonJS-safe). Wrap the same 7 tools + the existing `gtp_live_` API client; only the transport changes (stdio → Streamable HTTP).
2. **OAuth verification** — copy JK's `mcpOAuth.ts` verbatim (jose-free `node:crypto` JWKS verification, RFC 9728 PRM, WorkOS email lookup, fetch timeouts). Map verified email → GovToolsPro customer (keyless get-or-create).
3. **Auth at CONNECT** ⭐ — 401 + `WWW-Authenticate: Bearer resource_metadata="…"` on EVERY unauthenticated JSON-RPC POST incl. `initialize` (allowing anonymous initialize = client connects without OAuth and never logs in; tell-tale = "Disconnect" greyed out).
4. Serve RFC 9728 PRM at `<mcp>/.well-known/oauth-protected-resource`; advertise it in the `WWW-Authenticate` header.

## WorkOS Phase 0 (~15 min)
1. WorkOS dashboard (Staging first) → **Applications → Create application** → Client ID; **API Keys** → secret.
2. **Domains** → AuthKit card (Staging auto-gen `*.authkit.app`; **Production = custom domain via CNAME** → set `auth.govtoolspro.com`).
3. **Connect → Configuration** → enable **DCR + CIMD**, scopes `openid profile email`. ⚠️ Per-environment (redo in Production); without it the connector fails with "Couldn't register" even though `/oauth2/register` is advertised in metadata.
4. Backend env: `WORKOS_CLIENT_ID`, `WORKOS_API_KEY`, `WORKOS_AUTHKIT_DOMAIN`.

## Test + submit
Claude → Customize → Connectors → "+" → Name + Remote MCP URL (`https://mcp.govtoolspro.com/…/mcp`) → leave OAuth blank (DCR self-registers) → Add → WorkOS login → **toggle ON per-conversation** → call a tool. Success log: `initialize bearer=false→401`, `PRM fetched`, `initialize bearer=true auth=ok`, `tools/call auth=ok`. Then Staging→Production (set `auth.govtoolspro.com`, re-enable DCR+CIMD, swap env) → submit `claude.com/docs/connectors/building/submission` (~2wk).

## Compliance note
govcon buyers are seat/enterprise-billed, so the Connector Directory is brand/discovery (not pay-per-call). Keep the federal/CUI angle for ToolHive; the Connector Directory is the mainstream Claude funnel. Never expose raw SAM.gov/FPDS passthrough — value-add/AI tools only (existing ToS rule).
