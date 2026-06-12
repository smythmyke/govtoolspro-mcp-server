# ToolHive Registry Plan — GovToolsPro MCP Server

**Goal:** list the GovToolsPro MCP server in the **Stacklok ToolHive registry**
(`github.com/stacklok/toolhive-registry`). ToolHive's value is running MCP servers
in a sandbox with network-egress controls + supply-chain attestation — which makes
it the right surface for the **federal / CUI** audience (the security story is the
product, not just discovery). Lower raw volume than the Claude Connector Directory,
but high fit.

**Reference docs (verified 2026-06-09):**
- Inclusion criteria: https://docs.stacklok.com/toolhive/concepts/registry-criteria
- ToolHive-native schema: https://docs.stacklok.com/toolhive/reference/registry-schema-toolhive
- Upstream schema: https://docs.stacklok.com/toolhive/reference/registry-schema-upstream
- Repo + CONTRIBUTING: https://github.com/stacklok/toolhive-registry

---

## Where we already pass (hard requirements — all met)
- ✅ Fully open source, source publicly accessible — repo is **PUBLIC**.
- ✅ Permissive license — **MIT** (AGPL/GPL2/GPL3 are excluded; MIT is fine).
- ✅ Full MCP API support — working stdio server, official `@modelcontextprotocol/sdk`, 10 tools.

## Gaps to close (scored/expected signals = the actual work)
- ❌ No published OCI image (current `Dockerfile` is a Glama CI stub: `npm i -g`).
- ❌ No provenance (Sigstore / GitHub Attestations / SLSA), no SBOM.
- ❌ No `.github/` — no CI, no security scanning, no release automation.
- ❌ No Dependabot/Renovate; deps + Actions unpinned.
- ◐ Semver yes, but no `CHANGELOG.md`.
- ◐ Only a smoke-test script; no CI-run automated test.
- ❌ No `SECURITY.md` (incident-response channel is a listed criterion).
- ◐ 0 stars (soft signal; not a blocker).

---

## Decision: container-primary
ToolHive entries are **container-based** (`packages[].registryType: oci`) or
**remote** (`remotes[]`). Go **container-first** because:
1. Independent of the Connector→Production / WorkOS OAuth work (no dependency).
2. ToolHive's sandbox + egress allow-list is the federal/CUI selling point — a
   container locked to a single outbound host showcases it.
3. The stdio server inside the container calls `mcp.govtoolspro.com` with the
   user's `GOVTOOLSPRO_API_KEY` (env var) — clean, no OAuth.

**Fast-follow (Phase 5):** add a `remotes[]` entry with `oauth_config` once the
Claude Connector is in Production (`auth.govtoolspro.com` live).

---

## Phase 1 — Repo hardening (the audit story) — ✅ DONE 2026-06-09
*Maps 1:1 to inclusion-criteria "Maintenance & Operations" + "Quality Signals".*
- [x] `CHANGELOG.md` (Keep a Changelog format); backfilled 0.1.0→0.1.3.
- [x] `SECURITY.md` — disclosure channels + response SLA + egress/architecture notes.
- [x] `.github/dependabot.yml` — ecosystems: `npm`, `github-actions`, `docker`.
- [x] `.github/workflows/ci.yml` — on PR/push: `npm ci`, build, `npm test` on
      Node 18/20/22 + a prod `npm audit` (high/critical). Actions **pinned by SHA**.
- [x] Real automated test: `scripts/protocol-test.mjs` (keyless — asserts
      initialize handshake + exactly 10 tools incl. core ones), wired as `npm test`.
- [x] Security scanning: `npm audit --omit=dev --audit-level=high` job in CI.

## Phase 2 — Hardened container + supply chain — ◐ IN PROGRESS 2026-06-09
- [x] Rewrote `Dockerfile` → multi-stage **build from source**: builder
      `node:22-alpine` (pinned by digest) compiles `dist/` + prunes to prod deps;
      runtime `gcr.io/distroless/nodejs22-debian12:nonroot` (pinned by digest) —
      no shell/pkg-mgr, non-root uid 65532. Single dep `@modelcontextprotocol/sdk`
      is pure JS so alpine→debian node_modules is safe. Replaces the old Glama
      `npm i -g` stub (from-source still satisfies Glama's build+handshake check).
- [x] `.github/workflows/release.yml` — on tag `v*`: buildx **multi-arch
      (amd64+arm64)** push to `ghcr.io/smythmyke/govtoolspro-mcp-server`;
      buildkit provenance+sbom; **`actions/attest-build-provenance`** (SLSA +
      Sigstore, `push-to-registry`); **anchore/syft SPDX SBOM** attached to the
      GitHub release. All actions pinned by SHA.
- [ ] **REMAINING:** cut historical tags `v0.1.0`–`v0.1.3` (for CHANGELOG compare
      links), then bump to **`v0.1.4`** and push the tag → triggers the first
      attested image build. Record the resulting image digest + provenance fields
      for the Phase-3 registry entry.
- [ ] Note: image can't be built locally (no Docker on dev box) — first real build
      is the CI release run; watch that run for Dockerfile/build errors.

## Phase 3 — Author the registry entry
- [ ] Fork `stacklok/toolhive-registry`; clone; install `Task` (taskfile.dev).
- [ ] Create `registries/toolhive/servers/govtoolspro/server.json` (container form):
  - `name`, `title`, `description`, `version`, `repository`, `websiteUrl`.
  - `packages[0]`: `registryType: "oci"`,
    `identifier: "ghcr.io/smythmyke/govtoolspro-mcp-server:v0.1.4"`,
    `transport.type: "stdio"`.
  - `_meta` → `io.modelcontextprotocol.registry/publisher-provided` → `io.github.stacklok`
    → the image-reference key:
    - `permissions.network.outbound.allow_host: ["mcp.govtoolspro.com"]`,
      `allow_port: [443]`.  **No filesystem paths / volume mounts** (hard security rule).
    - `env_vars`: `GOVTOOLSPRO_API_KEY` (required, secret),
      `GOVTOOLSPRO_API_BASE` (optional, not secret).
    - `tools`: all 10 tool names.
    - `tags`: e.g. `government`, `federal`, `govcon`, `sam.gov`, `procurement`.
    - `tier: "Community"`, `status: "Active"`.
    - `provenance { … }` from Phase 2 attestation.
    - `metadata.last_updated` (pulls/stars start 0).
- [ ] Validate locally: `task catalog:validate` then `task catalog:build`.

## Phase 4 — Submit & iterate
- [ ] Open a **registry submission issue** first (CONTRIBUTING requires it).
- [ ] PR: every commit **`Signed-off-by` (DCO)**; imperative-mood subjects ≤50 chars.
- [ ] Respond promptly to maintainer review (their own criterion penalizes slow
      response — model the behavior we're being judged on).

## Phase 5 — Remote entry (fast-follow, after Connector→Production)
- [ ] Add `remotes[]` entry for `https://mcp.govtoolspro.com/.../mcp` with
      `oauth_config` (WorkOS) once `auth.govtoolspro.com` is live.

## Phase 6 — Bundle patent-search (optional)
- [ ] Once the GovToolsPro flow is proven, repeat Phases 2–4 for the
      AI Patent Search MCP server (same supply-chain harness, different tool set).

---

## Sequencing note
Phases 1 + 2 are the bulk of the effort and are **reusable** across every future
ToolHive (and security-conscious) submission. Phase 3 is ~1 file. Do **not** block
on the Connector→Production work — container path is fully independent.
