import type { ToolDef } from "../tool-kit/types.js";

interface ScoreResponse {
  score: number;
  recommendation: string;
  blockers?: Array<{ type?: string; message?: string; reason?: string }>;
  reasons?: string[];
  categoryScores?: Record<string, unknown>;
  [key: string]: unknown;
}

export const scoreGoNoGoDef: ToolDef<Record<string, unknown>, ScoreResponse> = {
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
  outputSchema: {
    type: "object",
    properties: {
      score: { type: "number", description: "0-100 fit score." },
      recommendation: { type: "string", description: "GO / NO-GO / REVIEW." },
      blockers: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string" },
            message: { type: "string" },
            reason: { type: "string" },
          },
        },
      },
      reasons: { type: "array", items: { type: "string" } },
      categoryScores: { type: "object", additionalProperties: true },
    },
    required: ["score", "recommendation"],
    additionalProperties: true,
  },
  annotations: {
    title: "Score go/no-go",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },

  async run(ctx, args) {
    if (!Array.isArray(args.documentAnalyses) || args.documentAnalyses.length === 0) {
      throw new Error("documentAnalyses (non-empty array) is required");
    }
    const body: Record<string, unknown> = { documentAnalyses: args.documentAnalyses };
    if (args.profile) body.profile = args.profile;
    if (args.solicitationData) body.solicitationData = args.solicitationData;
    if (args.incumbentData) body.incumbentData = args.incumbentData;

    return ctx.post<ScoreResponse>("/score-go-no-go", body);
  },

  toText(data, disclaimer) {
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
    return lines.join("\n");
  },
};
