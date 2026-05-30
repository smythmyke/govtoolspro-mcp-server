import { GovToolsProApiClient } from "../api/client.js";

export const scoreGoNoGoTool = {
  name: "score_go_no_go",
  description:
    "Score a federal solicitation as GO / NO-GO (0-100) against a company profile. " +
    "Detects hard blockers (CMMC certification gaps, geographic/OEM constraints, set-aside ineligibility), " +
    "scores NAICS match, past performance, and capability fit, and returns a recommendation with red flags and reasons. " +
    "Deterministic decision-support — no AI, free. Pass the analyzed solicitation documents (from your extension or " +
    "an analyze-solicitation step) plus your company profile.",
  inputSchema: {
    type: "object",
    properties: {
      documentAnalyses: {
        type: "array",
        description:
          "Analyzed solicitation documents (required, at least one). Each item is the structured analysis of a solicitation document " +
          "(summary, classification with naicsCode/setAside, valueAndScope with placeOfPerformance, etc.).",
        items: { type: "object" },
      },
      profile: {
        type: "object",
        description:
          "Company profile to score against: company (legalName, address.state), industryCodes.primaryNaics, " +
          "businessTypes (smallBusiness, sdvosb, ...), capabilities (coreCompetencies, cmmcStatus.level).",
      },
      solicitationData: {
        type: "object",
        description: "Optional extra solicitation context, e.g. { responseDeadline }.",
      },
      incumbentData: {
        type: "object",
        description: "Optional incumbent context, e.g. { primaryIncumbent } from find_incumbents.",
      },
    },
    required: ["documentAnalyses"],
    additionalProperties: false,
  },
} as const;

interface ScoreResponse {
  score: number;
  recommendation: string;
  blockers?: Array<{ type?: string; message?: string; reason?: string }>;
  reasons?: string[];
  categoryScores?: Record<string, unknown>;
  [key: string]: unknown;
}

export async function runScoreGoNoGo(
  api: GovToolsProApiClient,
  args: Record<string, unknown>
): Promise<{
  content: Array<{ type: "text"; text: string }>;
  structuredContent: ScoreResponse;
}> {
  if (!Array.isArray(args.documentAnalyses) || args.documentAnalyses.length === 0) {
    throw new Error("documentAnalyses (non-empty array) is required");
  }
  const body: Record<string, unknown> = { documentAnalyses: args.documentAnalyses };
  if (args.profile) body.profile = args.profile;
  if (args.solicitationData) body.solicitationData = args.solicitationData;
  if (args.incumbentData) body.incumbentData = args.incumbentData;

  const { data, disclaimer } = await api.post<ScoreResponse>("/score-go-no-go", body);

  const blockers = data.blockers ?? [];
  const lines = [
    `Recommendation: ${data.recommendation ?? "n/a"} (score ${data.score ?? "n/a"}/100)`,
    blockers.length > 0
      ? `Blockers (${blockers.length}):\n${blockers
          .map((b) => `  • ${b.type ?? "blocker"}: ${b.message ?? b.reason ?? ""}`.trimEnd())
          .join("\n")}`
      : "Blockers: none",
    data.reasons && data.reasons.length > 0
      ? `Key reasons:\n${data.reasons.slice(0, 8).map((r) => `  • ${r}`).join("\n")}`
      : null,
    disclaimer ? `\n${disclaimer}` : null,
  ].filter((s): s is string => s !== null);

  return {
    content: [{ type: "text", text: lines.join("\n") }],
    structuredContent: data,
  };
}
