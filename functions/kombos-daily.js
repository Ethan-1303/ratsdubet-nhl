/**
 * GET/POST /kombos-daily — 1 calcul Kombos partagé par jour (Cache API Cloudflare)
 * GET  → { ok, date, payload } ou 404 si pas encore calculé
 * POST → body = payload du jour ; n'écrase pas si déjà présent
 */
function dayKey(tz = "America/Toronto") {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...cors(),
      ...extra,
    },
  });
}

function cacheRequest(date) {
  return new Request(`https://betzone-rdb.internal/kombos-daily/${date}`);
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: cors() });
}

export async function onRequestGet(context) {
  const date = dayKey();
  const cache = caches.default;
  const hit = await cache.match(cacheRequest(date));
  if (hit) {
    const data = await hit.json();
    return json({ ok: true, date, cached: true, payload: data.payload });
  }
  return json({ ok: false, date, cached: false, error: "not_ready" }, 404);
}

export async function onRequestPost(context) {
  const date = dayKey();
  const cache = caches.default;
  const key = cacheRequest(date);

  // Déjà calculé aujourd'hui → ne pas écraser
  const existing = await cache.match(key);
  if (existing) {
    const data = await existing.json();
    return json({ ok: true, date, cached: true, payload: data.payload, wrote: false });
  }

  let body = {};
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "JSON invalide" }, 400);
  }

  const payload = body.payload || body;
  if (!payload || typeof payload !== "object") {
    return json({ error: "payload requis" }, 400);
  }

  const stored = { date, at: Date.now(), payload };
  const res = json({ ok: true, date, cached: true, payload, wrote: true });
  // Cache 36h pour couvrir le jour
  const toStore = new Response(JSON.stringify(stored), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=129600",
    },
  });
  try {
    await cache.put(key, toStore);
  } catch (e) {
    console.warn("cache put failed", e);
  }
  return res;
}
