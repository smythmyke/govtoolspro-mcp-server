#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { GovToolsProApiClient, GovToolsProApiError } from "./api/client.js";
import { balanceTool, runBalance } from "./tools/balance.js";
import { getSolicitationTool, runGetSolicitation } from "./tools/getSolicitation.js";
import { scoreGoNoGoTool, runScoreGoNoGo } from "./tools/scoreGoNoGo.js";
import { findIncumbentsTool, runFindIncumbents } from "./tools/findIncumbents.js";
import { findPartnersNearTool, runFindPartnersNear } from "./tools/findPartnersNear.js";
import { predictRecompeteTool, runPredictRecompete } from "./tools/predictRecompete.js";
import { lookupNecoDataTool, runLookupNecoData } from "./tools/lookupNecoData.js";

const SERVER_NAME = "govtoolspro";
const SERVER_VERSION = "0.1.1";

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

  const tools: Tool[] = [
    balanceTool as unknown as Tool,
    getSolicitationTool as unknown as Tool,
    scoreGoNoGoTool as unknown as Tool,
    findIncumbentsTool as unknown as Tool,
    findPartnersNearTool as unknown as Tool,
    predictRecompeteTool as unknown as Tool,
    lookupNecoDataTool as unknown as Tool,
  ];

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      switch (name) {
        case balanceTool.name:           return await runBalance(api);
        case getSolicitationTool.name:   return await runGetSolicitation(api, args ?? {});
        case scoreGoNoGoTool.name:       return await runScoreGoNoGo(api, args ?? {});
        case findIncumbentsTool.name:    return await runFindIncumbents(api, args ?? {});
        case findPartnersNearTool.name:  return await runFindPartnersNear(api, args ?? {});
        case predictRecompeteTool.name:  return await runPredictRecompete(api, args ?? {});
        case lookupNecoDataTool.name:    return await runLookupNecoData(api, args ?? {});
        default:
          return errorResult(`Unknown tool: ${name}`);
      }
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
