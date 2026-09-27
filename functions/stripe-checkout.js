/**
 * POST /stripe-checkout
 * Body JSON: { email?, userId?, promoCode? }
 * Env: STRIPE_SECRET_KEY, SITE_URL
 * Prix de base 20 € ; code promo parrainage (ex. MEUTE5) → −5 € via Stripe Promotion Codes
 */
export async function onRequestPost(context) {
  const key = context.env.STRIPE_SECRET_KEY;
  if (!key) {
    return json({ error: "STRIPE_SECRET_KEY manquant dans Cloudflare env" }, 500);
  }

  let body = {};
  try {
    body = await context.request.json();
  } catch {}

  const site = context.env.SITE_URL || "https://ratsdubet-nhl.pages.dev";
  const email = body.email || "";
  const userId = body.userId || "";
  const promoCode = String(body.promoCode || body.promotion_code || "").trim();

  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", `${site}/?rdb_unlocked=1&session_id={CHECKOUT_SESSION_ID}`);
  params.set("cancel_url", `${site}/?rdb_cancel=1`);
  params.set("line_items[0][price_data][currency]", "eur");
  params.set("line_items[0][price_data][product_data][name]", "BETZONE by Ratsdubet — Accès Complet à Vie");
  params.set("line_items[0][price_data][product_data][description]", "Analyses NHL illimitées — paiement unique");
  params.set("line_items[0][price_data][unit_amount]", "2000"); // 20.00 EUR
  params.set("line_items[0][quantity]", "1");
  if (email) params.set("customer_email", email);
  if (userId) params.set("client_reference_id", userId);
  params.set("metadata[product]", "rdb_nhl_lifetime");
  if (userId) params.set("metadata[user_id]", userId);
  if (promoCode) params.set("metadata[promo_attempt]", promoCode);

  let promoApplied = false;
  if (promoCode) {
    try {
      const q = new URLSearchParams({ code: promoCode, active: "true", limit: "1" });
      const pr = await fetch(`https://api.stripe.com/v1/promotion_codes?${q}`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      const pj = await pr.json();
      const promoId = pj.data && pj.data[0] && pj.data[0].id;
      if (promoId) {
        params.set("discounts[0][promotion_code]", promoId);
        promoApplied = true;
      }
    } catch (_) {}
  }
  if (!promoApplied) {
    // L'utilisateur pourra encore saisir un code sur la page Stripe
    params.set("allow_promotion_codes", "true");
  }

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const data = await res.json();
  if (!res.ok) {
    return json({ error: data.error?.message || "Stripe error", detail: data }, 400);
  }
  return json({ url: data.url, id: data.id, promoApplied });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: cors() });
}

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors() },
  });
}
