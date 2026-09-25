/**
 * RATSDUBET Auth — Supabase (prioritaire) + fallback local + Stripe Checkout
 */
(function () {
  const CFG = () => window.RDB_CONFIG || {};
  const KEY_USER = "rdb_user_v1";
  const KEY_PREMIUM = "rdb_premium_v1";
  const KEY_USAGE = "rdb_usage_v1";

  function load(k, d) {
    try { return JSON.parse(localStorage.getItem(k) || "null") ?? d; } catch { return d; }
  }
  function save(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

  async function hash(str) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("rdb:" + str));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  let supabase = null;

  async function initSupabase() {
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = CFG();
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
    if (supabase) return supabase;
    // CDN ESM
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return supabase;
  }

  const Auth = {
    user: load(KEY_USER, null),
    premium: !!load(KEY_PREMIUM, false),
    ready: false,

    async init() {
      const sb = await initSupabase();
      if (sb) {
        const { data } = await sb.auth.getSession();
        if (data?.session?.user) {
          await this._fromSupabaseUser(data.session.user);
        }
        sb.auth.onAuthStateChange(async (event, session) => {
          if (session?.user) await this._fromSupabaseUser(session.user);
          else if (event === "SIGNED_OUT") {
            this.user = null;
            localStorage.removeItem(KEY_USER);
          }
          window.dispatchEvent(new CustomEvent("rdb:auth"));
        });
      }
      this.checkUnlockParam();
      this.ready = true;
      window.dispatchEvent(new CustomEvent("rdb:auth"));
    },

    async _fromSupabaseUser(u) {
      let premium = this.premium;
      try {
        const sb = await initSupabase();
        const { data } = await sb.from("profiles").select("premium,name,email").eq("id", u.id).maybeSingle();
        if (data?.premium) {
          premium = true;
          this.grantPremium("supabase", true);
        }
        this.user = {
          id: u.id,
          email: u.email,
          name: data?.name || u.user_metadata?.name || u.email?.split("@")[0],
          premium,
          provider: "supabase",
        };
      } catch {
        this.user = {
          id: u.id,
          email: u.email,
          name: u.user_metadata?.name || u.email?.split("@")[0],
          premium,
          provider: "supabase",
        };
      }
      save(KEY_USER, this.user);
    },

    isLoggedIn() { return !!this.user?.email; },
    isPremium() { return !!(this.premium || this.user?.premium); },
    hasSupabase() { return !!(CFG().SUPABASE_URL && CFG().SUPABASE_ANON_KEY); },

    async register(email, password, name) {
      email = String(email || "").trim().toLowerCase();
      if (!email || !password || password.length < 6)
        throw new Error("Email valide et mot de passe (6+ caractères) requis.");

      const sb = await initSupabase();
      if (sb) {
        const { data, error } = await sb.auth.signUp({
          email,
          password,
          options: { data: { name: name || email.split("@")[0] } },
        });
        if (error) throw new Error(error.message);
        if (data.user) {
          // crée profil
          try {
            await sb.from("profiles").upsert({
              id: data.user.id,
              email,
              name: name || email.split("@")[0],
              premium: false,
            });
          } catch {}
          await this._fromSupabaseUser(data.user);
        }
        return this.user;
      }

      // Fallback local
      const users = load("rdb_users_db_v1", {});
      if (users[email]) throw new Error("Un compte existe déjà avec cet email.");
      const ph = await hash(password);
      users[email] = { email, name: name || email.split("@")[0], ph, created: Date.now(), premium: false };
      save("rdb_users_db_v1", users);
      this.user = { email, name: users[email].name, premium: false, provider: "local" };
      save(KEY_USER, this.user);
      return this.user;
    },

    async login(email, password) {
      email = String(email || "").trim().toLowerCase();
      const sb = await initSupabase();
      if (sb) {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message);
        if (data.user) await this._fromSupabaseUser(data.user);
        return this.user;
      }
      const users = load("rdb_users_db_v1", {});
      const u = users[email];
      if (!u) throw new Error("Compte introuvable.");
      if ((await hash(password)) !== u.ph) throw new Error("Mot de passe incorrect.");
      this.user = { email: u.email, name: u.name, premium: !!u.premium, provider: "local" };
      if (u.premium) this.grantPremium("local", true);
      save(KEY_USER, this.user);
      return this.user;
    },

    async logout() {
      const sb = await initSupabase();
      if (sb) await sb.auth.signOut();
      this.user = null;
      localStorage.removeItem(KEY_USER);
      window.dispatchEvent(new CustomEvent("rdb:auth"));
    },

    grantPremium(source, silent) {
      this.premium = true;
      save(KEY_PREMIUM, { at: Date.now(), source: source || "stripe" });
      if (this.user) {
        this.user.premium = true;
        save(KEY_USER, this.user);
        const users = load("rdb_users_db_v1", {});
        if (this.user.email && users[this.user.email]) {
          users[this.user.email].premium = true;
          save("rdb_users_db_v1", users);
        }
      }
      if (!silent) window.dispatchEvent(new CustomEvent("rdb:premium"));
    },

    usageToday() {
      const d = new Date().toISOString().slice(0, 10);
      const u = load(KEY_USAGE, {});
      if (u.day !== d) return { day: d, count: 0 };
      return u;
    },
    canAnalyzeFull() {
      if (this.isPremium()) return { ok: true, reason: "premium" };
      const limit = CFG().FREE_ANALYSES_PER_DAY ?? 1;
      const u = this.usageToday();
      if (u.count < limit) return { ok: true, reason: "free", remaining: limit - u.count };
      return { ok: false, reason: "quota", remaining: 0 };
    },
    consumeAnalysis() {
      if (this.isPremium()) return;
      const d = new Date().toISOString().slice(0, 10);
      const u = this.usageToday();
      save(KEY_USAGE, { day: d, count: (u.day === d ? u.count : 0) + 1 });
    },

    /** Stripe Checkout via Pages Function */
    async openCheckout() {
      try {
        const res = await fetch("/stripe-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: this.user?.email || "",
            userId: this.user?.id || "",
          }),
        });
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
          return;
        }
        // Fallback démo si pas de clé Stripe serveur
        if (!res.ok) {
          if (confirm("Stripe non configuré (STRIPE_SECRET_KEY).\n\nSimuler l'achat Premium 20 € pour tester ?")) {
            this.grantPremium("demo");
            alert("Premium activé (démo).");
            window.dispatchEvent(new CustomEvent("rdb:auth"));
          }
        }
      } catch (e) {
        if (confirm("Impossible de joindre /stripe-checkout.\nSimuler Premium (démo) ?")) {
          this.grantPremium("demo");
        }
      }
    },

    checkUnlockParam() {
      const p = new URLSearchParams(location.search);
      if (p.get("rdb_unlocked") === "1") {
        this.grantPremium("stripe");
        history.replaceState({}, "", location.pathname);
        return true;
      }
      return false;
    },
  };

  window.RDB_AUTH = Auth;
  // auto-init
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => Auth.init());
  } else {
    Auth.init();
  }
})();
