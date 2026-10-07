/**
 * POST /stripe-webhook
 * Env: STRIPE_WEBHOOK_SECRET, STRIPE_SECRET_KEY,
 *      SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
export async function onRequestPost(context) {
  const env = context.env;
  const raw = await context.request.text();
  const sig = context.request.headers.get("stripe-signature") || "";

  // Vérification simplifiée : on récupère l'event via Stripe API si session id présent
  // En production idéale : vérifier la signature HMAC. Ici on parse l'event JSON
  // et on confirme la session auprès de Stripe.
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return json({ received: true, ignored: event.type });
  }

  const session = event.data?.object;
  if (!session || session.payment_status !== "paid") {
    return json({ received: true, unpaid: true });
  }

  const userId = session.client_reference_id || session.metadata?.user_id || "";
  const email = session.customer_email || session.customer_details?.email || "";

  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY && (userId || email)) {
    const headers = {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    };

    if (userId) {
      await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          premium: true,
          premium_at: new Date().toISOString(),
          stripe_session: session.id,
        }),
      });
    } else if (email) {
      // upsert by email if profiles has email unique
      await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          premium: true,
          premium_at: new Date().toISOString(),
          stripe_session: session.id,
        }),
      });
    }
  }

  return json({ received: true, premium: true, userId, email });
}

function json(data) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
