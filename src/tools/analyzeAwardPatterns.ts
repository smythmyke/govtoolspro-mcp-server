import { GovToolsProApiClient } from "../api/client.js";

export const analyzeAwardPatternsTool = {
  name: "analyze_award_patterns",
  description:
    "Analyze how contracts in a NAICS are typically awarded: award-size distribution, competition mix " +
    "(full & open / limited / sole-source), bid intensity (single-bid rate, expected bidders), contract " +
    "vehicles, and pricing types. From public USAspending + FPDS data. Costs 3 credits.",
  inputSchema: {
    type: "object",
    properties: {
      naicsCode: { type: "string", description: "NAICS code (required)." },
      pscCode: { type: "string", description: "Optional PSC code to narrow the analysis." },
      years: { type: "number", description: "Lookback in years (default ~3)." },
      state: { type: "string", description: "Optional 2-letter place-of-performance state filter." },
    },
    required: ["naicsCode"],
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      awardSizeDistribution: { type: "array", items: { type: "object", additionalProperties: true } },
      competition: { type: ["object", "null"], additionalProperties: true },
      bidStatistics: { type: ["object", "null"], additionalProperties: true },
      contractVehicles: { type: "array", items: { type: "object", additionalProperties: true } },
      pricingTypes: { type: "array", items: { type: "object", additionalProperties: true } },
    },
    additionalProperties: true,
  },
  annotations: {
    title: "Analyze award patterns",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
} as const;

interface AwardPatternsResponse {
  awardSizeDistribution?: Array<{ range: string; count: number; pct: number }>;
  competition?: { fullAndOpenPct?: number; limitedPct?: number; soleSourcePct?: number; competitionLevel?: string } | null;
  bidStatistics?: { avgOffers?: number; singleBidRate?: number; fivePlusBidRate?: number; expectedBidders?: number } | null;
  contractVehicles?: Array<{ vehicle: string; count?: number; pct: number }>;
  pricingTypes?: Array<{ type: string; pct: number }>;
  [key: string]: unknown;
}

export async function runAnalyzeAwardPatterns(
  api: GovToolsProApiClient,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: "text"; text: string }>; structuredContent: AwardPatternsResponse }> {
  const naicsCode = typeof args.naicsCode === "string" ? args.naicsCode.trim() : "";
  if (!naicsCode) throw new Error("naicsCode is required");
  const body: Record<string, unknown> = { naicsCode };
  for (const k of ["pscCode", "years", "state"]) {
    if (args[k] !== undefined) body[k] = args[k];
  }

  const { data, disclaimer } = await api.post<AwardPatternsResponse>("/analyze-award-patterns", body);

  const c = data.competition;
  const b = data.bidStatistics;
  const lines = [
    `Award patterns for NAICS ${naicsCode}:`,
    c
      ? `Competition: ${c.fullAndOpenPct ?? "?"}% full & open, ${c.soleSourcePct ?? "?"}% sole-source (${c.competitionLevel ?? "n/a"})`
      : "Competition: (FPDS unavailable)",
    b
      ? `Bidding: avg ${b.avgOffers ?? "?"} offers, ${b.singleBidRate ?? "?"}% single-bid, ~${b.expectedBidders ?? "?"} expected bidders`
      : "Bidding: (FPDS unavailable)",
    data.pricingTypes && data.pricingTypes.length
      ? `Pricing: ${data.pricingTypes.map((p) => `${p.type} ${p.pct}%`).join(", ")}`
      : null,
    data.contractVehicles && data.contractVehicles.length
      ? `Vehicles: ${data.contractVehicles.slice(0, 5).map((v) => `${v.vehicle} ${v.pct}%`).join(", ")}`
      : null,
    data.awardSizeDistribution && data.awardSizeDistribution.length
      ? `Award sizes: ${data.awardSizeDistribution.map((d) => `${d.range} ${d.pct}%`).join(", ")}`
      : null,
    disclaimer ? `\n${disclaimer}` : null,
  ].filter((s): s is string => s !== null);

  return { content: [{ type: "text", text: lines.join("\n") }], structuredContent: data };
}
