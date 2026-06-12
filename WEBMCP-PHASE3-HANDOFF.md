# WebMCP Phase 3 Handoff — sellerdashboard

**Audience:** the Claude Code session working in the **sellerdashboard** repo (GovToolsPro web app).
**Source of truth for this work:** `govtoolspro-mcp-server` repo, branch `webmcp-tooldef-refactor`
(this file lives there at repo root). Phases 0–2 are done there; this is Phase 3+.

---

## 1. What we're building and why

**WebMCP** lets a web page expose "tools" to a **browser-resident agent** (Gemini-in-Chrome,
Perplexity Comet, agentic browsers) via `document.modelContext`. The agent calls
`getTools()` / `executeTool()` while the user is *on the page*, using the user's
**existing logged-in session** — no API-key minting, no separate install.

> Note: WebMCP is consumed by the **browser agent**, NOT by claude.ai / ChatGPT (those are
> server-MCP clients). This is a new, additional surface — it does not replace the existing
> MCP server distribution.

It's a **Chrome Origin Trial** (Chrome 149→156), experimental. Goal: **prototype, don't bet.**
Official docs:
- https://developer.chrome.com/docs/ai/webmcp
- https://developer.chrome.com/docs/ai/webmcp/imperative-api
- https://developer.chrome.com/docs/ai/webmcp/secure-tools

**The thesis being proven:** GovToolsPro tools are now defined **once** as canonical
`ToolDef`s (in the MCP-server repo) and can be emitted to **both** the MCP server *and*
WebMCP in-page tools. Phase 3 builds the WebMCP (browser) adapter in this dashboard repo.

---

## 2. The canonical contract (already built in the MCP-server repo)

In `govtoolspro-mcp-server/src/tool-kit/types.ts`:

```ts
export interface ApiResult<T> { data: T; disclaimer?: string; }

// Transport-agnostic backend contract. Server impl uses API key; the BROWSER
// impl (what YOU build) uses the user's session cookie.
export interface ApiTransport {
  post<T>(path: string, body: Record<string, unknown>): Promise<ApiResult<T>>;
  get<T>(path: string): Promise<ApiResult<T>>;
}

export interface ToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
  untrustedContentHint?: boolean; // set true for externally-sourced data
}

export interface ToolDef<Args = Record<string, unknown>, Data = unknown> {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;   // JSON Schema — feeds WebMCP verbatim
  outputSchema?: Record<string, unknown>;
  annotations?: ToolAnnotations;
  run(ctx: ApiTransport, args: Args): Promise<ApiResult<Data>>;
  // NOTE: toText takes args too — some summaries echo the input (keyword/naics).
  toText(data: Data, disclaimer: string | undefined, args: Args): string;
}
```

The WebMCP adapter (in the MCP-server repo, `src/tool-kit/mcp.ts` is the MCP equivalent
to copy the pattern from) turns a `ToolDef` into a `registerTool` call:

```ts
document.modelContext.registerTool({
  name: def.name,
  description: def.description,
  inputSchema: def.inputSchema,
  annotations: def.annotations,         // WebMCP reads readOnlyHint + untrustedContentHint
  execute: async (args) => {
    const { data, disclaimer } = await def.run(browserTransport, args);
    return def.toText(data, disclaimer, args);   // execute() returns a STRING
  },
}, { signal });                          // signal.abort() unregisters
```

Key differences vs MCP server:
- WebMCP `execute` returns a **plain string** (we use `toText`); MCP returns `{ content, structuredContent }`.
- `execute` runs **in the browser tab** → calls the backend with the **user's session**, not an API key.

---

## 3. The 10 tools, their backend paths, and the response envelope

Every endpoint returns `{ data, disclaimer? }`. Base path on the server build is
`https://mcp.govtoolspro.com/api/v1/workflows` with `X-API-Key` auth. **For the browser,
you call the same logical endpoints but with the user's session/Firebase auth** (use the
dashboard's existing API-call mechanism — see §4).

| Tool name | Method | Path | Notes |
|---|---|---|---|
| `balance` | GET | `/balance` | free; simplest pilot tool |
| `get_solicitation` | POST | `/get-solicitation` | **untrustedContentHint: true** (external SAM.gov text) |
| `score_go_no_go` | POST | `/score-go-no-go` | free, deterministic |
| `find_incumbents` | POST | `/find-incumbents` | free |
| `find_partners_near` | POST | `/find-partners-near` | **untrustedContentHint: true** (Google Places); summary echoes `keyword`/`address` args |
| `predict_recompete` | POST | `/predict-recompete` | free |
| `lookup_neco_data` | POST | `/lookup-neco-data` | **untrustedContentHint: true** (scraped neco.navy.mil) |
| `lookup_labor_rates` | POST | `/lookup-labor-rates` | free |
| `analyze_award_patterns` | POST | `/analyze-award-patterns` | 3 credits; summary echoes `naicsCode` |
| `analyze_market` | POST | `/analyze-market` | 5 credits; summary echoes `naicsCode` |

**Pilot uses 3 read-only tools only:** `balance`, `score_go_no_go`, `analyze_market`.
All 10 tools are `readOnlyHint: true`, `destructiveHint: false` — so **no human-in-the-loop
confirmation flow is needed** for the pilot.

---

## 4. What to build in sellerdashboard (Phase 3)

### 4a. `BrowserTransport` — implements `ApiTransport` using the user's session

Attach the user's **Firebase ID token** as a Bearer header (the dashboard already holds it).
This avoids cookies/CSRF and keeps CORS simple — see `WEBMCP-BACKEND-BRIEF.md` §3a.

```ts
// Reuse the dashboard's Firebase user; send its ID token as a Bearer header.
export class BrowserTransport /* implements ApiTransport */ {
  constructor(private baseUrl: string, private getIdToken: () => Promise<string>) {}
  private async req(method: string, path: string, body?: unknown) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await this.getIdToken()}`,   // <-- session, not X-API-Key
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const parsed = await res.json();
    if (!res.ok) throw new Error(parsed?.error?.message ?? `HTTP ${res.status}`);
    return { data: parsed.data ?? parsed, disclaimer: parsed.disclaimer };
  }
  post(path: string, body: Record<string, unknown>) { return this.req('POST', path, body); }
  get(path: string) { return this.req('GET', path); }
}
```
⚠️ **Backend dependency — verify first:** the workflow endpoints currently accept `X-API-Key`
only. They must be changed to also accept the Firebase ID token and to allow the dashboard
origin via CORS. **That backend change is the gating dependency** and is specced for the
backend session in `WEBMCP-BACKEND-BRIEF.md`. The dashboard adapter can't be exercised until
it lands.

### 4b. WebMCP adapter — register ToolDefs

```ts
export function registerWebMcpTools(defs, transport, signal) {
  if (!('modelContext' in document)) return;        // not in a WebMCP browser
  for (const def of defs) {
    document.modelContext.registerTool({
      name: def.name,
      description: def.description,
      inputSchema: def.inputSchema,
      annotations: def.annotations,
      execute: async (args) => {
        const { data, disclaimer } = await def.run(transport, args);
        return def.toText(data, disclaimer, args);
      },
    }, { signal });
  }
}
```

### 4c. Origin-trial token + feature flag
- Register the OT at https://developer.chrome.com/origintrials and add the token as
  `<meta http-equiv="origin-trial" content="…">` on the pilot page.
- Gate `registerWebMcpTools(...)` behind a feature flag (`?webmcp=1` or a user allowlist)
  so it's invisible to normal users.

---

## 5. Where the shared `ToolDef`s live — OPEN DECISION (resolve before coding 4b)

The dashboard needs the actual `ToolDef` objects (with `run`/`toText`). They currently live
in `govtoolspro-mcp-server/src/tools/*.ts` + `src/tool-kit/`. Options:

- **A. Publish `@govtoolspro/tool-kit`** (npm) from the MCP-server repo; dashboard imports it.
  Cleanest long-term, single source of truth. More setup.
- **B. Copy/symlink** the `tool-kit` + `tools` source into the dashboard as a vendored module.
  Fastest to pilot; risk of drift.

**Recommendation:** for the pilot, **B** (copy the 3 pilot tools' defs + `tool-kit/types.ts`),
then graduate to **A** in Phase 5 if the pilot proves out. Note that `run` imports nothing
MCP/DOM-specific, so the defs are portable as-is; only the *transport* differs.

---

## 6. Phase 4 — the pilot (success criterion)

On ONE dashboard page (e.g. solicitation detail), behind flag + OT token, register
`balance` + `score_go_no_go` + `analyze_market`. Open the page logged in, in Gemini-in-Chrome
or Comet, and ask the sidebar agent in plain English. **Success = a logged-in user gets a
correct GovToolsPro answer from the browser agent, using defs that came from the MCP-server repo.**

Things to learn: does the agent pick the right tool from the description? does session auth /
CORS Just Work? latency? does it feel useful mid-task?

---

## 7. First three concrete steps for the dashboard session

1. **Verify the auth/CORS caveat (§4a):** can the workflow endpoints be called from the
   dashboard origin with the user's session + credentials? If not, scope the backend change first.
2. **Vendor the 3 pilot ToolDefs + `tool-kit/types.ts`** (decision B) into the dashboard.
3. **Write `BrowserTransport` + `registerWebMcpTools`**, wire onto one page behind a flag,
   add the OT `<meta>` token, and pilot with a browser agent.
