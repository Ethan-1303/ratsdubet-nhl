/* ═══════════════════════════════════════════════════════════
   RATSDUBET NHL — Configuration publique (safe côté client)
   Secrets Stripe / Supabase service → Cloudflare Pages env vars
   ═══════════════════════════════════════════════════════════ */
window.RDB_CONFIG = {
  TELEGRAM_URL: "https://t.me/RATS_DU_BET",
  TELEGRAM_HANDLE: "@RATS_DU_BET",

  PRICE_EUR: 20,
  PRICE_LABEL: "20 € à vie",
  PRODUCT_NAME: "RATSDUBET NHL — Accès Complet à Vie",

  /* Supabase Auth (Project Settings → API) */
  SUPABASE_URL: "",          // ex: https://oprpqbvyocdzjssdmsug.supabase.co
  SUPABASE_ANON_KEY: "",     // sb_publishable_Jg2FbOebUBjGl5toyu5H0A_WMq_-vqq

  /* Quota gratuit si non premium */
  FREE_ANALYSES_PER_DAY: 1,
  FREE_SHOW_SUMMARY: true,

  /* Site (utilisé pour Stripe success/cancel URLs) */
  SITE_URL: "https://ratsdubet-nhl.pages.dev",
};
