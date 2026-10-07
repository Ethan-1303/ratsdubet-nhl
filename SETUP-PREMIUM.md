# RATSDUBET NHL — Setup Complet (Supabase + Stripe + Actu)

## 1. Supabase Auth

1. Crée un projet sur [supabase.com](https://supabase.com)
2. **SQL Editor** → exécute :

```sql
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  premium boolean default false,
  premium_at timestamptz,
  stripe_session text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Le service role (webhook) bypass RLS
```

3. **Authentication → Providers** : Email activé  
4. **Project Settings → API** : copie
   - Project URL → `config.js` → `SUPABASE_URL`
   - `anon` `public` key → `SUPABASE_ANON_KEY`

```js
SUPABASE_URL: "https://XXXX.supabase.co",
SUPABASE_ANON_KEY: "eyJhbGciOi...",
```

## 2. Stripe Checkout

1. [dashboard.stripe.com](https://dashboard.stripe.com) → Developers → API keys  
2. Copie la **Secret key** (`sk_test_...` puis `sk_live_...`)

### Cloudflare Pages → Settings → Environment variables

| Variable | Valeur |
|----------|--------|
| `STRIPE_SECRET_KEY` | `sk_live_...` ou `sk_test_...` |
| `SITE_URL` | `https://ratsdubet-nhl.pages.dev` |
| `SUPABASE_URL` | même URL Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | clé **service_role** (secret !) |
| `STRIPE_WEBHOOK_SECRET` | (optionnel) `whsec_...` |

### Webhook Stripe

1. Developers → Webhooks → Add endpoint  
2. URL : `https://ratsdubet-nhl.pages.dev/stripe-webhook`  
3. Event : `checkout.session.completed`  
4. Copie le signing secret si tu durcis la vérif plus tard  

Le flux :
- Client → `POST /stripe-checkout` → session Stripe 20 €  
- Paiement OK → redirect `/?rdb_unlocked=1` + webhook met `profiles.premium = true`

## 3. Actu NHL

- Onglet **Actu** → flux ESPN NHL via `/api?news=1`  
- Aucune clé requise  

## 4. Fichiers à pousser sur GitHub

```
index.html
app.js
styles.css
config.js          ← mets tes clés Supabase publiques
auth.js
functions/api.js
functions/stripe-checkout.js
functions/stripe-webhook.js
SETUP-PREMIUM.md
```

Puis **Redeploy** Cloudflare Pages.

## 5. Test rapide

1. Créer un compte (Supabase si configuré, sinon local)  
2. Onglet Actu → articles  
3. Premium → Payer 20 € (mode test Stripe `4242…`)  
4. Retour site → badge **PREMIUM**  

## Sécurité

- Ne **jamais** mettre `service_role` ou `sk_live` dans `config.js`  
- Uniquement dans **Cloudflare Environment Variables** (encrypted)
