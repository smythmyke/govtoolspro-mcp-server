// Reusable, product- and surface-agnostic tool contract.
//
// A ToolDef is the single source of truth for one tool. Thin adapters emit a
// concrete surface from it: an MCP server tool (./mcp.ts, used by this repo) or
// a WebMCP in-page tool (browser build). Nothing here imports the MCP SDK or
// touches the DOM, so the same definitions can be reused across products.

/** Every GovToolsPro workflow endpoint returns { data, disclaimer? }. */
export interface ApiResult<T> {
  data: T;
  disclaimer?: string;
}

/**
 * Transport-agnostic contract a tool's `run` depends on, so the same tool
 * logic works against any backend client. Server-side, `GovToolsProApiClient`
 * implements this with API-key auth; a browser (WebMCP) build can supply a
 * session-cookie fetch wrapper that implements the same shape.
 */
export interface ApiTransport {
  post<T>(path: string, body: Record<string, unknown>): Promise<ApiResult<T>>;
  get<T>(path: string): Promise<ApiResult<T>>;
}

/**
 * MCP/WebMCP tool annotations (a shared spec). The MCP adapter forwards all of
 * these; the WebMCP runtime currently reads `readOnlyHint` and
 * `untrustedContentHint`.
 */
export interface ToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
  /** Set true when the tool returns externally sourced / user-generated data. */
  untrustedContentHint?: boolean;
}

/**
 * Canonical tool definition. `run` performs the work against any transport and
 * returns raw data; `toText` renders that data as the human-facing summary.
 * Surface adapters combine the two (e.g. MCP wraps them as
 * `{ content, structuredContent }`; WebMCP's `execute` returns `toText(...)`).
 */
export interface ToolDef<Args = Record<string, unknown>, Data = unknown> {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  annotations?: ToolAnnotations;
  run(ctx: ApiTransport, args: Args): Promise<ApiResult<Data>>;
  /**
   * Render the raw data as the human-facing summary. Receives the original
   * `args` too, since some summaries echo the query (e.g. the NAICS searched).
   */
  toText(data: Data, disclaimer: string | undefined, args: Args): string;
}
