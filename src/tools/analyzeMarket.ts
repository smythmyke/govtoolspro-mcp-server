import type { ToolDef } from "../tool-kit/types.js";

interface MarketResponse {
  spendingTrend?: Array<{ fiscalYear: number; total: number; inProgress?: boolean }>;
  industryContext?: { establishments?: number; employees?: number } | null;
  federalSharePct?: number | null;
  topContractors?: Array<{ name: string; totalAwards?: number; marketSharePct?: number }>;
  concentration?: { hhi?: number; level?: string; top5SharePct?: number } | null;
  setAsideDistribution?: Array<{ type: string; pct: number }>;
  geographicDistribution?: Array<{ state: string; total: number }>;
  [key: string]: unknown;
}

export const analyzeMarketDef: ToolDef<Record<string, unknown>, MarketResponse> = {
  name: "analyze_market",
  description:
    "Full market-intelligence snapshot for a NAICS: 5-year federal spending trend, industry size (Census), " +
    "top contractors with market share + HHI concentration, set-aside distribution, geographic distribution, " +
    "and contract-vehicle usage. From public USAspending + Census data. Costs 5 credits.",
  inputSchema: {
    type: "object",
    properties: {
      naicsCode: { type: "string", description: "NAICS code (required)." },
      pscCode: { type: "string", description: "Optional PSC code for sharper competitor filtering." },
      setAside: { type: "string", description: "Optional set-aside context." },
    },
    required: ["naicsCode"],
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      spendingTrend: { type: "array", items: { type: "object", additionalProperties: true } },
      industryContext: { type: ["object", "null"], additionalProperties: true },
      federalSharePct: { type: ["number", "null"] },
      topContractors: { type: "array", items: { type: "object", additionalProperties: true } },
      concentration: { type: ["object", "null"], additionalProperties: true },
      setAsideDistribution: { type: "array", items: { type: "object", additionalProperties: true } },
      geographicDistribution: { type: "array", items: { type: "object", additionalProperties: true } },
      contractVehicles: { type: "array", items: { type: "object", additionalProperties: true } },
      recentLargeAwards: { type: "array", items: { type: "object", additionalProperties: true } },
    },
    additionalProperties: true,
  },
  annotations: {
    title: "Analyze market",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },

  async run(ctx, args) {
    const naicsCode = typeof args.naicsCode === "string" ? args.naicsCode.trim() : "";
    if (!naicsCode) throw new Error("naicsCode is required");
    const body: Record<string, unknown> = { naicsCode };
    for (const k of ["pscCode", "setAside"]) {
      if (args[k] !== undefined) body[k] = args[k];
    }

    return ctx.post<MarketResponse>("/analyze-market", body);
  },

  toText(data, disclaimer, args) {
    const naicsCode = typeof args.naicsCode === "string" ? args.naicsCode.trim() : "";
    const trend = data.spendingTrend ?? [];
    const conc = data.concentration;
    const lines = [
      `Market snapshot for NAICS ${naicsCode}:`,
      trend.length
        ? `Spending: ${trend.map((t) => `FY${t.fiscalYear} $${(t.total / 1e9).toFixed(1)}B${t.inProgress ? " (YTD)" : ""}`).join(" → ")}`
        : null,
      data.topContractors && data.topContractors.length
        ? `Top contractors:\n${data.topContractors
            .slice(0, 5)
            .map((c, i) => `  ${i + 1}. ${c.name}${c.marketSharePct != null ? ` (${c.marketSharePct}%)` : ""}`)
            .join("\n")}`
        : null,
      conc ? `Concentration: HHI ${conc.hhi ?? "?"} (${conc.level ?? "n/a"}), top-5 ${conc.top5SharePct ?? "?"}%` : null,
      data.setAsideDistribution && data.setAsideDistribution.length
        ? `Set-asides: ${data.setAsideDistribution.slice(0, 4).map((s) => `${s.type} ${s.pct}%`).join(", ")}`
        : null,
      data.geographicDistribution && data.geographicDistribution.length
        ? `Top states: ${data.geographicDistribution.slice(0, 5).map((g) => g.state).join(", ")}`
        : null,
      data.industryContext && data.industryContext.establishments
        ? `Industry (Census): ${data.industryContext.establishments?.toLocaleString()} establishments, ${data.industryContext.employees?.toLocaleString()} employees`
        : null,
      disclaimer ? `\n${disclaimer}` : null,
    ].filter((s): s is string => s !== null);
    return lines.join("\n");
  },
};
