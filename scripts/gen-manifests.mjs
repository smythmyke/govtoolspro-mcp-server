// Generate manifest.json (lean, for `mcpb pack`) and manifest-rich-tools.json
// (tools array WITH inputSchema, for the post-pack Smithery patch) by asking
// the built server for its own tool list — so the schemas never drift from the
// source. Re-run after any tool change or version bump:
//
//   GOVTOOLSPRO_API_KEY=gtp_test_... npm run gen:manifests
//
// (Any key value works — tools/list is a protocol call that doesn't hit the API.)
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { writeFileSync, readFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const serverPath = join(root, "dist", "index.js");

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const VERSION = pkg.version;

// Static manifest metadata (everything except the tools array, which is
// injected from tools/list below). Mirrors the portfolio's MCPB manifest shape.
const MANIFEST = {
  manifest_version: "0.3",
  name: "govtoolspro-mcp-server",
  display_name: "GovToolsPro MCP Server",
  version: VERSION,
  description:
    "MCP server for GovToolsPro — go/no-go scoring, incumbent intelligence, teaming-partner search, recompete prediction, Navy NECO lookup, and SAM.gov solicitation retrieval for federal contractors.",
  long_description:
    "MCP (Model Context Protocol) server for **GovToolsPro** — workflow tools for federal contractors. Not raw data access, but decisions: go/no-go scoring, incumbent intelligence, teaming-partner search, recompete prediction, Navy NECO lookup, and SAM.gov solicitation retrieval.\n\nWorks in Claude Code, Claude Desktop, Cursor, Cline, Zed, and any other MCP-compatible client.\n\n## Tools (7)\n\n- **balance** — credit balance + subscription status. Free.\n- **get_solicitation** — notice ID (or solicitation number) → structured SAM.gov fields (NAICS, PSC, set-aside, place of performance, deadline, contacts, attachment links). The workflow entry point. Free.\n- **score_go_no_go** — score a solicitation GO / NO-GO (0–100) against a company profile, with hard-blocker detection (CMMC, geographic, set-aside). Free.\n- **find_incumbents** — identify the current incumbent via USAspending + FPDS, with competition signals and anticipated next-award date. Free.\n- **find_partners_near** — rank nearby teaming partners / subcontractors by proximity for a place of performance. Free.\n- **predict_recompete** — discover expiring contracts (recompete opportunities) by NAICS/PSC/state/value, enriched with option-exercise signals. Free.\n- **lookup_neco_data** — parse a Navy NECO (neco.navy.mil) solicitation into structured fields. Free.\n\nEvery tool returns decision-support output with a disclaimer — verify against the official solicitation before relying on results. Requires an API key minted from the GovToolsPro Chrome extension's Admin tab.",
  author: {
    name: "Michael Smyth",
    url: "https://github.com/smythmyke",
  },
  repository: {
    type: "git",
    url: "https://github.com/smythmyke/govtoolspro-mcp-server",
  },
  homepage: "https://github.com/smythmyke/govtoolspro-mcp-server",
  documentation: "https://github.com/smythmyke/govtoolspro-mcp-server#readme",
  support: "https://github.com/smythmyke/govtoolspro-mcp-server/issues",
  icon: "icon.png",
  keywords: pkg.keywords,
  license: "MIT",
  compatibility: {
    runtimes: { node: ">=18.0.0" },
    platforms: ["darwin", "win32", "linux"],
  },
  server: {
    type: "node",
    entry_point: "dist/index.js",
    mcp_config: {
      command: "node",
      args: ["${__dirname}/dist/index.js"],
      env: {
        GOVTOOLSPRO_API_KEY: "${user_config.GOVTOOLSPRO_API_KEY}",
        GOVTOOLSPRO_API_BASE: "${user_config.GOVTOOLSPRO_API_BASE}",
      },
    },
  },
  user_config: {
    GOVTOOLSPRO_API_KEY: {
      type: "string",
      title: "GovToolsPro API Key",
      description:
        "API key minted from the GovToolsPro Chrome extension's Admin tab. Format: gtp_live_... or gtp_test_...",
      sensitive: true,
      required: true,
    },
    GOVTOOLSPRO_API_BASE: {
      type: "string",
      title: "API Base URL (optional)",
      description:
        "Override the API base URL. Default: https://mcp.govtoolspro.com/api/v1/workflows",
      default: "https://mcp.govtoolspro.com/api/v1/workflows",
      required: false,
    },
  },
  tools: [], // injected below
};

function listToolsFromServer() {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [serverPath], {
      env: { ...process.env, GOVTOOLSPRO_API_KEY: process.env.GOVTOOLSPRO_API_KEY || "gtp_test_placeholder" },
      stdio: ["pipe", "pipe", "pipe"],
    });
    const responses = new Map();
    let buffer = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Timeout waiting for tools/list"));
    }, 30000);

    child.stdout.on("data", (chunk) => {
      buffer += chunk.toString();
      let nl;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.id !== undefined) responses.set(msg.id, msg);
        } catch {
          /* ignore non-JSON */
        }
      }
      if (responses.has(2)) {
        clearTimeout(timer);
        const tools = responses.get(2).result?.tools ?? [];
        child.kill();
        resolve(tools);
      }
    });
    child.stderr.on("data", () => {});
    child.on("error", reject);

    const send = (obj) => child.stdin.write(JSON.stringify(obj) + "\n");
    send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "gen-manifests", version: "0.0.1" } },
    });
    send({ jsonrpc: "2.0", method: "notifications/initialized" });
    send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  });
}

const tools = await listToolsFromServer();
if (!tools.length) throw new Error("Server returned no tools");

// Lean manifest tools = { name, description }
MANIFEST.tools = tools.map((t) => ({ name: t.name, description: t.description }));
writeFileSync(join(root, "manifest.json"), JSON.stringify(MANIFEST, null, 2) + "\n");

// Rich tools = bare array with inputSchema (Smithery requires inputSchema;
// mcpb pack strips it, so it's injected into the bundle post-pack).
const rich = tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }));
writeFileSync(join(root, "manifest-rich-tools.json"), JSON.stringify(rich, null, 2) + "\n");

console.log(`✓ Wrote manifest.json + manifest-rich-tools.json (${tools.length} tools, v${VERSION})`);
console.log(`  tools: ${tools.map((t) => t.name).join(", ")}`);
