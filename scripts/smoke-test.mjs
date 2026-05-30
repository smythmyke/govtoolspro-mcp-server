// Smoke test the MCP server end-to-end via stdio JSON-RPC.
// Spawns dist/index.js, sends initialize → list → call balance → call
// get_solicitation, prints responses. Requires a real GOVTOOLSPRO_API_KEY.
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPath = join(__dirname, "..", "dist", "index.js");

const API_KEY = process.env.GOVTOOLSPRO_API_KEY || "";
if (!API_KEY) {
  console.error("GOVTOOLSPRO_API_KEY env var required");
  process.exit(1);
}

const child = spawn("node", [serverPath], {
  env: {
    ...process.env,
    GOVTOOLSPRO_API_KEY: API_KEY,
    ...(process.env.GOVTOOLSPRO_API_BASE ? { GOVTOOLSPRO_API_BASE: process.env.GOVTOOLSPRO_API_BASE } : {}),
  },
  stdio: ["pipe", "pipe", "pipe"],
});

const responses = new Map();
let buffer = "";

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
      // ignore non-JSON noise
    }
  }
});

child.stderr.on("data", (chunk) => {
  process.stderr.write("[server stderr] " + chunk.toString());
});

function send(obj) {
  child.stdin.write(JSON.stringify(obj) + "\n");
}

async function waitFor(id, label, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (responses.has(id)) return responses.get(id);
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Timeout waiting for ${label} (id=${id})`);
}

(async () => {
  send({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "smoke-test", version: "0.0.1" },
    },
  });
  const init = await waitFor(1, "initialize");
  console.log("✓ initialize:", init.result?.serverInfo);

  send({ jsonrpc: "2.0", method: "notifications/initialized" });

  send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  const tools = await waitFor(2, "tools/list");
  console.log(
    `✓ tools/list: ${tools.result?.tools?.length} tools — ${tools.result?.tools?.map((t) => t.name).join(", ")}`
  );

  send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "balance", arguments: {} } });
  const bal = await waitFor(3, "tools/call balance");
  if (bal.result?.isError) console.error("✗ balance ERROR:", bal.result.content?.[0]?.text);
  else console.log("✓ balance:", bal.result?.content?.[0]?.text?.slice(0, 200));

  // get_solicitation — free, keyless upstream (deterministic)
  send({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: { name: "get_solicitation", arguments: { noticeId: "2eb207e5f4724fe09232aa4ce2f298cd" } },
  });
  const sol = await waitFor(4, "tools/call get_solicitation");
  if (sol.result?.isError) console.error("✗ get_solicitation ERROR:", sol.result.content?.[0]?.text);
  else console.log("✓ get_solicitation:", sol.result?.content?.[0]?.text?.slice(0, 300));

  child.kill();
  process.exit(0);
})().catch((err) => {
  console.error("Test failed:", err);
  child.kill();
  process.exit(1);
});
