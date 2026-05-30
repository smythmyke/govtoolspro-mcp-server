import { GovToolsProApiClient } from "../api/client.js";

export const predictRecompeteTool = {
  name: "predict_recompete",
  description:
    "Discover federal contracts expiring within a window (recompete opportunities) via public USAspending data, " +
    "optionally enriched with procurement-history signals (all-options-exercised, offers received, set-aside, competition type). " +
    "Filter by NAICS, PSC, state, value, and keywords. Returns contracts with days-until-expiration and urgency. " +
    "Deterministic, free. Expiration/option signals reflect reported data and may lag.",
  inputSchema: {
    type: "object",
    properties: {
      filters: {
        type: "object",
        description: "All optional. Narrow the recompete search.",
        properties: {
          naicsCodes: { type: "array", items: { type: "string" }, description: "NAICS codes (2/4/6 digit)." },
          pscCodes: { type: "array", items: { type: "string" }, description: "PSC codes." },
          states: { type: "array", items: { type: "string" }, description: "2-letter place-of-performance state codes." },
          minContractValue: { type: "number", description: "Default 500000." },
          maxContractValue: { type: "number" },
          expirationWindowDays: { type: "number", description: "Default 365 (max 1095)." },
          keywords: { type: "array", items: { type: "string" } },
        },
      },
      page: { type: "number", description: "Page number (default 1)." },
      limit: { type: "number", description: "Results per page (default 25, max 100)." },
      sortOrder: { type: "string", enum: ["asc", "desc"], description: "Sort by End Date (default 'desc')." },
      enrich: { type: "boolean", description: "Enrich top results with procurement history (default true)." },
      enrichCount: { type: "number", description: "How many to enrich (default 10, max 25)." },
    },
    additionalProperties: false,
  },
} as const;

interface RecompeteResponse {
  contracts: Array<{
    awardId?: string;
    recipientName?: string;
    awardAmount?: number;
    endDate?: string;
    daysUntilExpiration?: number;
    urgency?: string;
    naicsCode?: string;
    procurementHistory?: { allOptionsExercised?: boolean; offersReceived?: string } | null;
  }>;
  totalCount: number;
  hasMore?: boolean;
  expirationWindow?: unknown;
}

export async function runPredictRecompete(
  api: GovToolsProApiClient,
  args: Record<string, unknown>
): Promise<{
  content: Array<{ type: "text"; text: string }>;
  structuredContent: RecompeteResponse;
}> {
  if (args.filters !== undefined && (typeof args.filters !== "object" || Array.isArray(args.filters))) {
    throw new Error("filters must be an object if provided");
  }
  const body: Record<string, unknown> = {};
  for (const k of ["filters", "page", "limit", "sortOrder", "enrich", "enrichCount"]) {
    if (args[k] !== undefined) body[k] = args[k];
  }

  const { data, disclaimer } = await api.post<RecompeteResponse>("/predict-recompete", body);

  const lines = [
    `${data.totalCount} recompete candidate(s)${data.hasMore ? " (more available — page through)" : ""}:`,
    ...data.contracts.slice(0, 10).map((c, i) => {
      const val = c.awardAmount ? `$${Number(c.awardAmount).toLocaleString()}` : "n/a";
      const days = c.daysUntilExpiration !== undefined ? `${c.daysUntilExpiration}d to expiry` : "expiry n/a";
      const opt = c.procurementHistory?.allOptionsExercised ? " · all options exercised" : "";
      return `  ${i + 1}. ${c.recipientName ?? "n/a"} — ${val} [${c.urgency ?? "?"}, ${days}]${opt}\n     ${c.awardId ?? ""} ends ${c.endDate ?? "?"}`;
    }),
    data.contracts.length > 10 ? `  … and ${data.contracts.length - 10} more in structuredContent.contracts` : null,
    disclaimer ? `\n${disclaimer}` : null,
  ].filter((s): s is string => s !== null);

  return {
    content: [{ type: "text", text: lines.join("\n") }],
    structuredContent: data,
  };
}
