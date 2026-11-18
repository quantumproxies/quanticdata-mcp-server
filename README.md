# QuanticData MCP Server

Connect [QuanticData](https://quanticdata.io) to Claude, Cursor, and any
MCP client. Gives an AI agent live web access — scrape, search, map, and crawl —
through residential proxies with real-browser TLS fingerprints, so pages that
block ordinary bots come back clean. It also hands the agent raw proxy
endpoints of every type (residential, mobile, datacenter, ISP, IPv6) from your
active plans, ready to plug into any HTTP client.

It calls the **public** QuanticData Scraper API with your own `qd_live_` key,
so there are no internal secrets and you run it locally.

<!-- mcp-docs:tools:start -->
## Tools

29 tools, the names and parameters the package registers (`tools/list`). Long jobs return an id and a `*_status` tool polls it.

| Group | Tool | What it does |
|-------|------|--------------|
| Scrape | `scrape` | One URL to clean Markdown, HTML or text (PDF and Office documents too) through a residential IP with a real-browser TLS fingerprint. Optional CSS, preset or AI extraction, `mode: summary`, browser actions. |
| Search | `search` | Structured Google, Bing or DuckDuckGo results across 17 verticals (web, images, news, shopping, maps, jobs, flights, hotels, lens and more). `render: true` adds AI Overview, People Also Ask and Knowledge Graph. |
|  | `search_and_read` | Search, fetch the top organic pages as clean Markdown and return numbered citation-ready sources plus one token-bounded `context` string for the prompt. |
|  | `search_bulk` | Async multi-page SERP pagination with merged organic results and page-one AI and zero-click enrichments. Returns a job id. |
|  | `search_bulk_status` | Poll a bulk search job; `since` returns only the pages collected after the previous poll. |
| Map & Crawl | `map` | Fast URL discovery from sitemaps and homepage links, no full crawl: up to `limit` URLs plus a site-wide total and a per-section summary; `group_by: path` for the tree. |
|  | `crawl` | Start an async breadth-first crawl from a seed URL, every page converted to Markdown. Depth control, include and exclude globs. Returns a job id. |
|  | `crawl_status` | Poll a crawl job for progress and the pages gathered so far. The `since` cursor and `include_content` keep polls light. |
| Batch | `batch` | Scrape up to 1,000 URLs asynchronously with shared options; `mode: summary` for metadata-only items. Returns a job id. |
|  | `batch_status` | Poll a batch job incrementally with the `since` cursor; page content only with `include_content`. |
| Unlock | `unlock` | Web Unlocker: replay any HTTP request (method, headers, body) through a residential exit, retry on a fresh IP, escalate a blocked GET to a real browser. A still-blocked page comes back flagged, never as a silent 200. |
| AI visibility | `ai_visibility` | Can ChatGPT, Claude, Perplexity, Google AI Overview and Bing Copilot read and cite a page? On-page audit scored per pillar with blockers, evidence and fixes, plus an optional citation panel that asks the engines. |
| SEO | `seo_audit` | Fetch a URL as a no-JS bot and fully rendered, return both SEO views plus the diff (JS-only content, changed title or description, missing canonical) and bot-facing meta (robots, Open Graph, JSON-LD). |
| Collectors | `list_collectors` | Catalog of the ready-made Collectors (slug, category, price per delivered row, required input), or one collector's full schema and example with `slug`. |
|  | `run_collector` | Run a Collector by slug with a semantic input (keyword + location, place id, product id, domain) instead of URLs. Short runs return rows inline, long runs a `run_id`. |
|  | `collector_run_status` | Poll a collector run by `run_id`; rows as JSON or CSV, billed per delivered row only. |
| Datasets | `create_dataset` | Prompt-driven structured dataset collection with columns, sources, budget and row limits. Returns a job id. |
|  | `dataset_status` | Poll a dataset job: rows so far, cost, and signed CSV and JSON downloads when done. |
| Parser presets | `generate_parser` | Learn the CSS selectors of a page layout once with an LLM and get back a deterministic parser to reuse for free. |
|  | `save_parser_preset` | Store a generated parser as a named preset that `scrape` runs by `preset_id`, with optional self-healing. |
|  | `list_parser_presets` | List this account's parser presets with their ids. |
|  | `parser_preset_stats` | Health of one preset: success rate, recent runs, empty fields, whether it needs healing. |
|  | `heal_parser_preset` | Regenerate a preset's selectors after the site layout changed (`force` heals a healthy one). |
| Proxies | `list_proxies` | Your proxy services of every type (Residential Basic, Premium and Private, Mobile, Mobile V2, Datacenter, ISP, IPv6) with bandwidth left, expiry and the `orderId` used to generate. |
|  | `generate_proxies` | Ready-to-use proxy strings (credentials included) from any active plan: country, state, city, ISP or ASN targeting, rotating or sticky sessions, HTTP or SOCKS5, several output formats. |
|  | `proxy_locations` | Valid geo-targeting values per plan type: countries, states, cities, ASNs, or the full location tree with ISP codes. |
|  | `whitelist_ip` | Add, list or remove IP-auth whitelist entries for the plans that support it, including the Mobile V2 IP-auth proxy list. |
| Feedback | `report` | Send feedback to the team from inside the agent: a bug, a missing feature or collector, a question. Works **without an API key**. |
| Video | `read_video` | A YouTube video as one timeline: metadata, chapters, the transcript in the spoken language and small frames placed where they matter. |
<!-- mcp-docs:tools:end -->
## Quick start

No install needed — `npx` fetches [quanticdata-mcp](https://www.npmjs.com/package/quanticdata-mcp) on demand (Node.js 18+).

**Claude Code** (one command):

```bash
claude mcp add quanticdata \
  -e QUANTICDATA_API_KEY=qd_live_your_key_here \
  -- npx -y quanticdata-mcp
```

**Claude Desktop / Cursor / any MCP client** (`claude_desktop_config.json`, `.cursor/mcp.json`, or `.mcp.json`):

```json
{
  "mcpServers": {
    "quanticdata": {
      "command": "npx",
      "args": ["-y", "quanticdata-mcp"],
      "env": { "QUANTICDATA_API_KEY": "qd_live_your_key_here" }
    }
  }
}
```

## Hosted endpoint (remote MCP)

The same server also runs as a hosted **Streamable HTTP** endpoint, for clients
that prefer a URL over a local package:

```
https://api.quanticdata.io/mcp
```

### Connect with OAuth (no key to copy)

The endpoint supports the MCP authorization spec (OAuth 2.1). In a client that
supports it, add the URL above as a remote server and nothing else:

1. The client opens the QuanticData.io sign-in page.
2. You sign in (or create a free account) and click **Allow access**.
3. The client is connected. A key named `MCP · <client>` appears on the
   dashboard API keys page; delete it to disconnect the client.

Under the hood: authorization server metadata at
`https://app.quanticdata.io/.well-known/oauth-authorization-server`,
protected resource metadata at
`https://api.quanticdata.io/.well-known/oauth-protected-resource/mcp`,
dynamic client registration (RFC 7591) and Client ID Metadata Documents,
PKCE (S256) required, 1-hour access tokens with rotating refresh tokens, tokens
bound to this endpoint (RFC 8707). Usage is billed to your balance like any key.

### Or send your API key

Clients that take a bearer token can skip OAuth: the key travels per request in
the `Authorization` header (or `X-Api-Key`), nothing is stored server-side.

```bash
curl -X POST https://api.quanticdata.io/mcp \
  -H "Authorization: Bearer qd_live_your_key_here" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

A request with neither a token nor a key gets `401` with a
`WWW-Authenticate` header pointing at the metadata above: that is what makes
OAuth-capable clients start the sign-in.

Self-hosting the endpoint is a second binary in this same package. With
`QUANTICDATA_API_KEY` set it serves that one account to callers that send no
credential:

```bash
QUANTICDATA_API_KEY=qd_live_… PORT=9310 npx -y quanticdata-mcp-remote
```

## Run from source (development)

```bash
npm install
npm run build
```

Then point the client at the local build instead of npx:

```json
{
  "mcpServers": {
    "quanticdata": {
      "command": "node",
      "args": ["/absolute/path/to/scraper-mcp/dist/index.js"],
      "env": {
        "QUANTICDATA_API_KEY": "qd_live_your_key_here"
      }
    }
  }
}
```

## Env

| Var | Default | Notes |
|-----|---------|-------|
| `QUANTICDATA_API_KEY` | — | **Required.** Your `qd_live_` key. |
| `QUANTICDATA_API_BASE` | `https://api.quanticdata.io/v1` | Override for staging/self-host. |
| `QUANTICDATA_TOOLS` | all 29 | Load only some tools: names (`search,scrape`) or a preset (`lite`, `web`, `research`, `collectors`, `proxies`). See below. |

Self-hosted remote endpoint only (`quanticdata-mcp-remote`), optional:

| Var | Default | Notes |
|-----|---------|-------|
| `MCP_OAUTH_RESOURCE` | `https://api.quanticdata.io/mcp` | This endpoint as an OAuth resource. |
| `MCP_OAUTH_ISSUER` | `https://app.quanticdata.io` | Authorization server advertised in the resource metadata. |
| `MCP_OAUTH_INTROSPECT_URL` | `http://127.0.0.1:3090/api/v1/internal/oauth/introspect` | Where OAuth access tokens are checked. |
| `MCP_INTERNAL_TOKEN` | — | Secret for the introspection call. Unset = only API keys are accepted. |

## Local models (Ollama, LM Studio, Qwen, Open WebUI)

The 29 tool definitions are about 15,100 tokens. A local model on Ollama's default
4K context cannot hold them, and a 32K context loses almost half its room before the
first page. Load fewer tools:

<!-- mcp-docs:presets:start -->
| Preset | Tools | Definition tokens |
|--------|-------|-------------------|
| `lite` | search_and_read | ~360 |
| `web` | search_and_read, search, scrape, read_video | ~5,200 |
| `research` | search_and_read, search, scrape, read_video, map, batch, batch_status | ~6,100 |
| `collectors` | list_collectors, run_collector, collector_run_status | ~830 |
| `proxies` | list_proxies, generate_proxies, proxy_locations, whitelist_ip | ~1,800 |
<!-- mcp-docs:presets:end -->

Over stdio set `QUANTICDATA_TOOLS=web`. On the hosted endpoint add `?tools=web` to the
URL and send your API key as a Bearer header:
`https://api.quanticdata.io/mcp?tools=web`. Names can be combined: `?tools=lite,collectors`.

## Use it for every web lookup

The server tells the model what each of its tools is for. In Claude Code,
`search_and_read` loads at the start of each session and the other tools load when
the model looks for them; set `"alwaysLoad": false` in this server's entry to keep
all of them on demand. Whether a plain question goes to these tools or to the
client's own web search is up to you, with two settings:

1. Add one line to the project or custom instructions (in Claude Code, to `CLAUDE.md`):

   ```
   For web searches and reading web pages, use the QuanticData tools:
   search_and_read to answer a question, scrape for a known URL, search for raw results.
   ```

2. Turn off the client's own web search for that chat or project. In Claude Code, deny
   the built-in tools in `.claude/settings.json`:

   ```json
   { "permissions": { "deny": ["WebSearch", "WebFetch"] } }
   ```

## Example prompts

- "Scrape the pricing page at example.com and give me the plans and prices."
- "Search Google Shopping for 'nintendo switch oled' in the US and list the cheapest 5."
- "Map docs.example.com, then crawl only the /guides/ pages and summarize them."
- "List my proxy plans and generate 5 sticky US residential proxies as socks5 URLs."
- "Get me a rotating mobile proxy in Germany and whitelist my server IP 203.0.113.7."

## Privacy Policy

Full policy: <https://quanticdata.io/privacy>

**What this server sends.** It runs on your machine and talks only to the public
QuanticData API at `https://api.quanticdata.io/v1`, authenticated with
your own `qd_live_` key. Each call carries the arguments you (or your agent)
passed — the target URL or query, and any extraction prompt. Nothing else on your
machine is read or transmitted: the server has no filesystem, shell or clipboard
access.

**What we collect.** Account data you give us (name, email, billing details) and
a request log kept for billing, abuse prevention and support: target URL or
query, timestamp, response status, bytes transferred and the API key used. We do
**not** retain scraped page content beyond what is needed to return your result.

**Data you collect through the service.** You decide what public web data to
collect and **you are the controller of that data** — we process it on your
behalf only to fulfil your request. You are responsible for using the service
lawfully, for respecting the terms of the sites you access, and for any personal
data you collect through it.

**Sharing.** We do not sell personal data. We share it only with the processors
that run the service — payment providers, email delivery, hosting, CDN and
analytics — under contracts that bind them to protect it, and with the upstream
proxy networks that route your traffic (connection metadata only, never your
account details). We may disclose data where required by law.

**Retention.** Account data for as long as the account exists; request logs on a
rolling window for billing and abuse investigation. You can request deletion at
any time.

**Your key.** Claude Desktop stores it in the OS keychain and passes it to this
server as an environment variable. It is never written to the bundle and never
sent anywhere except the QuanticData API. Revoke or rotate it at
<https://app.quanticdata.io/api-keys>.

**Contact.** <support@quanticdata.io>
