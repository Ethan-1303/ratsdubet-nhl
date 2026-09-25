/**
 * Cloudflare Pages Function — proxy NHL API
 * Évite les restrictions CORS du navigateur.
 *
 * Usage côté client :
 *   /api?path=stats/rest/en/team/summary&...
 *   /api?path=api-web.nhle.com/v1/schedule/2026-09-25
 */

const NHL_STATS = "https://api.nhle.com";
const NHL_WEB = "https://api-web.nhle.com";

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.searchParams.get("path");

  if (!path) {
    return new Response(JSON.stringify({ error: "Missing path parameter" }), {
      status: 400,
      headers: corsHeaders("application/json"),
    });
  }

  // Détermine la base selon le préfixe du path
  let targetBase = NHL_STATS;
  let targetPath = path;

  if (path.startsWith("api-web.nhle.com/")) {
    targetBase = NHL_WEB;
    targetPath = path.replace(/^api-web\.nhle\.com/, "");
  } else if (path.startsWith("api.nhle.com/")) {
    targetBase = NHL_STATS;
    targetPath = path.replace(/^api\.nhle\.com/, "");
  } else if (!path.startsWith("/")) {
    targetPath = "/" + path;
  }

  // Reconstruit les query params (sans "path")
  const targetUrl = new URL(targetPath, targetBase);
  for (const [k, v] of url.searchParams.entries()) {
    if (k !== "path") targetUrl.searchParams.set(k, v);
  }

  try {
    const upstream = await fetch(targetUrl.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "RATSDUBET-NHL-RDB/1.0",
      },
      // Cache léger côté edge
      cf: { cacheTtl: 60, cacheEverything: true },
    });

    const body = await upstream.text();
    const contentType = upstream.headers.get("content-type") || "application/json";

    return new Response(body, {
      status: upstream.status,
      headers: {
        ...Object.fromEntries(corsHeaders(contentType)),
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Upstream fetch failed", message: String(err) }),
      {
        status: 502,
        headers: corsHeaders("application/json"),
      }
    );
  }
}

function corsHeaders(contentType) {
  return {
    "Content-Type": contentType,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
