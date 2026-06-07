# GovToolsPro MCP — Tool Expansion Plan (vs GovTribe)

Created 2026-06-05 after reviewing GovTribe's Claude connector (24 `Search_*` tools, raw
retrieval, paywalled — see the competitive read below) and auditing our own codebase for
capabilities we already have but haven't exposed as MCP tools.

## Competitive read (Claude-MCP only)
- **GovTribe** = breadth of *raw search* (federal + state/local + grants + vendors + contacts
  + news + forecasts + defense programs). Paid-subscription gated ($1,350–$5,500+/yr) + MCP
  credits. No Skill. GovExec-backed.
- **GovToolsPro** = *decisions/synthesis* GovTribe doesn't make. Free signup + 10 credits;
  most tools free. Has a Skill. Federal-focused, narrower.
- **Wedge to defend:** free/low-friction access + decision verbs ("score", "predict",
  "analyze", "estimate") + the Skill. Don't compete on raw-search breadth.
- **Real functional gaps buyers expect that we lack:** vendor/entity search, opportunity
  search/forecasts. (Grants, state/local, news = GovTribe-only, no backend → skip.)

## Build pattern (same as the analytics tier)
Each new tool = (1) port the capability into a `server/workflows-api/` handler + service
(stateless, CommonJS, fail-soft), (2) register a route in `workflows/index.js` (+ creditGate
if metered), (3) mirror the schema/handler in `mcp/index.js` (connector) AND add a
`src/tools/*.ts` to the stdio repo, (4) bump manifests + smoke. Source endpoints below live in
the **legacy Cloud Run `api/api-server.js`** (extension-facing) and must be ported, not called.

---

## Tier 1 — high value, fits read-only decision wedge

### 1. `estimate_bid` ⭐ (EASIEST — do first)
- **Source:** `api/api-server.js` `POST /api/v1/estimate-bid` (~L1058).
- **Inputs:** `naics` (required); optional `psc`, `state`, `agency`, `setAside`,
  `contractValueEstimate`, `incumbentKnown`.
- **What it does:** queries USAspending `spending_by_award` (last 2 yrs, award types A–D,
  filtered by NAICS/PSC/state), computes p25/median/p75 → bid range
  (aggressive=p25*0.9, competitive=median, conservative=p75*1.1) + confidence (High ≥20
  contracts / Medium ≥10 / Low) + similar-contracts list + stats. Falls back to
  contractValueEstimate*{0.85,0.92,1.05} if no data.
- **Deps:** USAspending only (same API our analytics tools already use). **No AI, no file, no
  state.** Stateless — near-copy of `marketAnalysis.js`/`awardPatterns.js`.
- **Port difficulty:** TRIVIAL. **Metered ~2–3 credits**, read-only. Empty-guard: refund if
  no contracts AND no estimate (apply the real-data-presence check, not array length — see the
  charge-on-empty bug we fixed in analyzeMarket/awardPatterns).
- **Differentiator:** GovTribe has nothing like it.

### 2. `analyze_solicitation_document` / `extract_amendment_changes` ⭐⭐ (HEAVIER)
- **Source:** `api/api-server.js` `POST /api/v1/analyze-document` (~L8874),
  `/extract-amendment-changes` (~L9440), `/classify-documents` (~L10265).
- **Inputs:** document as **`url`** (preferred for MCP — feed the SAM.gov attachment URLs that
  `get_solicitation` already returns) or base64 `data`; `name`, `mimeType`; `analysisType`
  (`summary` | `full`).
- **What it does:** fetch/decode doc → `extractText()` → `classifyDocument()` (doc type) →
  Gemini analysis (summary or full). `extract-amendment-changes` diffs amendment vs base.
- **Deps:** `extractText()` (PDF/DOCX text extraction — may use Google Document AI),
  `classifyDocument()` + analysis via **Gemini (`genAI`)**, `calculateCredits(bufferSize)`.
  Credits scale with file size (summary 1x / full 2x).
- **Port difficulty:** MEDIUM–HIGH. Needs Gemini API key + the text-extraction stack wired
  into `workflows-api` (currently only in the Cloud Run server). Watch Cloud Functions
  timeout/memory on large PDFs. **Metered (size-based)**, read-only.
- **Differentiator:** ⭐⭐ GovTribe only *searches* files (`Search_Government_Files`); we
  *analyze* them. Strong, unique. Natural pairing with `get_solicitation` (it returns the
  attachment URLs this tool consumes).

### 3. `find_contractors` / `search_vendors` (MEDIUM)
- **Source:** `api/api-server.js` `GET /api/v1/find-contractors` (~L945),
  `POST /api/v1/enhanced-incumbent-search` (~L4082).
- **Closes:** GovTribe `Search_Vendors` — the one *functional* gap buyers expect.
- **TODO:** read both handlers to confirm data source (USAspending/FPDS/SAM) + inputs before
  scoping. Likely stateless (USAspending vendor rollup). Read-only.

### 4. `lookup_entity` (MEDIUM)
- **Source:** `api/api-server.js` `POST /api/v1/profiles/lookup-uei` (~L11304).
- **What:** SAM entity lookup by UEI (registration/cert/NAICS). Maps to GovTribe vendor/entity.
- **TODO:** confirm it hits SAM Entity API + what fields; check API-key needs. Read-only.

## Tier 2 — value-add but changes the all-read-only story (write/generate)
- `draft_proposal_section`, `draft_outreach_email` — `POST /api/v1/generate-proposal-section`
  (~L1483), `/generate-proposal-outline` (~L10453), `/generate-email` (~L1229). Gemini writing
  tools. Would need `readOnlyHint:false` + careful annotation (separate read vs write — a
  Connector-Directory requirement). Defer until after Tier 1.
- `match_opportunities` — `GET /api/v1/matched-opportunities` (~L12120). Profile-matched opp
  discovery (value-add vs raw opp search). Needs a stored profile → more stateful; scope later.

## Skip (GovTribe-only, no backend / against value-add ToS)
Grants (opps/awards/programs), state & local, federal forecasts, major defense programs,
agency search, government news. Net-new builds and/or raw passthrough — out of scope.

## Suggested sequence
1. `estimate_bid` (trivial, unique) → 11 tools.
2. `find_contractors` + `lookup_entity` (closes the vendor gap) → 13 tools.
3. `analyze_solicitation_document` (the ⭐⭐ differentiator; budget time for the Gemini/extract
   stack) → 14 tools.
4. Later: proposal writing tools (Tier 2) + `match_opportunities`.

All Tier 1 are read-only and mostly *porting existing code*. After adding, refresh the
connector listing tool count + the README tool table + the Skill workflow.
