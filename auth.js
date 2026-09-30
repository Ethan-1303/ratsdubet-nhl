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


  const LEVELS = [
    { id: 0, key: "nouveau", name: "Nouveau Rat", short: "Nouveau", emoji: "🐀", cls: "lv-0" },
    { id: 1, key: "confirme", name: "Rat confirmé", short: "Confirmé", emoji: "🐀", cls: "lv-1" },
    { id: 2, key: "meute", name: "Rat de la meute", short: "Meute", emoji: "🐺", cls: "lv-2" },
    { id: 3, key: "premium", name: "Rat premium", short: "Premium", emoji: "⭐", cls: "lv-3" },
    { id: 4, key: "elite", name: "Rat élite", short: "Élite", emoji: "👑", cls: "lv-4" },
    { id: 5, key: "chef", name: "Chef de meute", short: "Chef", emoji: "🏆", cls: "lv-5" },
  ];

  function computeLevel({ isAdmin, premium, trialActive, postsCount, ticketsCount }) {
    if (isAdmin) return 5;
    const posts = postsCount || 0;
    const tickets = ticketsCount || 0;
    const lifePrem = !!premium && !trialActive;
    if (lifePrem && posts >= 20) return 4;
    if (lifePrem) return 3;
    if (posts >= 10 || tickets >= 5) return 2;
    if (posts >= 3 || trialActive) return 1;
    return 0;
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
          if (session?.user) {
            await this._fromSupabaseUser(session.user);
            if (event === "SIGNED_IN" || event === "USER_UPDATED") {
              // possible confirmation email
              const meta = session.user.email_confirmed_at || session.user.confirmed_at;
              if (meta && !sessionStorage.getItem("rdb_email_ok_shown")) {
                // ne pas double-afficher si redirect déjà géré
              }
            }
          } else if (event === "SIGNED_OUT") {
            this.user = null;
            localStorage.removeItem(KEY_USER);
          }
          window.dispatchEvent(new CustomEvent("rdb:auth"));
        });
      }
      // Après clic lien validation email / reset MDP
      try {
        if (sb) await this._handleAuthRedirect(sb);
      } catch (e) { console.warn("auth redirect", e); }
      this.checkUnlockParam();
      // Réactive essai 48h si encore valide
      try {
        const meta = load(KEY_PREMIUM, null);
        if (meta && meta.source === "trial48h" && meta.expires && Date.now() <= meta.expires) {
          this.premium = true;
        } else if (meta && meta.source === "trial48h" && meta.expires && Date.now() > meta.expires) {
          this.premium = false;
        }
      } catch (_) {}
      this.ready = true;
      window.dispatchEvent(new CustomEvent("rdb:auth"));
    },

    async _fromSupabaseUser(u) {
      let premium = this.premium;
      try {
        const sb = await initSupabase();
        const { data } = await sb.from("profiles")
          .select("premium,name,email,trial_expires,posts_count,tickets_count,level,is_admin")
          .eq("id", u.id).maybeSingle();
        const name = data?.name || u.user_metadata?.name || u.email?.split("@")[0];
        const trialExp = data?.trial_expires ? new Date(data.trial_expires).getTime() : null;

        if (data?.premium && trialExp && trialExp > Date.now()) {
          // Essai 48h encore valide (multi-appareils)
          this.premium = true;
          save(KEY_PREMIUM, { at: Date.now(), expires: trialExp, source: "trial48h" });
          premium = true;
        } else if (data?.premium && !trialExp) {
          // Premium à vie
          this.grantPremium("supabase", true);
          premium = true;
        } else if (data?.premium && trialExp && trialExp <= Date.now()) {
          // Essai expiré côté serveur
          this.premium = false;
          premium = false;
          save(KEY_PREMIUM, { at: Date.now(), expires: trialExp, source: "trial48h" });
        }

        if (data?.posts_count != null) {
          this.user_posts = data.posts_count;
          save("rdb_posts_count_v1", data.posts_count);
        }
        if (data?.tickets_count != null) save("rdb_tickets_count_v1", data.tickets_count);
        this.user = {
          id: u.id,
          email: u.email,
          name,
          premium,
          trialExpires: trialExp || null,
          posts_count: data?.posts_count || load("rdb_posts_count_v1", 0),
          tickets_count: data?.tickets_count || load("rdb_tickets_count_v1", 0),
          level: data?.level,
          is_admin: !!data?.is_admin,
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

    getPostsCount() { return this.user?.posts_count || load("rdb_posts_count_v1", 0) || 0; },
    getTicketsCount() { return this.user?.tickets_count || load("rdb_tickets_count_v1", 0) || 0; },
    isAdmin() {
      const chefs = (CFG().CHEF_EMAILS || []).map((e) => String(e).toLowerCase());
      const email = (this.user?.email || "").toLowerCase();
      if (email && chefs.includes(email)) return true;
      return !!this.user?.is_admin;
    },
    getLevel() {
      return computeLevel({
        isAdmin: this.isAdmin(),
        premium: this.isPremium() && !this.isTrialActive?.(),
        trialActive: !!this.isTrialActive?.(),
        postsCount: this.getPostsCount(),
        ticketsCount: this.getTicketsCount(),
      });
    },
    getLevelInfo() {
      const id = this.getLevel();
      return LEVELS[id] || LEVELS[0];
    },
    async bumpActivity(type) {
      let posts = this.getPostsCount();
      let tickets = this.getTicketsCount();
      posts += 1;
      if (type === "ticket" || type === "win" || type === "loss") tickets += 1;
      save("rdb_posts_count_v1", posts);
      save("rdb_tickets_count_v1", tickets);
      if (this.user) {
        this.user.posts_count = posts;
        this.user.tickets_count = tickets;
        this.user.level = this.getLevel();
        save(KEY_USER, this.user);
      }
      await this._syncProfilePremium({
        premium: this.isPremium() && !this.isTrialActive?.(),
        trial_expires: this.isTrialActive?.()
          ? new Date(Date.now() + (this.trialRemainingMs?.() || 0)).toISOString()
          : (load(KEY_PREMIUM, null)?.source === "trial48h" ? load(KEY_PREMIUM).expires : null),
        posts_count: posts,
        tickets_count: tickets,
        level: this.getLevel(),
      });
      window.dispatchEvent(new CustomEvent("rdb:auth"));
    },

    isPremium() {
      const meta = load(KEY_PREMIUM, null);
      if (meta && meta.source === "trial48h") {
        if (meta.expires && Date.now() <= meta.expires) {
          this.premium = true;
          return true;
        }
        // essai expiré
        this.premium = false;
        if (this.user) this.user.premium = false;
        this._trialEnded = true;
        return false;
      }
      // Premium à vie (stripe / demo / supabase)
      if (meta && (meta.source === "stripe" || meta.source === "demo" || meta.source === "supabase" || meta.source === "local" || !meta.expires)) {
        if (this.premium || this.user?.premium || meta.at) return true;
      }
      return !!(this.premium || this.user?.premium);
    },
    trialRemainingMs() {
      const meta = load(KEY_PREMIUM, null);
      if (!meta || meta.source !== "trial48h" || !meta.expires) return 0;
      return Math.max(0, meta.expires - Date.now());
    },
    isTrialActive() {
      return this.trialRemainingMs() > 0;
    },
    hasTrialEnded() {
      const meta = load(KEY_PREMIUM, null);
      if (meta && meta.source === "trial48h" && meta.expires && Date.now() > meta.expires) return true;
      return !!this._trialEnded;
    },
    grantTrial48h(silent) {
      const expires = Date.now() + 48 * 3600 * 1000;
      this.premium = true;
      save(KEY_PREMIUM, { at: Date.now(), expires, source: "trial48h" });
      if (this.user) {
        this.user.premium = true;
        this.user.trialExpires = expires;
        save(KEY_USER, this.user);
      }
      // Sync multi-appareils Supabase
      this._syncProfilePremium({ premium: true, trial_expires: new Date(expires).toISOString() });
      if (!silent) window.dispatchEvent(new CustomEvent("rdb:premium"));
    },
    async _syncProfilePremium({ premium, trial_expires, posts_count, tickets_count, level }) {
      try {
        if (!this.user?.id || this.user.provider !== "supabase") return;
        const sb = await initSupabase();
        if (!sb) return;
        const row = {
          id: this.user.id,
          email: this.user.email,
          name: this.user.name,
          premium: !!premium,
        };
        if (trial_expires !== undefined) {
          row.trial_expires = trial_expires
            ? (typeof trial_expires === "number" ? new Date(trial_expires).toISOString() : trial_expires)
            : null;
        }
        if (posts_count != null) row.posts_count = posts_count;
        if (tickets_count != null) row.tickets_count = tickets_count;
        if (level != null) row.level = level;
        await sb.from("profiles").upsert(row);
      } catch (e) { console.warn("sync profile", e); }
    },
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
        this.grantTrial48h(true);
        window.dispatchEvent(new CustomEvent("rdb:auth"));
        return this.user;
      }

      // Fallback local
      const users = load("rdb_users_db_v1", {});
      if (users[email]) throw new Error("Un compte existe déjà avec cet email.");
      const ph = await hash(password);
      users[email] = { email, name: name || email.split("@")[0], ph, created: Date.now(), premium: false, trialStarted: Date.now() };
      save("rdb_users_db_v1", users);
      this.user = { email, name: users[email].name, premium: false, provider: "local" };
      save(KEY_USER, this.user);
      this.grantTrial48h(true);
      window.dispatchEvent(new CustomEvent("rdb:auth"));
      return this.user;
    },

    async resetPassword(email) {
      email = String(email || "").trim().toLowerCase();
      if (!email) throw new Error("Indique ton email.");
      const sb = await initSupabase();
      if (!sb) throw new Error("Réinitialisation disponible uniquement avec le compte en ligne (Supabase).");
      const redirectTo = (CFG().SITE_URL || window.location.origin || "https://betzone-rdb.com").replace(/\/$/, "") + "/";
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw new Error(error.message || "Impossible d'envoyer l'email.");
      return true;
    },

    async updatePassword(newPassword) {
      if (!newPassword || String(newPassword).length < 6)
        throw new Error("Mot de passe : 6 caractères minimum.");
      const sb = await initSupabase();
      if (!sb) throw new Error("Session Supabase requise.");
      const { error } = await sb.auth.updateUser({ password: newPassword });
      if (error) throw new Error(error.message || "Impossible de changer le mot de passe.");
      return true;
    },

    async login(email, password) {
      email = String(email || "").trim().toLowerCase();
      const sb = await initSupabase();
      if (sb) {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) {
          const msg = (error.message || "").toLowerCase();
          if (msg.includes("email not confirmed") || msg.includes("not confirmed"))
            throw new Error("Email non validé. Ouvre le lien reçu par mail (et les spams), puis reconnecte-toi.");
          if (msg.includes("invalid login") || msg.includes("invalid credentials"))
            throw new Error("Email ou mot de passe incorrect. Vérifie aussi que tu as bien validé ton email.");
          throw new Error(error.message);
        }
        if (data.user) await this._fromSupabaseUser(data.user);
        // session après validation email
        try {
          await sb.from("profiles").upsert({
            id: data.user.id,
            email: data.user.email,
            name: this.user?.name || data.user.email?.split("@")[0],
          });
        } catch {}
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
      save(KEY_PREMIUM, { at: Date.now(), source: source || "stripe", expires: null });
      if (this.user) {
        this.user.premium = true;
        this.user.trialExpires = null;
        save(KEY_USER, this.user);
        const users = load("rdb_users_db_v1", {});
        if (this.user.email && users[this.user.email]) {
          users[this.user.email].premium = true;
          save("rdb_users_db_v1", users);
        }
      }
      this._syncProfilePremium({ premium: true, trial_expires: null });
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
            promoCode: (document.getElementById("promoCode")?.value || "").trim(),
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


    async _handleAuthRedirect(sb) {
      const hash = window.location.hash || "";
      const search = window.location.search || "";
      const full = (hash + "&" + search).toLowerCase();
      const isRecovery = full.includes("type=recovery");
      const isSignup = full.includes("type=signup") || full.includes("type=email") || full.includes("type=magiclink");
      const hasToken = full.includes("access_token") || full.includes("refresh_token") || search.includes("code=");

      if (search.includes("code=")) {
        try {
          const { data, error } = await sb.auth.exchangeCodeForSession(window.location.href);
          if (error) console.warn("exchangeCode", error);
          else if (data?.session?.user) await this._fromSupabaseUser(data.session.user);
        } catch (e) { console.warn(e); }
      } else if (hasToken || isSignup || isRecovery) {
        await new Promise((r) => setTimeout(r, 200));
        const { data: sess } = await sb.auth.getSession();
        if (sess?.session?.user) await this._fromSupabaseUser(sess.session.user);
      }

      if (isRecovery) {
        window.dispatchEvent(new CustomEvent("rdb:password-recovery"));
      } else if (isSignup || (hasToken && this.user && !isRecovery)) {
        try { this.grantTrial48h(true); } catch (_) {}
        window.dispatchEvent(new CustomEvent("rdb:email-confirmed", {
          detail: { email: this.user?.email || "", name: this.user?.name || "" }
        }));
      }

      if (hasToken || isSignup || isRecovery || search.includes("code=")) {
        try { history.replaceState({}, "", location.pathname); } catch {}
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
  window.RDB_LEVELS = LEVELS;
  window.RDB_computeLevel = computeLevel;
  // auto-init
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => Auth.init());
  } else {
    Auth.init();
  }
})();
