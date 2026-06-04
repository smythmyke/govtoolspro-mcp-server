import { GovToolsProApiClient } from "../api/client.js";

export const lookupLaborRatesTool = {
  name: "lookup_labor_rates",
  description:
    "Benchmark federal labor rates for a NAICS code and/or a specific labor category. Returns GSA CALC " +
    "awarded ceiling rates (min/median/max by category) plus BLS OEWS wage data with a +55% government " +
    "wrap (loaded hourly) estimate. Free. Public GSA + BLS data — verify allowable rates against the RFP.",
  inputSchema: {
    type: "object",
    properties: {
      naicsCode: { type: "string", description: "NAICS code — maps to GSA labor categories + BLS SOC occupations." },
      laborCategory: {
        type: "string",
        description: "Specific labor category for a direct GSA search, e.g. 'program manager', 'software engineer'.",
      },
    },
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      gsaRates: {
        type: "array",
        items: {
          type: "object",
          properties: {
            category: { type: "string" },
            minRate: { type: "number" },
            medianRate: { type: "number" },
            maxRate: { type: "number" },
            avgRate: { type: "number" },
            sampleCount: { type: "number" },
          },
        },
      },
      blsWages: {
        type: "array",
        items: {
          type: "object",
          properties: {
            occupation: { type: "string" },
            socCode: { type: "string" },
            meanHourly: { type: "number" },
            loadedHourly: { type: "number" },
            meanAnnual: { type: "number" },
          },
        },
      },
      summary: { type: "object", additionalProperties: true },
    },
    required: ["gsaRates", "blsWages"],
    additionalProperties: true,
  },
  annotations: {
    title: "Look up labor rates",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
} as const;

interface LaborRatesResponse {
  gsaRates: Array<{ category: string; minRate: number; medianRate: number; maxRate: number; avgRate?: number; sampleCount: number }>;
  blsWages: Array<{ occupation: string; socCode: string; meanHourly: number; loadedHourly: number; meanAnnual: number }>;
  summary?: { blendedHourlyRange?: { low: number; median: number; high: number } | null; [key: string]: unknown };
}

export async function runLookupLaborRates(
  api: GovToolsProApiClient,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: "text"; text: string }>; structuredContent: LaborRatesResponse }> {
  const naicsCode = typeof args.naicsCode === "string" ? args.naicsCode.trim() : "";
  const laborCategory = typeof args.laborCategory === "string" ? args.laborCategory.trim() : "";
  if (!naicsCode && !laborCategory) {
    throw new Error("Provide naicsCode and/or laborCategory");
  }
  const body: Record<string, unknown> = {};
  if (naicsCode) body.naicsCode = naicsCode;
  if (laborCategory) body.laborCategory = laborCategory;

  const { data, disclaimer } = await api.post<LaborRatesResponse>("/lookup-labor-rates", body);

  const lines = [
    `GSA CALC ceiling rates (${data.gsaRates.length} categor${data.gsaRates.length === 1 ? "y" : "ies"}):`,
    ...data.gsaRates.slice(0, 6).map(
      (r) => `  • ${r.category}: $${r.minRate}–$${r.maxRate}/hr (median $${r.medianRate}, n=${r.sampleCount})`
    ),
    "",
    `BLS loaded wage benchmarks (${data.blsWages.length} occupation${data.blsWages.length === 1 ? "" : "s"}):`,
    ...data.blsWages.slice(0, 6).map(
      (w) => `  • ${w.occupation} (${w.socCode}): $${w.meanHourly}/hr mean → $${w.loadedHourly}/hr loaded`
    ),
    data.summary?.blendedHourlyRange
      ? `\nBlended hourly range: $${data.summary.blendedHourlyRange.low}–$${data.summary.blendedHourlyRange.high} (median $${data.summary.blendedHourlyRange.median})`
      : null,
    disclaimer ? `\n${disclaimer}` : null,
  ].filter((s): s is string => s !== null);

  return { content: [{ type: "text", text: lines.join("\n") }], structuredContent: data };
}
