import type { ToolDef } from "../tool-kit/types.js";

interface IncumbentResponse {
  primaryIncumbent?: {
    companyName?: string;
    totalValue?: number;
    contractCount?: number;
    fpdsData?: { numberOfOffersReceived?: number; typeOfSetAside?: string } | null;
  } | null;
  otherIncumbents?: Array<{ companyName?: string; totalValue?: number }>;
  usaspendingResults?: number;
  fpdsResults?: number;
  fpdsError?: string | null;
  anticipatedStartDate?: string;
  [key: string]: unknown;
}

export const findIncumbentsDef: ToolDef<Record<string, unknown>, IncumbentResponse> = {
  name: "find_incumbents",
  description:
    "Identify the likely current incumbent(s) for a solicitation using public USAspending + FPDS award data. " +
    "Returns the primary incumbent (name, award value, period of performance), FPDS competition signals " +
    "(offers received, set-aside, sole-source flags), and an anticipated next-award start date. " +
    "Deterministic, free. FPDS failures degrade gracefully (USAspending half stays intact).",
  inputSchema: {
    type: "object",
    properties: {
      solicitation: {
        type: "object",
        description:
          "Solicitation context. naicsCode is REQUIRED. Optional: pscCode, agency, subAgency, office, placeOfPerformance, title, responseDeadline.",
        properties: {
          naicsCode: { type: "string", description: "NAICS code (required)." },
          pscCode: { type: "string" },
          agency: { type: "string" },
          subAgency: { type: "string" },
          office: { type: "string" },
          placeOfPerformance: { type: "string" },
          title: { type: "string" },
          responseDeadline: { type: "string" },
        },
        required: ["naicsCode"],
      },
      years: { type: "number", description: "USAspending lookback in fiscal years (default 5, max 10)." },
      limit: { type: "number", description: "Max USAspending contracts (default 50, max 100)." },
      fpdsMaxResults: { type: "number", description: "Max FPDS contracts (default 50, max 100)." },
      anticipatedStartDate: {
        type: "string",
        description: "ISO date overriding the responseDeadline-based anticipated-start calculation.",
      },
    },
    required: ["solicitation"],
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      primaryIncumbent: {
        type: ["object", "null"],
        properties: {
          companyName: { type: "string" },
          totalValue: { type: "number" },
          contractCount: { type: "number" },
          fpdsData: {
            type: ["object", "null"],
            properties: {
              numberOfOffersReceived: { type: "number" },
              typeOfSetAside: { type: "string" },
            },
          },
        },
      },
      otherIncumbents: {
        type: "array",
        items: {
          type: "object",
          properties: { companyName: { type: "string" }, totalValue: { type: "number" } },
        },
      },
      usaspendingResults: { type: "number" },
      fpdsResults: { type: "number" },
      fpdsError: { type: ["string", "null"] },
      anticipatedStartDate: { type: "string" },
    },
    additionalProperties: true,
  },
  annotations: {
    title: "Find incumbents",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },

  async run(ctx, args) {
    const solicitation = args.solicitation as Record<string, unknown> | undefined;
    if (!solicitation || typeof solicitation !== "object") {
      throw new Error("solicitation (object) is required");
    }
    if (!solicitation.naicsCode) {
      throw new Error("solicitation.naicsCode is required");
    }
    const body: Record<string, unknown> = { solicitation };
    for (const k of ["years", "limit", "fpdsMaxResults", "anticipatedStartDate"]) {
      if (args[k] !== undefined) body[k] = args[k];
    }

    return ctx.post<IncumbentResponse>("/find-incumbents", body);
  },

  toText(data, disclaimer) {
    const p = data.primaryIncumbent;
    const lines = [
      p
        ? `Primary incumbent: ${p.companyName ?? "unknown"}${p.totalValue ? ` — $${Number(p.totalValue).toLocaleString()}` : ""}${p.contractCount ? ` across ${p.contractCount} contract(s)` : ""}`
        : "Primary incumbent: none identified",
      p?.fpdsData
        ? `  FPDS signals: ${p.fpdsData.numberOfOffersReceived ?? "?"} offer(s) received${p.fpdsData.typeOfSetAside ? `, set-aside ${p.fpdsData.typeOfSetAside}` : ""}`
        : null,
      data.anticipatedStartDate ? `Anticipated next-award start: ${data.anticipatedStartDate}` : null,
      `Sources: USAspending ${data.usaspendingResults ?? 0} result(s), FPDS ${data.fpdsResults ?? 0} result(s)${data.fpdsError ? ` (FPDS degraded: ${data.fpdsError})` : ""}`,
      disclaimer ? `\n${disclaimer}` : null,
    ].filter((s): s is string => s !== null);
    return lines.join("\n");
  },
};
