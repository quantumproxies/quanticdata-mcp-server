#!/usr/bin/env node
/**
 * QuanticData MCP server — stdio, zero dependencies, one file.
 *
 * Gives an MCP client (Claude Code, Claude Desktop, Cursor, Windsurf, Zed, or
 * anything else that speaks the protocol) live web access through the
 * QuanticData Data APIs: scrape a page, run a search, map or crawl a site,
 * audit a URL for SEO, and run any of the 31 ready-made Collectors.
 *
 * Protocol: JSON-RPC 2.0 over stdio, newline-delimited. It implements the three
 * methods a client actually needs — initialize, tools/list, tools/call — plus
 * ping. That is the whole MCP surface for a tools-only server, which is why this
 * file needs no SDK.
 *
 *   QUANTICDATA_API_KEY=qd_live_... node server.mjs
 */

const API_BASE = (process.env.QUANTICDATA_API_BASE || "https://api.quanticdata.io/v1").replace(/\/+$/, "");
const API_KEY = process.env.QUANTICDATA_API_KEY || "";
const PROTOCOL_VERSION = "2025-06-18";
const SERVER_INFO = { name: "quanticdata", version: "1.0.0" };

// ── HTTP ─────────────────────────────────────────────────────────────────────

async function api(method, path, body) {
  if (!API_KEY) {
    throw new Error(
      "QUANTICDATA_API_KEY is not set. Get a key at https://app.quanticdata.io/register " +
        "and put it in the MCP server's env block.",
    );
  }

  let res;
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(`cannot reach ${API_BASE}: ${err.message}`);
  }

  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    return text; // CSV exports come back as text/csv
  }

  if (!res.ok || parsed.type === "error") {
    throw new Error(parsed.message || `HTTP ${res.status}`);
  }
  return parsed.payload ?? parsed;
}

// ── Tools ────────────────────────────────────────────────────────────────────

const str = (description) => ({ type: "string", description });
const bool = (description) => ({ type: "boolean", description });
const int = (description) => ({ type: "integer", description });

const TOOLS = [
  {
    name: "scrape",
    description:
      "Fetch one URL and return it as Markdown (default), HTML or plain text, through residential " +
      "proxies with real-browser TLS fingerprints. Set render:true only when the content is genuinely " +
      "absent from the raw HTML. Use `extract` for CSS-selector JSON, or `ai_prompt` to have the page " +
      "turned into structured data by an LLM. $0.0002 per page; a failed fetch is free.",
    inputSchema: {
      type: "object",
      properties: {
        url: str("The page to fetch (http/https)."),
        format: { ...str("Output format."), enum: ["markdown", "html", "text"], default: "markdown" },
        contentMode: {
          ...str("How much of the page to keep."),
          enum: ["smart", "article", "full"],
          default: "smart",
        },
        render: bool("Run a stealth headless browser (JS execution). Slower and pricier."),
        waitForSelector: str("Render mode: wait until this CSS selector appears."),
        extract: {
          type: "object",
          description: 'CSS extraction schema, e.g. {"price": ".price", "title": "h1"}. Returns payload.data.',
          additionalProperties: true,
        },
        ai_prompt: str("Natural-language extraction instruction; result lands in payload.ai.data."),
        country: str("ISO 3166-1 alpha-2 code for the proxy exit, e.g. us, de, jp."),
        mode: { ...str("summary returns metadata only, no page content."), enum: ["full", "summary"] },
      },
      required: ["url"],
    },
    call: (args) => api("POST", "/scrape", args),
  },
  {
    name: "search",
    description:
      "Structured search results from Google, Bing, DuckDuckGo or Yandex: organic rows with position, " +
      "title, link, snippet and sitelinks, plus related searches and any local/news/shopping blocks the " +
      "page carried. Eighteen verticals via search_type. From $0.0005 per search.",
    inputSchema: {
      type: "object",
      properties: {
        query: str("The search query."),
        engine: { ...str("Search engine."), enum: ["google", "bing", "duckduckgo", "yandex"], default: "google" },
        search_type: {
          ...str("Vertical."),
          enum: ["search", "shopping", "images", "news", "places", "maps", "videos", "scholar",
                 "jobs", "autocomplete", "place_details", "hotels", "flights", "events",
                 "product", "lens", "reviews", "trends"],
          default: "search",
        },
        country: str("ISO country code — sets the proxy exit and the engine locale (gl)."),
        lang: str("Interface language (hl), e.g. en, it."),
        location: str('Search as if from this place, e.g. "Milan, Italy". Google only.'),
        num: int("Results to request, 1-100. Default 10."),
        page: int("Result page, 1-based."),
      },
      required: ["query"],
    },
    call: (args) => api("POST", "/serp", args),
  },
  {
    name: "map",
    description:
      "Discover every URL of a site in one call: robots.txt sitemaps + /sitemap.xml (including nested " +
      "indexes) + same-domain homepage links, de-duplicated. Returns the list plus a site-wide total and " +
      "a per-section summary. Always cheaper than crawling to find out how big a site is. $0.0005.",
    inputSchema: {
      type: "object",
      properties: {
        url: str("Seed URL."),
        limit: int("Max URLs returned, default 100, cap 5000. Discovery always scans the whole site."),
        search: str("Only return URLs containing this substring."),
        includeSubdomains: bool("Include URLs on subdomains of the seed host."),
        group_by: { ...str('Set to "path" for the path tree with counts instead of the URL list.'), enum: ["path"] },
        country: str("ISO country code for the proxy exit."),
      },
      required: ["url"],
    },
    call: (args) => api("POST", "/map", args),
  },
  {
    name: "crawl",
    description:
      "Start an asynchronous BFS crawl from a seed URL; each page comes back as Markdown. Returns a job " +
      "id immediately — poll with crawl_status. $0.0003 per page, unfetched budget refunded. Prefer " +
      "map + batch when you can filter the URL list first.",
    inputSchema: {
      type: "object",
      properties: {
        url: str("Seed URL."),
        limit: int("Max pages, default 50, cap 500."),
        depth: int("Max link depth from the seed, default 3, cap 10."),
        contentMode: { ...str("Content scope per page."), enum: ["smart", "article", "full"] },
        render: bool("Render every page with the browser (much slower)."),
        include: { type: "array", items: { type: "string" }, description: "URL substrings to include." },
        exclude: { type: "array", items: { type: "string" }, description: "URL substrings to skip." },
        country: str("ISO country code for the proxy exit."),
      },
      required: ["url"],
    },
    call: (args) => api("POST", "/crawl", args),
  },
  {
    name: "crawl_status",
    description: "Poll a crawl job: status, pagesCrawled, pagesQueued and the pages fetched so far.",
    inputSchema: {
      type: "object",
      properties: { jobId: str("The id returned by crawl.") },
      required: ["jobId"],
    },
    call: (args) => api("GET", `/crawl/${encodeURIComponent(args.jobId)}`),
  },
  {
    name: "seo_audit",
    description:
      "Fetch a URL twice — as a no-JS bot and fully rendered — and return both views, the diff between " +
      "them (contentOnlyInJs, canonicalMissingNoJs, titleChanged…) and the bot-facing meta (robots, OG, " +
      "JSON-LD types). The fastest way to answer 'is this page indexable without JavaScript'. $0.0012.",
    inputSchema: {
      type: "object",
      properties: {
        url: str("The page to audit."),
        country: str("ISO country code for the proxy exit."),
        no_render: bool("Skip the rendered pass — cheaper, bot view only."),
      },
      required: ["url"],
    },
    call: (args) => api("POST", "/seo-audit", args),
  },
  {
    name: "list_collectors",
    description:
      "List the 31 ready-made Collectors: versioned scrapers you run with a semantic input (keyword + " +
      "location, ASIN, domain, handle…) instead of URLs — web_search, keyword_ideas, amazon_search, " +
      "amazon_product, ebay_search, aliexpress_search, google_maps_places, place_reviews, google_jobs, " +
      "linkedin_jobs, indeed_jobs, google_news, google_shopping, product_offers, hotels, youtube_search, " +
      "youtube_channel, reddit_posts, instagram_profile, tiktok_profile, tiktok_video, zillow_search, " +
      "app_store_apps, google_play_apps, linkedin_profile, linkedin_company, company_profile, " +
      "site_contacts, local_business_leads, search_images, search_videos. Each entry carries its input " +
      "and output schema, examples, health and your price per delivered row. Free to call.",
    inputSchema: { type: "object", properties: {} },
    call: () => api("GET", "/scraper/collectors"),
  },
  {
    name: "run_collector",
    description:
      "Run one Collector with its semantic input. Short runs return the rows directly; long runs return " +
      "a run_id to poll with collector_run_status. Billed per delivered row — zero rows costs zero.",
    inputSchema: {
      type: "object",
      properties: {
        slug: str("Collector slug, e.g. google_maps_places. Call list_collectors first if unsure."),
        input: {
          type: "object",
          description: "The collector's input, matching its published input_schema.",
          additionalProperties: true,
        },
        async: bool("Force background processing and return a run_id immediately."),
      },
      required: ["slug", "input"],
    },
    call: (args) =>
      api("POST", `/scraper/collectors/${encodeURIComponent(args.slug)}/run`, {
        ...args.input,
        ...(args.async ? { async: true } : {}),
      }),
  },
  {
    name: "collector_run_status",
    description: "Fetch one Collector run and its delivered rows by run_id.",
    inputSchema: {
      type: "object",
      properties: { runId: str("The run_id returned by run_collector.") },
      required: ["runId"],
    },
    call: (args) => api("GET", `/scraper/collectors/runs/${encodeURIComponent(args.runId)}`),
  },
];

const BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

// ── JSON-RPC over stdio ──────────────────────────────────────────────────────

function send(message) {
  process.stdout.write(JSON.stringify(message) + "\n");
}

function result(id, value) {
  send({ jsonrpc: "2.0", id, result: value });
}

function failure(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

async function handle(request) {
  const { id, method, params } = request;

  switch (method) {
    case "initialize":
      return result(id, {
        protocolVersion: params?.protocolVersion ?? PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
      });

    case "ping":
      return result(id, {});

    case "tools/list":
      return result(id, {
        tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
      });

    case "tools/call": {
      const tool = BY_NAME.get(params?.name);
      if (!tool) return failure(id, -32602, `unknown tool: ${params?.name}`);
      try {
        const payload = await tool.call(params.arguments ?? {});
        const text = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
        return result(id, { content: [{ type: "text", text }] });
      } catch (err) {
        // Tool failures are results, not protocol errors — the model should see them.
        return result(id, { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true });
      }
    }

    default:
      // Notifications (no id) need no reply; anything else is unimplemented.
      if (id === undefined || id === null) return;
      return failure(id, -32601, `method not found: ${method}`);
  }
}

let buffer = "";
let inFlight = 0;
let stdinClosed = false;

// A tool call is async. If stdin closes while requests are still running (which
// is exactly what happens when you pipe a script into the server), exiting right
// away would swallow their replies — so wait for the queue to drain.
function maybeExit() {
  if (stdinClosed && inFlight === 0) process.exit(0);
}

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let index;
  while ((index = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (!line) continue;

    let request;
    try {
      request = JSON.parse(line);
    } catch {
      failure(null, -32700, "parse error");
      continue;
    }

    inFlight++;
    handle(request)
      .catch((err) => failure(request.id ?? null, -32603, err.message))
      .finally(() => {
        inFlight--;
        maybeExit();
      });
  }
});

process.stdin.on("end", () => {
  stdinClosed = true;
  maybeExit();
});
console.error(`QuanticData MCP server ready — ${TOOLS.length} tools, API base ${API_BASE}`);
