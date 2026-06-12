// Keyless protocol test for CI — no GOVTOOLSPRO_API_KEY or network required.
// Spawns dist/index.js with a placeholder key and asserts the server completes
// the MCP handshake (initialize) and advertises its tools (tools/list). These
// protocol-level requests succeed without valid auth; actual tool calls (which
// hit the GovToolsPro backend) are covered by `npm run smoke` with a real key.
//
// Exits 0 on success, 1 on any failure — wired into the CI workflow.
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPath = join(__dirname, "..", "dist", "index.js");

const EXPECTED_TOOL_COUNT = 10;
const REQUIRED_TOOLS = ["balance", "get_solicitation", "score_go_no_go"];

const child = spawn("node", [serverPath], {
  env: { ...process.env, GOVTOOLSPRO_API_KEY: "placeholder-for-ci-validation" },
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

async function waitFor(id, label, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (responses.has(id)) return responses.get(id);
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Timeout waiting for ${label} (id=${id})`);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

(async () => {
  send({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "protocol-test", version: "0.0.1" },
    },
  });
  const init = await waitFor(1, "initialize");
  assert(init.result?.serverInfo?.name, "initialize did not return serverInfo.name");
  console.log("✓ initialize:", init.result.serverInfo);

  send({ jsonrpc: "2.0", method: "notifications/initialized" });

  send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  const tools = await waitFor(2, "tools/list");
  const names = (tools.result?.tools ?? []).map((t) => t.name);
  assert(
    names.length === EXPECTED_TOOL_COUNT,
    `expected ${EXPECTED_TOOL_COUNT} tools, got ${names.length}: ${names.join(", ")}`
  );
  for (const t of REQUIRED_TOOLS) {
    assert(names.includes(t), `missing required tool: ${t}`);
  }
  console.log(`✓ tools/list: ${names.length} tools — ${names.join(", ")}`);

  console.log("✓ protocol test passed");
  child.kill();
  process.exit(0);
})().catch((err) => {
  console.error("✗ protocol test failed:", err.message);
  child.kill();
  process.exit(1);
});
