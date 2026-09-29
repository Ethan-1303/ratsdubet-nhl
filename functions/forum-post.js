/**
 * POST /forum-post — publication forum partagée (sans passer par le dashboard Supabase)
 * Body: { type, title, body, author_name, image_url? }
 * Env: SUPABASE_URL, SUPABASE_ANON_KEY (ou SUPABASE_SERVICE_ROLE_KEY)
 */
export async function onRequestPost(context) {
  const env = context.env;
  const url = env.SUPABASE_URL || "https://oprpqbvyocdzjssdmsug.supabase.co";
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
  if (!key) {
    return json({ error: "SUPABASE_ANON_KEY manquant (Cloudflare env)" }, 500);
  }

  let body = {};
  try { body = await context.request.json(); } catch {}

  const type = ["discussion", "ticket", "win", "loss"].includes(body.type) ? body.type : "discussion";
  const title = String(body.title || "").trim().slice(0, 120);
  const text = String(body.body || "").trim().slice(0, 2000);
  const author_name = String(body.author_name || "Membre").trim().slice(0, 60) || "Membre";
  const image_url = body.image_url && String(body.image_url).startsWith("http") ? String(body.image_url).slice(0, 500) : null;

  if (!title || !text) return json({ error: "Titre et message obligatoires" }, 400);

  const row = {
    type,
    title,
    body: text,
    author_name,
    author_id: null,
    image_url,
  };

  const res = await fetch(`${url}/rest/v1/forum_posts`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(row),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return json({ error: data.message || data.error || "Insert failed", detail: data }, 400);
  }
  const post = Array.isArray(data) ? data[0] : data;
  return json({ ok: true, post });
}

export async function onRequestGet(context) {
  const env = context.env;
  const url = env.SUPABASE_URL || "https://oprpqbvyocdzjssdmsug.supabase.co";
  const key = env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return json({ posts: [] });

  const res = await fetch(
    `${url}/rest/v1/forum_posts?select=id,type,title,body,image_url,author_name,author_id,created_at&order=created_at.desc&limit=80`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );
  const data = await res.json().catch(() => []);
  return json({ posts: Array.isArray(data) ? data : [] });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: cors() });
}
function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors() },
  });
}
