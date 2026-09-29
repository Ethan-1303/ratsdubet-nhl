/**
 * GET /odds — proxy The Odds API (clé côté serveur)
 * Query: ?mode=events | ?mode=event&id=EVENT_ID&markets=h2h,totals,player_goal_scorer_anytime
 * Env: THE_ODDS_API_KEY
 */
export async function onRequestGet(context) {
  const key = context.env.THE_ODDS_API_KEY;
  if (!key) {
    return json({ error: "THE_ODDS_API_KEY manquant dans Cloudflare Pages → Variables" }, 501);
  }
  const u = new URL(context.request.url);
  const mode = u.searchParams.get("mode") || "events";
  const regions = u.searchParams.get("regions") || "eu,uk,us";
  const base = "https://api.the-odds-api.com/v4";

  try {
    if (mode === "events") {
      const r = await fetch(
        `${base}/sports/icehockey_nhl/odds?regions=${regions}&markets=h2h,totals&oddsFormat=decimal&apiKey=${key}`
      );
      const data = await r.json();
      if (!r.ok) return json({ error: data.message || data }, r.status);
      return json({ events: data, remaining: r.headers.get("x-requests-remaining") });
    }
    if (mode === "event") {
      const id = u.searchParams.get("id");
      if (!id) return json({ error: "id requis" }, 400);
      const markets =
        u.searchParams.get("markets") ||
        "h2h,totals,player_goal_scorer_anytime,player_points,player_assists,player_goals";
      const r = await fetch(
        `${base}/sports/icehockey_nhl/events/${encodeURIComponent(id)}/odds?regions=${regions}&markets=${markets}&oddsFormat=decimal&apiKey=${key}`
      );
      const data = await r.json();
      if (!r.ok) return json({ error: data.message || data }, r.status);
      return json({ event: data, remaining: r.headers.get("x-requests-remaining") });
    }
    return json({ error: "mode inconnu" }, 400);
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
