// Output-parity test for every tool's `toText` renderer — no network or key
// required. Feeds canned API responses through the compiled ToolDefs and
// asserts the exact human-facing text. This is the regression guard that the
// Phase 0-2 refactor (and future tool edits) keep `tools/call` output stable.
//
// Fixtures are intentionally minimal and avoid Number.toLocaleString() (which
// is locale-dependent) so the expected strings are unambiguous in any CI.
// The find_partners_near / analyze_award_patterns / analyze_market cases
// specifically exercise that the summary echoes the *input* args.
//
// Exits 0 on success, 1 on any mismatch.
import { balanceDef } from "../dist/tools/balance.js";
import { scoreGoNoGoDef } from "../dist/tools/scoreGoNoGo.js";
import { getSolicitationDef } from "../dist/tools/getSolicitation.js";
import { findIncumbentsDef } from "../dist/tools/findIncumbents.js";
import { findPartnersNearDef } from "../dist/tools/findPartnersNear.js";
import { predictRecompeteDef } from "../dist/tools/predictRecompete.js";
import { lookupNecoDataDef } from "../dist/tools/lookupNecoData.js";
import { lookupLaborRatesDef } from "../dist/tools/lookupLaborRates.js";
import { analyzeAwardPatternsDef } from "../dist/tools/analyzeAwardPatterns.js";
import { analyzeMarketDef } from "../dist/tools/analyzeMarket.js";

const cases = [
  {
    def: balanceDef,
    data: {
      balance: 100,
      subscriptionCredits: 80,
      topupCredits: 20,
      totalUsed: 5,
      subscription: { planId: "pro", status: "active" },
    },
    disclaimer: "Not legal advice.",
    args: {},
    expected:
      "Credit balance: 100\n" +
      "  • Subscription credits: 80\n" +
      "  • Top-up credits: 20\n" +
      "Total used: 5\n" +
      "Subscription: pro (active)\n" +
      "\nNot legal advice.",
  },
  {
    def: scoreGoNoGoDef,
    data: {
      score: 38,
      recommendation: "NO-GO",
      blockers: [{ type: "cmmc", message: "CMMC level gap" }],
      reasons: ["NAICS mismatch", "No past performance"],
    },
    disclaimer: "Decision support only.",
    args: {},
    expected:
      "Recommendation: NO-GO (score 38/100)\n" +
      "Blockers (1):\n" +
      "  • cmmc: CMMC level gap\n" +
      "Key reasons:\n" +
      "  • NAICS mismatch\n" +
      "  • No past performance\n" +
      "\nDecision support only.",
  },
  {
    def: getSolicitationDef,
    data: {
      title: "Test",
      solicitationNumber: "",
      type: "",
      typeLabel: "",
      naicsCode: "",
      naicsCodes: [],
      pscCode: "",
      setAside: "",
      responseDeadline: "",
      responseTimeZone: "",
      placeOfPerformance: null,
      pointOfContact: [],
      cancelled: false,
      archived: false,
      description: "",
      link: "",
    },
    disclaimer: "D",
    args: {},
    expected:
      "Test\n" +
      "Type: n/a\n" +
      "NAICS: n/a | PSC: n/a | Set-aside: none\n" +
      "Response deadline: n/a\n" +
      "Place of performance: n/a\n" +
      "\nD",
  },
  {
    def: findIncumbentsDef,
    data: { primaryIncumbent: null, usaspendingResults: 0, fpdsResults: 0 },
    disclaimer: "D",
    args: {},
    expected:
      "Primary incumbent: none identified\n" +
      "Sources: USAspending 0 result(s), FPDS 0 result(s)\n" +
      "\nD",
  },
  {
    def: findPartnersNearDef,
    data: {
      totalResults: 1,
      businesses: [
        {
          name: "Acme IT",
          formattedAddress: "100 Main St",
          distanceMiles: 2,
          rating: 4.5,
          phone: "555",
          website: "acme.com",
        },
      ],
    },
    disclaimer: "D",
    args: { keyword: "IT support", address: "Arlington, VA" },
    expected:
      '1 partner candidate(s) for "IT support" near Arlington, VA:\n' +
      "  1. Acme IT (2.0 mi) ★4.5\n" +
      "     100 Main St\n" +
      "     555 · acme.com\n" +
      "\nD",
  },
  {
    def: predictRecompeteDef,
    data: {
      totalCount: 1,
      hasMore: false,
      contracts: [
        {
          recipientName: "Acme",
          awardId: "X1",
          endDate: "2026-12-31",
          daysUntilExpiration: 200,
          urgency: "medium",
          procurementHistory: null,
        },
      ],
    },
    disclaimer: "D",
    args: {},
    expected:
      "1 recompete candidate(s):\n" +
      "  1. Acme — n/a [medium, 200d to expiry]\n" +
      "     X1 ends 2026-12-31\n" +
      "\nD",
  },
  {
    def: lookupNecoDataDef,
    data: {
      requestedUrl: "https://neco/x",
      summary: { title: "Navy Widget", solicitationNumber: "N001" },
    },
    disclaimer: "D",
    args: {},
    expected:
      "Navy Widget [N001]\n" +
      "Issue date: n/a | Response deadline: n/a\n" +
      "Contract type: n/a | Set-aside: none\n" +
      "Source: https://neco/x\n" +
      "\nD",
  },
  {
    def: lookupLaborRatesDef,
    data: {
      gsaRates: [{ category: "PM", minRate: 50, maxRate: 150, medianRate: 100, sampleCount: 10 }],
      blsWages: [{ occupation: "Manager", socCode: "11-3021", meanHourly: 60, loadedHourly: 93, meanAnnual: 120000 }],
      summary: {},
    },
    disclaimer: "D",
    args: {},
    expected:
      "GSA CALC ceiling rates (1 category):\n" +
      "  • PM: $50–$150/hr (median $100, n=10)\n" +
      "\n" +
      "BLS loaded wage benchmarks (1 occupation):\n" +
      "  • Manager (11-3021): $60/hr mean → $93/hr loaded\n" +
      "\nD",
  },
  {
    def: analyzeAwardPatternsDef,
    data: { competition: null, bidStatistics: null },
    disclaimer: "D",
    args: { naicsCode: "541512" },
    expected:
      "Award patterns for NAICS 541512:\n" +
      "Competition: (FPDS unavailable)\n" +
      "Bidding: (FPDS unavailable)\n" +
      "\nD",
  },
  {
    def: analyzeMarketDef,
    data: { spendingTrend: [{ fiscalYear: 2025, total: 2e9, inProgress: false }], concentration: null },
    disclaimer: "D",
    args: { naicsCode: "541512" },
    expected:
      "Market snapshot for NAICS 541512:\n" +
      "Spending: FY2025 $2.0B\n" +
      "\nD",
  },
];

let failed = 0;
for (const c of cases) {
  const actual = c.def.toText(c.data, c.disclaimer, c.args);
  if (actual === c.expected) {
    console.log(`✓ ${c.def.name}`);
  } else {
    failed++;
    console.error(`✗ ${c.def.name}`);
    console.error(`  expected: ${JSON.stringify(c.expected)}`);
    console.error(`  actual:   ${JSON.stringify(actual)}`);
  }
}

if (failed > 0) {
  console.error(`✗ toText test failed: ${failed}/${cases.length} mismatched`);
  process.exit(1);
}
console.log(`✓ toText test passed (${cases.length} tools)`);
process.exit(0);
