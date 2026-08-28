/**
 * Start the built server over stdio and check what it actually advertises.
 *
 * This exists because two real regressions got past a plain `tsc`: the tools
 * shipped with no annotations at all, and the version literal in the source
 * drifted from package.json, so a published bundle announced a version its
 * manifest disagreed with. Both are invisible to a typecheck and obvious here.
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

const expected = JSON.parse(readFileSync("package.json", "utf8")).version;

const child = spawn("node", ["dist/index.js"], { stdio: ["pipe", "pipe", "inherit"] });
const send = (o) => child.stdin.write(JSON.stringify(o) + "\n");

send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "ci", version: "1" } } });
send({ jsonrpc: "2.0", method: "notifications/initialized" });
send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });

let buf = "";
const seen = {};
child.stdout.on("data", (d) => {
  buf += d;
  const lines = buf.split("\n");
  buf = lines.pop();
  for (const line of lines) {
    if (!line.trim()) continue;
    const msg = JSON.parse(line);
    if (msg.id === 1) seen.info = msg.result.serverInfo;
    if (msg.id === 2) seen.tools = msg.result.tools;
  }
  if (seen.info && seen.tools) finish();
});

setTimeout(() => fail("the server did not answer within 20s"), 20_000).unref();

function fail(why) {
  console.error(`smoke: ${why}`);
  child.kill();
  process.exit(1);
}

function finish() {
  child.kill();
  const { info, tools } = seen;

  if (info.version !== expected) {
    fail(`server announces ${info.version}, package.json says ${expected} — run \`npm run build\``);
  }
  if (!tools.length) fail("no tools registered");

  // The directories require a title plus one of the two behaviour hints on
  // every tool; a tool missing them is rejected at submission, not at runtime.
  const bare = tools.filter((t) => {
    const a = t.annotations || {};
    return !a.title || typeof a.readOnlyHint !== "boolean";
  });
  if (bare.length) {
    fail(`missing title/readOnlyHint on: ${bare.map((t) => t.name).join(", ")}`);
  }

  const writes = tools.filter((t) => t.annotations.readOnlyHint === false);
  console.log(`smoke: ${info.name} v${info.version} — ${tools.length} tools, ${tools.length - writes.length} read-only, ${writes.length} write`);
}
