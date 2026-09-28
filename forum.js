/**
 * BETZONE Forum — Supabase (forum_posts) + fallback localStorage
 */
(function () {
  const LOCAL_KEY = "rdb_forum_v1";
  const TYPES = {
    discussion: { label: "Discussion", cls: "t-disc" },
    ticket: { label: "Ticket du jour", cls: "t-ticket" },
    win: { label: "Gagnant", cls: "t-win" },
    loss: { label: "Perdant", cls: "t-loss" },
  };

  function loadLocal() {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]"); } catch { return []; }
  }
  function saveLocal(arr) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(arr.slice(0, 200)));
  }

  async function getSb() {
    const CFG = window.RDB_CONFIG || {};
    if (!CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY) return null;
    try {
      const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
      return createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
    } catch { return null; }
  }

  let filter = "all";

  async function fetchPosts() {
    const sb = await getSb();
    if (sb) {
      try {
        const { data, error } = await sb
          .from("forum_posts")
          .select("id,type,title,body,author_name,author_id,created_at")
          .order("created_at", { ascending: false })
          .limit(80);
        if (!error && data) return data.map(normalize);
      } catch (_) {}
    }
    return loadLocal().map(normalize);
  }

  function normalize(p) {
    return {
      id: p.id || crypto.randomUUID?.() || String(Date.now()),
      type: p.type || "discussion",
      title: p.title || "",
      body: p.body || "",
      author_name: p.author_name || p.author || "Anonyme",
      author_id: p.author_id || "",
      created_at: p.created_at || p.ts || new Date().toISOString(),
    };
  }

  async function createPost({ type, title, body }) {
    const A = window.RDB_AUTH;
    if (!A?.isLoggedIn?.()) throw new Error("Connecte-toi pour publier.");
    const author_name = A.user?.name || A.user?.email?.split("@")[0] || "Membre";
    const author_id = A.user?.id || "";
    const row = {
      type: type || "discussion",
      title: (title || "").trim().slice(0, 120),
      body: (body || "").trim().slice(0, 2000),
      author_name,
      author_id,
      created_at: new Date().toISOString(),
    };
    if (!row.title || !row.body) throw new Error("Titre et message obligatoires.");

    const sb = await getSb();
    if (sb && author_id) {
      try {
        const { data, error } = await sb.from("forum_posts").insert({
          type: row.type,
          title: row.title,
          body: row.body,
          author_name: row.author_name,
          author_id: row.author_id,
        }).select().single();
        if (!error && data) return normalize(data);
      } catch (_) {}
    }
    // local fallback
    row.id = "local_" + Date.now();
    const list = loadLocal();
    list.unshift(row);
    saveLocal(list);
    return normalize(row);
  }

  function renderList(posts) {
    const el = document.getElementById("forumFeed");
    if (!el) return;
    let list = posts;
    if (filter !== "all") list = posts.filter((p) => p.type === filter);
    if (!list.length) {
      el.innerHTML = `<div class="empty-inline">Aucun message pour ce filtre.<br><small>Sois le premier à poster un ticket ou une discussion.</small></div>`;
      return;
    }
    el.innerHTML = list.map((p) => {
      const t = TYPES[p.type] || TYPES.discussion;
      const d = new Date(p.created_at);
      const when = isNaN(d) ? "" : d.toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
      const body = (p.body || "").replace(/</g, "&lt;").replace(/\n/g, "<br>");
      const title = (p.title || "").replace(/</g, "&lt;");
      return `<article class="forum-card ${t.cls}">
        <div class="forum-card-top">
          <span class="forum-badge ${t.cls}">${t.label}</span>
          <time>${when}</time>
        </div>
        <h3>${title}</h3>
        <div class="forum-body">${body}</div>
        <div class="forum-meta">👤 ${p.author_name}</div>
      </article>`;
    }).join("");
  }

  async function refresh() {
    const el = document.getElementById("forumFeed");
    if (el) el.innerHTML = `<div class="empty-inline">Chargement du forum…</div>`;
    try {
      const posts = await Promise.race([
        fetchPosts(),
        new Promise((_, rej) => setTimeout(() => rej(new Error("Délai dépassé")), 8000))
      ]);
      renderList(posts || []);
    } catch (e) {
      // fallback local
      try {
        const local = loadLocal().map(normalize);
        if (local.length) { renderList(local); return; }
      } catch (_) {}
      if (el) el.innerHTML = `<div class="empty-inline">Aucun message pour l'instant.<br><small>${e.message || e}</small></div>`;
    }
  }

  function setup() {
    document.querySelectorAll(".forum-filter").forEach((b) => {
      b.onclick = () => {
        document.querySelectorAll(".forum-filter").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        filter = b.dataset.filter || "all";
        refresh();
      };
    });
    const form = document.getElementById("forumForm");
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const err = document.getElementById("forumError");
        if (err) err.textContent = "";
        const type = document.getElementById("forumType")?.value || "discussion";
        const title = document.getElementById("forumTitle")?.value || "";
        const body = document.getElementById("forumBody")?.value || "";
        try {
          await createPost({ type, title, body });
          form.reset();
          await refresh();
        } catch (ex) {
          if (err) err.textContent = ex.message || String(ex);
        }
      };
    }
    document.getElementById("refreshForum")?.addEventListener("click", () => refresh());
  }

  window.RDB_FORUM = { refresh, setup, createPost };
})();
