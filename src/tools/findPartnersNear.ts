import { GovToolsProApiClient } from "../api/client.js";

export const findPartnersNearTool = {
  name: "find_partners_near",
  description:
    "Find potential teaming partners / subcontractors near a solicitation's place of performance via Google Places. " +
    "Given a capability keyword and a geocodable address, returns nearby businesses ranked by proximity, " +
    "enriched (top results) with phone and website. Deterministic, free. " +
    "Verify capabilities, certifications, and eligibility independently before relying on results.",
  inputSchema: {
    type: "object",
    properties: {
      keyword: {
        type: "string",
        description:
          "Industry/capability term, e.g. 'IT support', 'electrical contractor', 'janitorial services'.",
      },
      address: {
        type: "string",
        description:
          "Place of performance — any geocodable string, e.g. 'Arlington, VA' or a full street address.",
      },
      radius: {
        type: "number",
        description: "Search radius in miles (default 25, max 100).",
        default: 25,
      },
    },
    required: ["keyword", "address"],
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      businesses: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            formattedAddress: { type: "string" },
            distanceMiles: { type: "number" },
            rating: { type: "number" },
            phone: { type: "string" },
            website: { type: "string" },
          },
        },
      },
      placeOfPerformance: {
        type: "object",
        properties: {
          address: { type: "string" },
          coordinates: {
            type: "object",
            properties: { lat: { type: "number" }, lng: { type: "number" } },
          },
        },
      },
      totalResults: { type: "number" },
    },
    required: ["businesses", "totalResults"],
  },
  annotations: {
    title: "Find partners nearby",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
} as const;

interface PartnersResponse {
  businesses: Array<{
    name?: string;
    formattedAddress?: string;
    distanceMiles?: number;
    rating?: number;
    phone?: string;
    website?: string;
  }>;
  placeOfPerformance?: { address?: string; coordinates?: { lat: number; lng: number } };
  totalResults: number;
}

export async function runFindPartnersNear(
  api: GovToolsProApiClient,
  args: Record<string, unknown>
): Promise<{
  content: Array<{ type: "text"; text: string }>;
  structuredContent: PartnersResponse;
}> {
  const keyword = typeof args.keyword === "string" ? args.keyword : "";
  const address = typeof args.address === "string" ? args.address : "";
  if (!keyword) throw new Error("keyword is required");
  if (!address) throw new Error("address is required");
  const body: Record<string, unknown> = { keyword, address };
  if (typeof args.radius === "number") body.radius = args.radius;

  const { data, disclaimer } = await api.post<PartnersResponse>("/find-partners-near", body);

  const lines = [
    `${data.totalResults} partner candidate(s) for "${keyword}" near ${address}:`,
    ...data.businesses.slice(0, 10).map((b, i) => {
      const dist = b.distanceMiles !== undefined ? `${b.distanceMiles.toFixed(1)} mi` : "?";
      const rating = b.rating !== undefined ? `★${b.rating}` : "";
      const contact = [b.phone, b.website].filter(Boolean).join(" · ");
      return `  ${i + 1}. ${b.name ?? "n/a"} (${dist}) ${rating}\n     ${b.formattedAddress ?? ""}${contact ? `\n     ${contact}` : ""}`;
    }),
    data.businesses.length > 10 ? `  … and ${data.businesses.length - 10} more in structuredContent.businesses` : null,
    disclaimer ? `\n${disclaimer}` : null,
  ].filter((s): s is string => s !== null);

  return {
    content: [{ type: "text", text: lines.join("\n") }],
    structuredContent: data,
  };
}
