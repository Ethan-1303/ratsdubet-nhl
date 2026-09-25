/**
 * Cloudflare Pages Function â€” proxy NHL + ESPN News
 * GET /api?path=...
 * GET /api?news=1  â†’ actualitÃ©s NHL ESPN
 */
const NHL_STATS = "https://api.nhle.com";
const NHL_WEB = "https://api-web.nhle.com";
const ESPN_NEWS = "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/news";

export async function onRequest(context) {
  const req = context.request;
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors() });
  }

  const url = new URL(req.url);

  // ActualitÃ©s NHL
  if (url.searchParams.get("news") === "1") {
    try {
      const up = await fetch(ESPN_NEWS, {
        headers: { Accept: "application/json", "User-Agent": "RATSDUBET-NHL/1.2" },
        cf: { cacheTtl: 300, cacheEverything: true },
      });
      const data = await up.json();
      const articles = (data.articles || []).slice(0, 20).map((a) => ({
        id: a.id,
        title: a.headline || a.title || "",
        description: a.description || "",
        published: a.published || a.publishedAt || "",
        url: a.links?.web?.href || a.link || "https://www.nhl.com/news",
        image: a.images?.[0]?.url || null,
        source: a.byline || "ESPN NHL",
      }));
      return json({ articles, updated: new Date().toISOString() });
    } catch (err) {
      return json({ error: String(err), articles: [] }, 502);
    }
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
      headers: { Accept: "application/json", "User-Agent": "RATSDUBET-NHL-RDB/1.2" },
      cf: { cacheTtl: 90, cacheEverything: true },
    });
    const body = await upstream.text();
    const contentType = upstream.headers.get("content-type") || "application/json";
    return new Response(body, {
      status: upstream.status,
      headers: {
        "Content-Type": contentType,
        ...cors(),
        "Cache-Control": "public, max-age=90",
      },
    });
  } catch (err) {
    return json({ error: "Upstream fetch failed", message: String(err) }, 502);
  }
}

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors() },
  });
}
