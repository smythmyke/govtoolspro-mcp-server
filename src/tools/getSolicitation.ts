import { GovToolsProApiClient } from "../api/client.js";

export const getSolicitationTool = {
  name: "get_solicitation",
  description:
    "Retrieve a single SAM.gov solicitation's structured fields by notice ID (or, best-effort, by solicitation number). " +
    "Returns title, solicitation number, type, NAICS, PSC, set-aside, place of performance, response deadline (with timezone), " +
    "points of contact, description, and attachment download links. Deterministic, free — pulls from SAM.gov's public opportunity records. " +
    "This is the entry point for a workflow: feed the returned fields into score_go_no_go, find_incumbents, or find_partners_near.",
  inputSchema: {
    type: "object",
    properties: {
      noticeId: {
        type: "string",
        description:
          "32-character hex SAM.gov notice ID (the ID in a sam.gov/opp/<id>/view URL). Primary, most reliable input.",
      },
      solicitationNumber: {
        type: "string",
        description:
          "Solicitation number (e.g. '140P6026Q0003'). Best-effort fallback — resolved via SAM.gov search; provide noticeId when you have it.",
      },
      includeAttachments: {
        type: "boolean",
        description: "Include attachment download links (default true). Set false to skip the extra lookup.",
        default: true,
      },
    },
    additionalProperties: false,
  },
} as const;

interface SolicitationResponse {
  noticeId: string;
  title: string;
  solicitationNumber: string;
  type: string;
  typeLabel: string;
  naicsCode: string;
  naicsCodes: string[];
  pscCode: string;
  setAside: string;
  responseDeadline: string;
  responseTimeZone: string;
  placeOfPerformance: {
    streetAddress?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  } | null;
  pointOfContact: Array<{ type?: string; fullName?: string; email?: string; phone?: string }>;
  postedDate: string;
  modifiedDate: string;
  archiveDate: string;
  cancelled: boolean;
  archived: boolean;
  description: string;
  link: string;
  attachments?: Array<{ type: string; name: string; url: string; mimeType?: string; sizeBytes?: number | null }>;
  attachmentsError?: string | null;
}

export async function runGetSolicitation(
  api: GovToolsProApiClient,
  args: Record<string, unknown>
): Promise<{
  content: Array<{ type: "text"; text: string }>;
  structuredContent: SolicitationResponse;
}> {
  const noticeId = typeof args.noticeId === "string" ? args.noticeId : undefined;
  const solicitationNumber =
    typeof args.solicitationNumber === "string" ? args.solicitationNumber : undefined;
  if (!noticeId && !solicitationNumber) {
    throw new Error("Provide either noticeId or solicitationNumber");
  }
  const body: Record<string, unknown> = {};
  if (noticeId) body.noticeId = noticeId;
  if (solicitationNumber) body.solicitationNumber = solicitationNumber;
  if (typeof args.includeAttachments === "boolean") body.includeAttachments = args.includeAttachments;

  const { data, disclaimer } = await api.post<SolicitationResponse>("/get-solicitation", body);

  const pop = data.placeOfPerformance;
  const popStr = pop
    ? [pop.city, pop.state, pop.zip].filter(Boolean).join(", ")
    : "n/a";
  const poc = data.pointOfContact?.[0];
  const lines = [
    `${data.title || "(untitled)"} ${data.solicitationNumber ? `[${data.solicitationNumber}]` : ""}`.trim(),
    `Type: ${data.typeLabel || data.type || "n/a"}${data.cancelled ? " — CANCELLED" : ""}${data.archived ? " — ARCHIVED" : ""}`,
    `NAICS: ${data.naicsCode || "n/a"}${data.naicsCodes && data.naicsCodes.length > 1 ? ` (+${data.naicsCodes.length - 1} more)` : ""} | PSC: ${data.pscCode || "n/a"} | Set-aside: ${data.setAside || "none"}`,
    `Response deadline: ${data.responseDeadline || "n/a"}${data.responseTimeZone ? ` (${data.responseTimeZone})` : ""}`,
    `Place of performance: ${popStr}`,
    poc ? `Primary contact: ${poc.fullName || "n/a"}${poc.email ? ` <${poc.email}>` : ""}${poc.phone ? ` ${poc.phone}` : ""}` : null,
    data.attachments ? `Attachments: ${data.attachments.length}${data.attachmentsError ? ` (lookup error: ${data.attachmentsError})` : ""}` : null,
    data.link ? `Link: ${data.link}` : null,
    data.description ? `\nDescription:\n${data.description.slice(0, 600)}${data.description.length > 600 ? " …" : ""}` : null,
    disclaimer ? `\n${disclaimer}` : null,
  ].filter((s): s is string => s !== null);

  return {
    content: [{ type: "text", text: lines.join("\n") }],
    structuredContent: data,
  };
}
