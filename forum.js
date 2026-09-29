/**
 * BETZONE Forum — Supabase + images (Storage) + fallback local
 */
(function () {
  const LOCAL_KEY = "rdb_forum_v1";
  const TYPES = {
    discussion: { label: "Discussion", cls: "t-disc" },
    ticket: { label: "Ticket du jour", cls: "t-ticket" },
    win: { label: "Gagnant", cls: "t-win" },
    loss: { label: "Perdant", cls: "t-loss" },
  };

  let filter = "all";
  let pendingDataUrl = null;

  function loadLocal() {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]"); } catch { return []; }
  }
  function saveLocal(arr) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(arr.slice(0, 100)));
  }

  async function getSb() {
    const CFG = window.RDB_CONFIG || {};
    if (!CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY) return null;
    try {
      const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
      return createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
    } catch (e) {
      console.warn("Supabase load failed", e);
      return null;
    }
  }

  function normalize(p) {
    return {
      id: p.id || ("local_" + Date.now()),
      type: p.type || "discussion",
      title: p.title || "",
      body: p.body || "",
      image_url: p.image_url || p.imageUrl || null,
      author_name: p.author_name || p.author || "Anonyme",
      author_id: p.author_id || "",
      created_at: p.created_at || p.ts || new Date().toISOString(),
    };
  }

  async function fetchPosts() {
    const local = loadLocal().map(normalize);
    let remote = [];
    const sb = await getSb();
    if (sb) {
      try {
        const { data, error } = await sb
          .from("forum_posts")
          .select("id,type,title,body,image_url,author_name,author_id,created_at")
          .order("created_at", { ascending: false })
          .limit(80);
        if (error) console.warn("forum fetch", error);
        else if (Array.isArray(data)) remote = data.map(normalize);
      } catch (e) {
        console.warn(e);
      }
    }
    // Merge remote + local (local fills gaps / offline posts)
    const seen = new Set(remote.map(p => p.id));
    for (const p of local) {
      if (!seen.has(p.id)) remote.push(p);
    }
    remote.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return remote;
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve(null);
      if (!file.type.startsWith("image/")) return reject(new Error("Fichier image uniquement (jpg, png, webp, gif)."));
      if (file.size > 3 * 1024 * 1024) return reject(new Error("Image max 3 Mo."));
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const max = 1200;
        let w = img.width, h = img.height;
        if (w > max || h > max) {
          const r = Math.min(max / w, max / h);
          w = Math.round(w * r); h = Math.round(h * r);
        }
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image illisible.")); };
      img.src = url;
    });
  }

  async function uploadImage(dataUrl, userId) {
    if (!dataUrl) return null;
    const sb = await getSb();
    if (!sb || !userId) return dataUrl; // local fallback: store data url in post body path

    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const path = `${userId}/${Date.now()}.jpg`;
      const { error } = await sb.storage.from("forum-images").upload(path, blob, {
        contentType: "image/jpeg",
        upsert: false,
      });
      if (error) {
        console.warn("storage upload", error);
        return dataUrl; // fallback inline
      }
      const { data } = sb.storage.from("forum-images").getPublicUrl(path);
      return data?.publicUrl || dataUrl;
    } catch (e) {
      console.warn(e);
      return dataUrl;
    }
  }

  async function createPost({ type, title, body, imageDataUrl }) {
    const A = window.RDB_AUTH;
    const logged = !!(A && (A.isLoggedIn?.() || A.user?.email || A.user?.name || A.user?.id));
    if (!logged) throw new Error("Connecte-toi pour publier (bouton compte en haut à droite).");
    const author_name = A.user?.name || A.user?.email?.split("@")[0] || "Membre";
    const author_id = A.user?.id || "";
    const row = {
      type: type || "discussion",
      title: (title || "").trim().slice(0, 120),
      body: (body || "").trim().slice(0, 2000),
      author_name,
      author_id,
      created_at: new Date().toISOString(),
      image_url: null,
    };
    if (!row.title || !row.body) throw new Error("Titre et message obligatoires.");

    if (imageDataUrl) {
      row.image_url = await uploadImage(imageDataUrl, author_id || "anon");
    }

    // Always persist local first (works without Supabase session)
    row.id = "local_" + Date.now();
    const list = loadLocal();
    list.unshift(row);
    saveLocal(list);
    console.log("forum post saved local", row.id, row.title);

    const sb = await getSb();
    // Try remote only with real UUID author from Supabase session
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (sb && author_id && uuidRe.test(author_id)) {
      try {
        const payload = {
          type: row.type,
          title: row.title,
          body: row.body,
          author_name: row.author_name,
          author_id: row.author_id,
          image_url: row.image_url && String(row.image_url).startsWith("http") ? row.image_url : null,
        };
        const { data, error } = await sb.from("forum_posts").insert(payload).select().single();
        if (!error && data) {
          // replace local entry id with remote id when possible
          const n = normalize(data);
          if (row.image_url && String(row.image_url).startsWith("data:") && !n.image_url) n.image_url = row.image_url;
          return n;
        }
        if (error) console.warn("insert", error);
      } catch (e) {
        console.warn(e);
      }
    }
    return normalize(row);
  }

  function renderList(posts) {
    const el = document.getElementById("forumFeed");
    if (!el) return;
    let list = posts || [];
    if (filter !== "all") list = list.filter((p) => p.type === filter);
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
      const img = p.image_url
        ? `<a class="forum-img-link" href="${p.image_url}" target="_blank" rel="noopener"><img class="forum-img" src="${p.image_url}" alt="" loading="lazy"></a>`
        : "";
      return `<article class="forum-card ${t.cls}">
        <div class="forum-card-top">
          <span class="forum-badge ${t.cls}">${t.label}</span>
          <time>${when}</time>
        </div>
        <h3>${title}</h3>
        <div class="forum-body">${body}</div>
        ${img}
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
        new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 6000)),
      ]);
      renderList(posts || []);
    } catch (e) {
      try {
        const local = loadLocal().map(normalize);
        if (local.length) return renderList(local);
      } catch (_) {}
      if (el) el.innerHTML = `<div class="empty-inline">Aucun message pour l'instant.<br><small>Tu peux publier ci-dessus (compte connecté).</small></div>`;
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

    const fileInput = document.getElementById("forumImage");
    const preview = document.getElementById("forumImagePreview");
    if (fileInput) {
      fileInput.onchange = async () => {
        const err = document.getElementById("forumError");
        if (err) err.textContent = "";
        pendingDataUrl = null;
        if (preview) preview.innerHTML = "";
        const f = fileInput.files && fileInput.files[0];
        if (!f) return;
        try {
          pendingDataUrl = await readFileAsDataURL(f);
          if (preview && pendingDataUrl) {
            preview.innerHTML = `<img src="${pendingDataUrl}" alt="Aperçu"><button type="button" class="ghost-btn" id="forumImageClear">Retirer</button>`;
            document.getElementById("forumImageClear").onclick = () => {
              pendingDataUrl = null;
              fileInput.value = "";
              preview.innerHTML = "";
            };
          }
        } catch (ex) {
          if (err) err.textContent = ex.message || String(ex);
          fileInput.value = "";
        }
      };
    }

    const form = document.getElementById("forumForm");
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const err = document.getElementById("forumError");
        if (err) err.textContent = "";
        const btn = form.querySelector('button[type="submit"]');
        if (btn) { btn.disabled = true; btn.textContent = "Publication…"; }
        try {
          await createPost({
            type: document.getElementById("forumType")?.value || "discussion",
            title: document.getElementById("forumTitle")?.value || "",
            body: document.getElementById("forumBody")?.value || "",
            imageDataUrl: pendingDataUrl,
          });
          form.reset();
          pendingDataUrl = null;
          if (preview) preview.innerHTML = "";
          filter = "all";
          document.querySelectorAll(".forum-filter").forEach(x => x.classList.toggle("active", (x.dataset.filter || "all") === "all"));
          await refresh();
          if (err) { err.style.color = "#00e676"; err.textContent = "Publié ✓"; setTimeout(()=>{err.textContent="";err.style.color="";}, 2500); }
        } catch (ex) {
          if (err) { err.style.color = "#ff8a80"; err.textContent = ex.message || String(ex); }
          console.error("forum publish", ex);
        } finally {
          if (btn) { btn.disabled = false; btn.textContent = "Publier"; }
        }
      };
    }
    document.getElementById("refreshForum")?.addEventListener("click", () => refresh());
  }

  window.RDB_FORUM = { refresh, setup, createPost };

  function boot() {
    try { setup(); } catch (e) { console.warn("forum setup", e); }
    try { refresh(); } catch (e) { console.warn("forum refresh", e); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
