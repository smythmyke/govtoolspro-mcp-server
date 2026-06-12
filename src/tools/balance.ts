import type { ApiTransport, ToolDef } from "../tool-kit/types.js";

interface BalanceResponse {
  balance: number;
  subscriptionCredits?: number;
  topupCredits?: number;
  totalUsed?: number;
  totalPurchased?: number;
  subscription?: { planId?: string; status?: string } | null;
}

export const balanceDef: ToolDef<Record<string, unknown>, BalanceResponse> = {
  name: "balance",
  description:
    "Return the current GovToolsPro credit balance and subscription status for the authenticated account. " +
    "Free — exercises auth end-to-end. The extension and the API draw from the same shared credit pool.",
  inputSchema: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      balance: { type: "number", description: "Current total credit balance." },
      subscriptionCredits: { type: "number", description: "Credits from the active subscription." },
      topupCredits: { type: "number", description: "Credits purchased as one-off top-ups." },
      totalUsed: { type: "number", description: "Lifetime credits consumed." },
      totalPurchased: { type: "number", description: "Lifetime credits purchased." },
      subscription: {
        type: ["object", "null"],
        description: "Active subscription, or null if none.",
        properties: { planId: { type: "string" }, status: { type: "string" } },
      },
    },
    required: ["balance"],
  },
  annotations: {
    title: "Credit balance",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },

  async run(ctx: ApiTransport) {
    return ctx.get<BalanceResponse>("/balance");
  },

  toText(data, disclaimer) {
    const lines = [
      `Credit balance: ${data.balance}`,
      data.subscriptionCredits !== undefined ? `  • Subscription credits: ${data.subscriptionCredits}` : null,
      data.topupCredits !== undefined ? `  • Top-up credits: ${data.topupCredits}` : null,
      data.totalUsed !== undefined ? `Total used: ${data.totalUsed}` : null,
      data.subscription
        ? `Subscription: ${data.subscription.planId ?? "unknown"} (${data.subscription.status ?? "unknown"})`
        : "Subscription: none",
      disclaimer ? `\n${disclaimer}` : null,
    ].filter((s): s is string => s !== null);
    return lines.join("\n");
  },
};
