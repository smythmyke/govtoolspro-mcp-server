#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { GovToolsProApiClient, GovToolsProApiError } from "./api/client.js";
import { toMcpTool, runTool } from "./tool-kit/mcp.js";
import type { ToolDef } from "./tool-kit/types.js";
import { balanceDef } from "./tools/balance.js";
import { getSolicitationDef } from "./tools/getSolicitation.js";
import { scoreGoNoGoDef } from "./tools/scoreGoNoGo.js";
import { findIncumbentsDef } from "./tools/findIncumbents.js";
import { findPartnersNearDef } from "./tools/findPartnersNear.js";
import { predictRecompeteDef } from "./tools/predictRecompete.js";
import { lookupNecoDataDef } from "./tools/lookupNecoData.js";
import { lookupLaborRatesDef } from "./tools/lookupLaborRates.js";
import { analyzeAwardPatternsDef } from "./tools/analyzeAwardPatterns.js";
import { analyzeMarketDef } from "./tools/analyzeMarket.js";

const SERVER_NAME = "govtoolspro";
const SERVER_VERSION = "0.1.4";

async function main(): Promise<void> {
  // Lazy config: don't require the API key at startup, so `tools/list` works
  // without credentials (better client UX + lets registries scan tools). A
  // missing/invalid key surfaces as a clear error only when a tool is called.
  const apiKey = process.env.GOVTOOLSPRO_API_KEY ?? "";
  const baseUrl = process.env.GOVTOOLSPRO_API_BASE;

  const api = new GovToolsProApiClient({ apiKey, baseUrl });

  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } }
  );

  // Single source of truth: every tool is a canonical ToolDef. The MCP adapter
  // emits the `tools/list` descriptors and runs `tools/call`. (The same defs
  // can be re-registered as WebMCP in-page tools from a browser build.)
  const registry: ToolDef[] = [
    balanceDef,
    getSolicitationDef,
    scoreGoNoGoDef,
    findIncumbentsDef,
    findPartnersNearDef,
    predictRecompeteDef,
    lookupNecoDataDef,
    lookupLaborRatesDef,
    analyzeAwardPatternsDef,
    analyzeMarketDef,
  ];
  const registryByName = new Map(registry.map((d) => [d.name, d] as const));

  const tools: Tool[] = registry.map(toMcpTool);

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      const def = registryByName.get(name);
      if (def) return await runTool(def, api, args ?? {});
      return errorResult(`Unknown tool: ${name}`);
    } catch (err) {
      if (err instanceof GovToolsProApiError) {
        return errorResult(err.message);
      }
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(message);
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function errorResult(message: string): {
  isError: true;
  content: Array<{ type: "text"; text: string }>;
} {
  return {
    isError: true,
    content: [{ type: "text", text: message }],
  };
}

main().catch((err) => {
  process.stderr.write(
    `[govtoolspro-mcp] Fatal: ${err instanceof Error ? err.message : String(err)}\n`
  );
  process.exit(1);
});
