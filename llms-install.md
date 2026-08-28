# QuanticData MCP Server — Automated Install Guide (for Cline)

This file tells an AI agent (e.g. Cline) exactly how to install and configure the
QuanticData MCP server without human back-and-forth. There are two transports.
**Prefer Option A (local npx stdio)** — it is the most portable and needs no
extra network config. Use Option B (remote HTTP) only if the user explicitly
wants the hosted endpoint.

The server exposes **25 tools** for live web access: `scrape`, `seo_audit`,
`search`, `search_and_read`, `search_bulk`, `map`, `crawl`, `batch`,
`create_dataset`, the parser-preset tools, the 74 `*_collector*` tools,
`list_proxies`, `generate_proxies`, `proxy_locations`, and `whitelist_ip`.

## Prerequisites

1. **Node.js 18 or newer** must be available (`node --version`). `npx` ships with
   Node, so no separate install of the server package is required.
2. **A QuanticData API key.** Keys look like `qd_live_...` and are created at
   <https://app.quanticdata.io/api-keys>. Signing up is free ($2 of free API
   usage every month, no card required); running paid tools draws on a prepaid
   wallet balance.

### Getting the key (ask the user — never invent one)

- If the environment already has `QUANTICDATA_API_KEY` set, reuse it and skip
  ahead.
- Otherwise, direct the user to <https://app.quanticdata.io/api-keys> to create a
  key and have **them** provide it. Do not ask the user to paste the key into a
  shared chat if it can be avoided; treat it as a secret (it authorizes wallet
  spend).

## Option A — Local server via npx (recommended)

Add this entry to the Cline MCP settings JSON (`cline_mcp_settings.json`),
substituting the user's real key for `qd_live_your_key_here`:

```json
{
  "mcpServers": {
    "quanticdata": {
      "command": "npx",
      "args": ["-y", "quanticdata-mcp"],
      "env": {
        "QUANTICDATA_API_KEY": "qd_live_your_key_here"
      }
    }
  }
}
```

- Package on npm: `quanticdata-mcp` (latest 0.9.1). `npx -y` fetches it on demand.
- The **only** required environment variable is `QUANTICDATA_API_KEY`.
- Optional: `QUANTICDATA_API_BASE` (defaults to `https://api.quanticdata.io/v1`) —
  only set this for staging or self-hosting; leave it unset otherwise.

## Option B — Remote hosted server (Streamable HTTP)

The same server is hosted at a URL, so no local Node process is needed. Add this
to the Cline MCP settings JSON. The key travels per request in an HTTP header;
prefer the `Authorization: Bearer` form:

```json
{
  "mcpServers": {
    "quanticdata": {
      "type": "streamableHttp",
      "url": "https://api.quanticdata.io/mcp",
      "headers": {
        "Authorization": "Bearer qd_live_your_key_here"
      }
    }
  }
}
```

- The endpoint also accepts the key as an `X-Api-Key: qd_live_your_key_here`
  header instead of `Authorization: Bearer` — either works. Use `Authorization:
  Bearer` unless the client cannot send it.
- The server is stateless: each request carries its own key and nothing is shared
  between requests.
- `initialize` and `tools/list` answer **without** a key (so the tool list can be
  browsed), but every actual tool call requires a valid key.

## Verify the install

After adding the config and reloading MCP servers, confirm connectivity by
calling the **`list_collectors`** tool. It takes no arguments, is free, and
returns the collector catalogue. If it returns a list, the key works. If it
returns "No API key on this request", the `QUANTICDATA_API_KEY` did not reach the
process — re-check the `env` block (Option A) or the header (Option B).

> A populated tool list alone is **not** proof the key works, because the tool
> list is browsable without a key. Only a successful tool call confirms it.

## Cost note (surface before large runs)

Usage is metered and prepaid: per request for `scrape`, `search`, `map` and
`crawl`; per delivered row for the collectors. Failed calls are never charged.
`list_collectors` reports each collector's per-row price — use it to estimate the
cost of a large collector run or `create_dataset` before starting, and tell the
user the rough cost first.
