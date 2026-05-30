import { GovToolsProApiClient } from "../api/client.js";

export const lookupNecoDataTool = {
  name: "lookup_neco_data",
  description:
    "Fetch and parse a Navy NECO (Navy Electronic Commerce Online) solicitation page into structured data — " +
    "solicitation number, title, response deadline, NSN/line items, buyer contact, set-aside, and document links. " +
    "Deterministic scrape of the public neco.navy.mil site, free. No other govcon MCP exposes NECO data. " +
    "Pass the full NECO URL when you have it (most reliable); solicitationNumber alone is best-effort.",
  inputSchema: {
    type: "object",
    properties: {
      necoUrl: {
        type: "string",
        description:
          "Full NECO solicitation URL (https://www.neco.navy.mil/...). Primary, most robust input.",
      },
      solicitationNumber: {
        type: "string",
        description: "Navy solicitation number. Best-effort — the main NECO page may require an hkey to resolve.",
      },
      hkey: {
        type: "string",
        description: "Optional NECO hkey — improves solicitationNumber resolution.",
      },
    },
    additionalProperties: false,
  },
} as const;

interface NecoResponse {
  requestedUrl: string;
  data: Record<string, unknown>;
  summary: {
    solicitationNumber?: string;
    title?: string;
    issueDate?: string;
    responseDeadline?: string;
    contractType?: string;
    setAside?: string;
    buyingOffice?: string;
    buyerName?: string;
    buyerEmail?: string;
    buyerPhone?: string;
    nsn?: string;
    quantity?: number;
    documentsUrl?: string;
  };
}

export async function runLookupNecoData(
  api: GovToolsProApiClient,
  args: Record<string, unknown>
): Promise<{
  content: Array<{ type: "text"; text: string }>;
  structuredContent: NecoResponse;
}> {
  const necoUrl = typeof args.necoUrl === "string" ? args.necoUrl : undefined;
  const solicitationNumber =
    typeof args.solicitationNumber === "string" ? args.solicitationNumber : undefined;
  if (!necoUrl && !solicitationNumber) {
    throw new Error("Provide either necoUrl or solicitationNumber");
  }
  const body: Record<string, unknown> = {};
  if (necoUrl) body.necoUrl = necoUrl;
  if (solicitationNumber) body.solicitationNumber = solicitationNumber;
  if (typeof args.hkey === "string") body.hkey = args.hkey;

  const { data, disclaimer } = await api.post<NecoResponse>("/lookup-neco-data", body);
  const s = data.summary ?? {};

  const lines = [
    `${s.title ?? "(untitled)"} ${s.solicitationNumber ? `[${s.solicitationNumber}]` : ""}`.trim(),
    `Issue date: ${s.issueDate ?? "n/a"} | Response deadline: ${s.responseDeadline ?? "n/a"}`,
    `Contract type: ${s.contractType ?? "n/a"} | Set-aside: ${s.setAside ?? "none"}`,
    s.nsn ? `NSN: ${s.nsn}${s.quantity ? ` | Qty: ${s.quantity}` : ""}` : null,
    s.buyingOffice ? `Buying office: ${s.buyingOffice}` : null,
    s.buyerName || s.buyerEmail || s.buyerPhone
      ? `Buyer: ${s.buyerName ?? "n/a"}${s.buyerEmail ? ` <${s.buyerEmail}>` : ""}${s.buyerPhone ? ` ${s.buyerPhone}` : ""}`
      : null,
    s.documentsUrl ? `Documents: ${s.documentsUrl}` : null,
    `Source: ${data.requestedUrl}`,
    disclaimer ? `\n${disclaimer}` : null,
  ].filter((s2): s2 is string => s2 !== null);

  return {
    content: [{ type: "text", text: lines.join("\n") }],
    structuredContent: data,
  };
}
