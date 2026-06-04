# Analytics Endpoints — Round One Spec (market-intelligence tools)

**Status:** SPEC for sign-off (2026-06-04). No code yet.
**Goal:** expose 3 of the extension's analytics-tab features as workflow endpoints / MCP tools, to
drive credit purchases. Ported from `GovToolsPro/chrome-extension/src/analytics/` (currently
client-side TS) into the `workflows-api` backend, same pattern as the existing 7 tools.

## Decisions (locked)
- **Credit value** (set by existing packs): ~$0.033 (Standard) – $0.04 (Starter) per credit.
- **Per-tool cost:** `lookup_labor_rates` = **free**; `analyze_award_patterns` = **3**; `analyze_market` = **5**.
- **Same cost on every surface** (extension / API key / Claude connector) — one shared `extension_credits` pool.
- **Connector funnel:** connector get-or-create grants the standard **10 signup credits + `monthlyAllocation: 10`**
  so connector users ride the monthly free-credit refresh (recurring funnel). Insufficient-credits returns a
  **passive** message (no in-chat checkout): "out of credits — manage at govtoolspro.com".
- **Free tools stay free:** the existing 7 + `lookup_labor_rates` form the discovery layer.
- Data sources are all **public, no API key** (USAspending, FPDS, BLS OEWS, Census CBP, GSA CALC).

---

## 1. `lookup_labor_rates` — FREE (teaser)
**Purpose:** Labor-rate benchmarking for a NAICS or labor category — GSA CALC contract ceiling rates +
BLS loaded wage benchmarks. Top-of-funnel hook.
**Source:** `chrome-extension/src/analytics/services/{gsaCalc,blsOEWS}.ts`.

- **Inputs** (at least one of naicsCode / laborCategory required):
  - `naicsCode` (string) — maps to relevant SOC occupations + GSA labor categories
  - `laborCategory` (string) — direct category search, e.g. "program manager", "software engineer"
- **Outputs:**
  - `gsaRates`: `[{ category, minRate, medianRate, maxRate, sampleCount }]` (GSA CALC hourly ceilings)
  - `blsWages`: `[{ occupation, socCode, meanHourly, loadedHourly, meanAnnual }]` (loadedHourly = +55% overhead)
  - `summary`: blended hourly range + the NAICS→SOC mapping used
- **Value-add:** NAICS→SOC mapping, +55% loaded-rate estimation, min/median/max aggregation.
- **Credits:** 0 (free). **Surfaces:** all.

## 2. `analyze_award_patterns` — 3 credits
**Purpose:** How contracts in a NAICS are typically awarded — size distribution, competition mix,
bid intensity, contract vehicles, pricing types.
**Source:** `services/{fpds,usaspending,gsaCalc,blsOEWS}.ts` (AwardPatterns tab).

- **Inputs:**
  - `naicsCode` (string, **required**)
  - `pscCode` (string, optional), `years` (number, optional lookback), `state` (string, optional)
- **Outputs:**
  - `awardSizeDistribution`: `[{ range, count, pct }]` (6 buckets)
  - `competition`: `{ fullAndOpenPct, limitedPct, soleSourcePct, competitionLevel }`
  - `bidStatistics`: `{ avgOffers, singleBidRate, fivePlusBidRate, expectedBidders }`
  - `contractVehicles`: `[{ vehicle, count, pct }]` (BPA / IDIQ / FSS / …)
  - `pricingTypes`: `[{ type, pct }]` (FFP / T&M / cost-plus)
  - `laborRateBenchmark`: optional GSA/BLS summary for context
- **Value-add:** expected-bidders calc, competition + pricing aggregation across FPDS + USAspending.
- **Credits:** 3 (~$0.10). **Surfaces:** all (gated).

## 3. `analyze_market` — 5 credits (flagship)
**Purpose:** Full market snapshot for a NAICS — spend trend, industry size, concentration, top
players, set-asides, geography.
**Source:** `services/{usaspending,censusCBP,gsaCalc}.ts` (MarketOverview + CompetitorLandscape).

- **Inputs:**
  - `naicsCode` (string, **required**)
  - `pscCode` (string, optional), `setAside` (string, optional)
- **Outputs:**
  - `spendingTrend`: `[{ fiscalYear, total }]` (5y)
  - `industryContext` (Census): `{ establishments, employees, annualPayroll, avgCompanySize, topStates }`
  - `federalSharePct`: federal spend as % of industry revenue
  - `topContractors`: `[{ name, totalAwards, marketSharePct, businessSize, trend }]`
  - `concentration`: `{ hhi, level, top5SharePct }`
  - `setAsideDistribution`: `[{ type, pct }]`
  - `geographicDistribution`: `[{ state, total }]` (top 8)
  - `contractVehicles`: `[{ vehicle, pct }]`
  - `recentLargeAwards`: `[{ recipient, amount, date }]`
- **Value-add:** cross-source aggregation (USAspending + Census + GSA), HHI concentration, federal-share ratio.
- **Credits:** 5 (~$0.17). **Surfaces:** all (gated).

---

## Shared infrastructure to build (once)
1. **`creditGate` for workflows-api** — port a self-contained `deductCredits` / `refundCredits` helper
   (Firestore transaction on `extension_credits/{email}:GovToolsPro`: check `available >= cost`, decrement
   `available`, increment `used`; **refund on handler failure** so a failed call doesn't burn credits).
   Mirrors `api/api-server.js:8653` (`deductCredits`) but stays inside the isolated workflows codebase.
   Insufficient → **402** `INSUFFICIENT_CREDITS` with passive top-up message.
2. **`ensureCreditAccount(email)`** — get-or-create the `extension_credits` doc with `available: 10`,
   `monthlyAllocation: 10` if absent. Called on **connector** auth (mcp/index.js resolveAuth) so new
   connector users get the signup grant + ride the existing monthly free-credit reset job. Idempotent for
   existing accounts (extension/API-key users already have a doc).
3. **Cost map** — `{ lookup_labor_rates: 0, analyze_award_patterns: 3, analyze_market: 5 }`.

## Per-tool implementation footprint (each, mirroring the existing 7)
- **Backend:** `services/<name>.js` (port the extension TS → CommonJS), `workflows/<name>.js` handler,
  route in `workflows/index.js` (`authenticate → cuiGate → [creditGate(n)] → handler`), and a `ROUTES`
  entry in `mcp/index.js` (with its credit cost).
- **stdio MCP repo (this repo):** `src/tools/<name>.ts` (def + run fn) + registration + version bump + republish.
- **Connector tool defs:** add to the `TOOLS` array in `mcp/index.js`.
- **Tests:** extend `mcp/__smoke__.js` + workflows smoke.

## Notes
- All 3 take codes/keywords (no document payloads), so CUI risk is low — but `cuiGate` is applied anyway for
  consistency (cheap, harmless).
- Skipped from round one (per review): `AwardsDatabase` (raw passthrough — ToS), `IncumbentIntelligence`
  (overlaps `find_incumbents`; revisit as an upgrade), `analyze_competitors`/`analyze_agency`/`lookup_sbir_awards`
  (round two candidates).
