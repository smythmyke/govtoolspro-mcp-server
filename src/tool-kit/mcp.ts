// MCP adapter: turns a canonical ToolDef into the two things the MCP server
// needs — a `tools/list` descriptor and a `tools/call` result.

import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";
import type { ApiTransport, ToolDef } from "./types.js";

/** Build the `tools/list` descriptor for a ToolDef. */
export function toMcpTool(def: ToolDef): Tool {
  return {
    name: def.name,
    description: def.description,
    inputSchema: def.inputSchema,
    outputSchema: def.outputSchema,
    annotations: def.annotations,
  } as unknown as Tool;
}

/** Execute a ToolDef and shape its output as an MCP `tools/call` result. */
export async function runTool(
  def: ToolDef<Record<string, unknown>, unknown>,
  ctx: ApiTransport,
  args: Record<string, unknown>
): Promise<CallToolResult> {
  const { data, disclaimer } = await def.run(ctx, args);
  return {
    content: [{ type: "text", text: def.toText(data, disclaimer, args) }],
    structuredContent: data as Record<string, unknown>,
  };
}
