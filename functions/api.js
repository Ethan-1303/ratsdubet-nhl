/**
 * Cloudflare Pages Function — proxy NHL API
 */
const NHL_STATS = "https://api.nhle.com";
const NHL_WEB = "https://api-web.nhle.com";

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.searchParams.get("path");

  if (!path) {
    return json({ error: "Missing path parameter" }, 400);
  }

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
    });

    const body = await upstream.text();
    const contentType = upstream.headers.get("content-type") || "application/json";

    return new Response(body, {
      status: upstream.status,
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (err) {
    return json({ error: "Upstream fetch failed", message: String(err) }, 502);
  }
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
