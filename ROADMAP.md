# ROADMAP — govtoolspro-mcp-server

**Last updated:** 2026-06-03
**Scope:** Standalone public repo for the GovToolsPro MCP server (`govtoolspro-mcp-server`, currently `v0.1.1`, stdio transport, `gtp_live_*` API-key auth, 7 workflow tools). **Published to npm (`@0.1.1`, 2026-06-01), GitHub Releases, and Smithery.** MCP Registry and Glama are still pending. See the surface table in the `mcp-distribution-status` memory for the authoritative per-surface state.

> **Source of truth for strategy:** the GovToolsPro MCP/API build, the 6-week sequence, and the new monetization items are tracked in the **backend** roadmap at `C:\Users\smyth\OneDrive\Desktop\Projects\GovToolsPro\ROADMAP.md`. This file is the per-repo artifact checklist only — keep it thin to avoid drift (per the portfolio separation rule). No `DASHBOARD-META` here on purpose: GovToolsPro is already one dashboard project; this repo should not become a second card.

**Status legend:** ☐ todo · ◐ in progress · ✓ done · ⊘ blocked · ✗ dropped

## ACTIVE — Finish distribution (npm/GitHub/Smithery done; Registry + Glama remain)

- ✓ PUB-1: `npm publish` → `govtoolspro-mcp-server@0.1.1` (published 2026-06-01).
- ☐ PUB-2: MCP Registry publish via the bundled `mcp-publisher.exe` → `io.github.smythmyke/govtoolspro-mcp-server` (`server.json` ready). **Parked on interactive `mcp-publisher.exe login github` (user-only device flow); token expired.**
- ◐ PUB-3: ✓ GitHub Releases (v0.1.0 + v0.1.1) · ✓ Smithery published + listed (icon/settings done; confirm score lifted from 67 + search returns it) · ☐ Glama not yet submitted (web Add Server → Build & Release; `glama.json` at root).
- ☐ PUB-4: Smoke-test all 7 tools end-to-end with a `gtp_live_*` key (test key minted; backend `workflowsApi` deployed at `mcp.govtoolspro.com`).

## BACKLOG — MCP monetization & discovery (2026-06-02 review · gated on PUB-1..4)

*New surfaces from the MCP-monetization review. Strategy + sequencing live in the backend ROADMAP ("MCP monetization & Claude Connector Directory"); the repo-side work is below.*

- ⊘ ANNOT-1: Add tool annotations in the server's tool definitions — `readOnlyHint: true` on analyze/score/find/lookup/assess tools; `destructiveHint: true` on the `generate_*` tools. Regenerate `manifest.json` + `manifest-rich-tools.json` (`npm run gen:manifests`) so Smithery/Glama carry them too. **Prereq for CONN-1** (missing annotations = ~30% of Connector Directory rejections). Cheapest to do as part of the build, before first publish.
- ⊘ CONN-1: Stand up a **remote** MCP transport (Streamable HTTP — current build is stdio) + OAuth, then submit to the **Claude Connector Directory** (`claude.com/docs/connectors/building/submission`, ~2wk review). **Streamlined plan (JackpotKeywords pilot proven end-to-end via Claude 2026-06-03): `CLAUDE-CONNECTOR-PLAN.md`.** ⚠️ Remote endpoint goes in the **BACKEND** (`mcp.govtoolspro.com`), NOT this stdio repo — copy JK's `mcp.ts` + `mcpOAuth.ts` (jose-free WorkOS AuthKit OAuth); require auth at CONNECT; enable DCR+CIMD in WorkOS Connect→Configuration; AuthKit custom domain `auth.govtoolspro.com` (GTP owns it → **can go fully public**). Needs privacy-policy URL + production-ready + ANNOT-1. Complementary to ToolHive (self-hosted/federal); this is the mainstream Claude-user funnel.
- ⊘ X402-1: Optional x402 / HTTP-402-gated metered path for autonomous-agent pay-per-call (Stripe x402 on Base; MCP tool returns `402`, zero schema change). Lowest portfolio priority — govcon buyers are seat/enterprise-billed. Revisit only after the JackpotKeywords pilot proves the pattern and if agent traffic appears.

## DONE

- ✓ 2026-06-01 — Server scaffolded + `.mcpb` bundle, manifests, icon, and `mcp-publisher.exe` staged in repo; `server.json` + `package.json` at `v0.1.1`. Ready to publish pending backend endpoint reachability.
