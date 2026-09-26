/**
 * Cloudflare Pages Function — proxy NHL + Actualites
 * GET /api?path=...
 * GET /api?news=1
 */
const NHL_STATS = "https://api.nhle.com";
const NHL_WEB = "https://api-web.nhle.com";
const ESPN_NEWS = "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/news";
const GOOGLE_RSS = "https://news.google.com/rss/search?q=NHL+hockey&hl=fr&gl=FR&ceid=FR:fr";
const GOOGLE_RSS_EN = "https://news.google.com/rss/search?q=NHL&hl=en-US&gl=US&ceid=US:en";

export async function onRequest(context) {
  const req = context.request;
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors() });
  }

  const url = new URL(req.url);

  if (url.searchParams.get("news") === "1") {
    const articles = await fetchNews();
    return json({ articles, updated: new Date().toISOString(), count: articles.length });
  }

  const path = url.searchParams.get("path");
  if (!path) return json({ error: "Missing path parameter" }, 400);

  let targetBase = NHL_STATS;
  let targetPath = path;

  if (path.startsWith("api-web.nhle.com/")) {
    targetBase = NHL_WEB;
    targetPath = path.replace(/^api-web\.nhle\.com/, "") || "/";
  } else if (path.startsWith("api.nhle.com/")) {
    targetBase = NHL_STATS;
    targetPath = path.replace(/^api\.nhle\.com/, "") || "/";
  } else if (!path.startsWith("/")) {
    targetPath = "/" + path;
  }

  const targetUrl = new URL(targetPath, targetBase);
  for (const [k, v] of url.searchParams.entries()) {
    if (k !== "path" && k !== "news") targetUrl.searchParams.set(k, v);
  }

  try {
    const upstream = await fetch(targetUrl.toString(), {
      headers: { Accept: "application/json", "User-Agent": "RATSDUBET-NHL-RDB/1.3" },
      cf: { cacheTtl: 90, cacheEverything: true },
    });
    const body = await upstream.text();
    const contentType = upstream.headers.get("content-type") || "application/json";
    return new Response(body, {
      status: upstream.status,
      headers: { "Content-Type": contentType, ...cors(), "Cache-Control": "public, max-age=90" },
    });
  } catch (err) {
    return json({ error: "Upstream fetch failed", message: String(err) }, 502);
  }
}

async function fetchNews() {
  const sources = [fromEspn, fromGoogleRss, fromScoreboard];
  for (const fn of sources) {
    try {
      const arts = await fn();
      if (arts && arts.length) return arts.slice(0, 20);
    } catch (_) {}
  }
  return [];
}

async function fromEspn() {
  const up = await fetch(ESPN_NEWS, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; RATSDUBET/1.3)" },
  });
  const ct = up.headers.get("content-type") || "";
  if (!ct.includes("json")) throw new Error("espn not json");
  const data = await up.json();
  return (data.articles || []).map((a) => ({
    id: String(a.id || a.headline),
    title: a.headline || a.title || "",
    description: a.description || "",
    published: a.published || a.lastModified || "",
    url: a.links?.web?.href || a.links?.web?.self?.href || "https://www.nhl.com/news",
    image: a.images?.[0]?.url || null,
    source: "ESPN NHL",
  })).filter((a) => a.title);
}

async function fromGoogleRss() {
  let xml = "";
  for (const feed of [GOOGLE_RSS, GOOGLE_RSS_EN]) {
    try {
      const up = await fetch(feed, {
        headers: {
          Accept: "application/rss+xml, application/xml, text/xml, */*",
          "User-Agent": "Mozilla/5.0 (compatible; RATSDUBET/1.3)",
        },
      });
      xml = await up.text();
      if (xml.includes("<item>")) break;
    } catch (_) {}
  }
  if (!xml.includes("<item>")) throw new Error("no rss items");

  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = re.exec(xml)) && items.length < 20) {
    const block = m[1];
    const title = decodeXml(pickTag(block, "title"));
    const link = pickTag(block, "link");
    const pub = pickTag(block, "pubDate");
    const desc = decodeXml(stripTags(pickTag(block, "description")));
    const source = pickTag(block, "source") || "Google News";
    if (!title) continue;
    items.push({
      id: link || title,
      title,
      description: desc.slice(0, 220),
      published: pub ? new Date(pub).toISOString() : "",
      url: link || "https://www.nhl.com/news",
      image: null,
      source: source || "Google News · NHL",
    });
  }
  return items;
}

async function fromScoreboard() {
  const up = await fetch(NHL_WEB + "/v1/scoreboard/now", {
    headers: { Accept: "application/json", "User-Agent": "RATSDUBET-NHL/1.3" },
  });
  const data = await up.json();
  const arts = [];
  for (const day of data.gamesByDate || []) {
    for (const g of day.games || []) {
      const home = g.homeTeam?.abbrev || "?";
      const away = g.awayTeam?.abbrev || "?";
      const hs = g.homeTeam?.score;
      const as = g.awayTeam?.score;
      const state = g.gameState || "";
      const title =
        Number.isFinite(hs) && Number.isFinite(as)
          ? away + " " + as + " – " + hs + " " + home
          : away + " @ " + home;
      arts.push({
        id: String(g.id || title),
        title: "NHL · " + title,
        description: (day.date || "") + " · " + state,
        published: g.startTimeUTC || day.date || "",
        url: g.gameCenterLink ? "https://www.nhl.com" + g.gameCenterLink : "https://www.nhl.com/scores",
        image: null,
        source: "NHL Scoreboard",
      });
    }
  }
  if (!arts.length) throw new Error("no games");
  return arts;
}

function pickTag(block, tag) {
  const m =
    block.match(new RegExp("<" + tag + "[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/" + tag + ">", "i")) ||
    block.match(new RegExp("<" + tag + "[^>]*>([\\s\\S]*?)<\\/" + tag + ">", "i"));
  return m ? m[1].trim() : "";
}
function stripTags(s) {
  return String(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
function decodeXml(s) {
  return String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}
function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type": "application/json", ...cors(), "Cache-Control": "public, max-age=120" },
  });
}
