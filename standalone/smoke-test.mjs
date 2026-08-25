/**
 * Handshake test — starts the server, runs initialize + tools/list + ping,
 * and checks every tool advertises a name, a description and an input schema.
 * No API key needed: nothing here calls the network.
 *
 *   node smoke-test.mjs
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const server = fileURLToPath(new URL("./server.mjs", import.meta.url));
const child = spawn(process.execPath, [server], { stdio: ["pipe", "pipe", "inherit"] });

const requests = [
  { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "smoke-test", version: "1" } } },
  { jsonrpc: "2.0", method: "notifications/initialized" },
  { jsonrpc: "2.0", id: 2, method: "tools/list" },
  { jsonrpc: "2.0", id: 3, method: "ping" },
];
child.stdin.write(requests.map((r) => JSON.stringify(r)).join("\n") + "\n");
child.stdin.end();

let out = "";
child.stdout.on("data", (chunk) => (out += chunk));

child.on("close", () => {
  const replies = out.split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const byId = new Map(replies.map((r) => [r.id, r]));
  const problems = [];

  const init = byId.get(1)?.result;
  if (!init?.serverInfo?.name) problems.push("initialize did not return serverInfo");
  if (!init?.capabilities?.tools) problems.push("initialize did not advertise tool capability");
  if (!byId.get(3)) problems.push("ping was not answered");

  const tools = byId.get(2)?.result?.tools ?? [];
  if (!tools.length) problems.push("tools/list returned nothing");
  for (const tool of tools) {
    if (!tool.name) problems.push("a tool has no name");
    if (!tool.description || tool.description.length < 40) problems.push(`${tool.name}: thin description`);
    if (tool.inputSchema?.type !== "object") problems.push(`${tool.name}: inputSchema is not an object schema`);
    for (const required of tool.inputSchema?.required ?? []) {
      if (!tool.inputSchema.properties?.[required]) {
        problems.push(`${tool.name}: required field '${required}' is not in properties`);
      }
    }
  }

  console.log(`${init?.serverInfo?.name} ${init?.serverInfo?.version} — ${tools.length} tools`);
  for (const tool of tools) console.log(`  ${tool.name}`);

  if (problems.length) {
    console.error("\nFAIL");
    for (const p of problems) console.error("  - " + p);
    process.exit(1);
  }
  console.log("\nok");
});
