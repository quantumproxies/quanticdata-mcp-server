# QuanticData MCP server — give Claude, Cursor and any MCP client live web access

A single-file, **zero-dependency** MCP server that puts the
[QuanticData](https://quanticdata.io) Data APIs in front of an AI agent: scrape a page, run a
Google/Bing/DuckDuckGo/Yandex search, map or crawl a site, audit a URL for SEO, and run any of
the **31 ready-made [Collectors](https://quanticdata.io/collectors/)** with a semantic input.

No SDK, no build step, no `node_modules`. Node.js 18+ and one file.

```bash
git clone https://github.com/quantumproxies/quanticdata-mcp-server
cd quanticdata-mcp-server
QUANTICDATA_API_KEY=qd_live_your_key_here node server.mjs
```

Get a key at [app.quanticdata.io](https://app.quanticdata.io/register) — there is a free monthly
allowance and no card is required; see the [pricing on quanticdata.io](https://quanticdata.io/docs/)
for the current figure.

## Install it in your client

**Claude Code**

```bash
claude mcp add quanticdata \
  -e QUANTICDATA_API_KEY=qd_live_your_key_here \
  -- node /absolute/path/to/quanticdata-mcp-server/server.mjs
```

**Claude Desktop** — `claude_desktop_config.json`

```json
{
  "mcpServers": {
    "quanticdata": {
      "command": "node",
      "args": ["/absolute/path/to/quanticdata-mcp-server/server.mjs"],
      "env": { "QUANTICDATA_API_KEY": "qd_live_your_key_here" }
    }
  }
}
```

**Cursor** — `.cursor/mcp.json`, same shape as above.

Any client that speaks stdio MCP works: the server implements `initialize`, `tools/list`,
`tools/call` and `ping`, which is the complete surface for a tools-only server.

## Tools

| Tool | What the agent gets | Price |
|---|---|---|
| `scrape` | one URL → Markdown / HTML / text, CSS or AI extraction, optional render | $0.0002 |
| `search` | organic results + related searches, 4 engines, 18 verticals | from $0.0005 |
| `map` | every URL of a site from sitemaps + homepage links, with totals | $0.0005 |
| `crawl` / `crawl_status` | async BFS crawl → Markdown per page | $0.0003/page |
| `seo_audit` | no-JS vs rendered view of a URL, diffed, plus bot-facing meta | $0.0012 |
| `list_collectors` | the catalogue: schemas, examples, health, your unit price | free |
| `run_collector` | run one Collector on a semantic input | from $0.0004/row |
| `collector_run_status` | one run and its delivered rows | free |

Everything is pay-per-success: a call that fails costs nothing.

## Try it without a client

```bash
node smoke-test.mjs           # handshake + tools/list, no API key needed
```

Or drive it by hand — it is newline-delimited JSON-RPC on stdin:

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"cli","version":"1"}}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  | node server.mjs
```

## Prompts that work well

- *"Map quanticdata.io, then scrape the five most recent blog posts and summarise the themes."*
- *"Search for `serp api pricing` in the US and Germany and tell me how the top ten differ."*
- *"Run an SEO audit on our pricing page — is it indexable without JavaScript?"*
- *"Use `list_collectors`, then pull 40 dental clinics in Austin with `local_business_leads`."*

The last one is the pattern worth internalising: let the agent read the catalogue first, then
pick the collector. The schemas are published precisely so a model can choose correctly.

## Configuration

| Variable | Default | Notes |
|---|---|---|
| `QUANTICDATA_API_KEY` | — | required; keys look like `qd_live_…` |
| `QUANTICDATA_API_BASE` | `https://api.quanticdata.io/v1` | point it elsewhere for a proxy or a staging host |

Errors from the API come back as tool results with `isError: true` rather than protocol errors,
so the model can read the message and correct itself instead of the conversation dying.

## Related

- [MCP server page](https://quanticdata.io/mcp-server/) · [Documentation](https://quanticdata.io/docs/)
- [How MCP servers work](https://quanticdata.io/blog/how-mcp-servers-work/) · [Is an MCP server like an API?](https://quanticdata.io/blog/is-mcp-server-like-an-api/)
- [How to create an MCP server](https://quanticdata.io/blog/how-to-create-an-mcp-server/) · [How to use MCP in Cursor](https://quanticdata.io/blog/how-to-use-mcp-in-cursor/)
- [Web Data API for AI](https://quanticdata.io/web-data-api-for-ai/) · [Browser AI agents](https://quanticdata.io/browser-ai/)

MIT licensed.
