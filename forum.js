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
  const LIKES_KEY = "rdb_forum_likes_v1";
  function loadLikes(){ try{ return JSON.parse(localStorage.getItem(LIKES_KEY)||"{}"); }catch{ return {}; } }
  function saveLikes(o){ localStorage.setItem(LIKES_KEY, JSON.stringify(o)); }
  function toggleLike(id){
    const o=loadLikes();
    o[id]=o[id]||{count:0,me:false};
    if(o[id].me){ o[id].count=Math.max(0,(o[id].count||1)-1); o[id].me=false; }
    else { o[id].count=(o[id].count||0)+1; o[id].me=true; }
    saveLikes(o);
    return o[id];
  }

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

  function levelBadgeHtml(levelId) {
    const L = (window.RDB_LEVELS || [])[levelId] || { name: "Nouveau Rat", emoji: "🐀", cls: "lv-0", short: "Nouveau" };
    return `<span class="level-badge ${L.cls}" title="${L.name}">${L.emoji} ${L.short}</span>`;
  }
  function levelForAuthor(posts, authorId, authorName) {
    const mine = window.RDB_AUTH?.user;
    if (mine && ((authorId && mine.id === authorId) || (authorName && mine.name === authorName))) {
      return window.RDB_AUTH.getLevel?.() ?? 0;
    }
    const list = (posts || []).filter((p) =>
      (authorId && p.author_id === authorId) ||
      (authorName && p.author_name === authorName)
    );
    const postsCount = list.length;
    const ticketsCount = list.filter((p) => ["ticket", "win", "loss"].includes(p.type)).length;
    return (window.RDB_computeLevel || (() => 0))({
      isAdmin: false,
      premium: false,
      trialActive: false,
      postsCount,
      ticketsCount,
    });
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
    // 1) Cloudflare function (partagé pour tous)
    try {
      const r = await fetch("/forum-post");
      if (r.ok) {
        const j = await r.json();
        if (Array.isArray(j.posts)) remote = j.posts.map(normalize);
      }
    } catch (e) { console.warn("forum-post get", e); }
    // 2) Fallback direct Supabase
    if (!remote.length) {
      const sb = await getSb();
      if (sb) {
        try {
          const { data, error } = await sb
            .from("forum_posts")
            .select("id,type,title,body,image_url,author_name,author_id,created_at")
            .order("created_at", { ascending: false })
            .limit(80);
          if (!error && Array.isArray(data)) remote = data.map(normalize);
        } catch (e) { console.warn(e); }
      }
    }
    const seen = new Set(remote.map(p => String(p.id)));
    for (const p of local) {
      if (!seen.has(String(p.id))) remote.push(p);
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
    if (!logged) throw new Error("Crée un compte ou connecte-toi (bouton en haut à droite) pour publier.");
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
    try { await window.RDB_AUTH?.bumpActivity?.(row.type); } catch (_) {}

    // Publication partagée via Cloudflare → Supabase (tous les membres voient)
    try {
      const payload = {
        type: row.type,
        title: row.title,
        body: row.body,
        author_name: row.author_name,
        image_url: row.image_url && String(row.image_url).startsWith("http") ? row.image_url : null,
      };
      const res = await fetch("/forum-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.post) {
        const n = normalize(j.post);
        if (row.image_url && String(row.image_url).startsWith("data:") && !n.image_url) n.image_url = row.image_url;
        return n;
      }
      console.warn("forum-post", j.error || res.status);
    } catch (e) { console.warn(e); }

    // Fallback Supabase client si session
    const sb = await getSb();
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (sb && author_id && uuidRe.test(author_id)) {
      try {
        const payload = {
          type: row.type, title: row.title, body: row.body,
          author_name: row.author_name, author_id: row.author_id,
          image_url: row.image_url && String(row.image_url).startsWith("http") ? row.image_url : null,
        };
        const { data, error } = await sb.from("forum_posts").insert(payload).select().single();
        if (!error && data) {
          const n = normalize(data);
          if (row.image_url && String(row.image_url).startsWith("data:") && !n.image_url) n.image_url = row.image_url;
          return n;
        }
      } catch (e) { console.warn(e); }
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
      const likes=loadLikes()[p.id]||{count:0,me:false};
      const pin = p.type==="ticket" ? " forum-pin" : "";
      return `<article class="forum-card ${t.cls}${pin}" data-id="${p.id}">
        <div class="forum-card-top">
          <span class="forum-badge ${t.cls}">${t.label}</span>
          ${p.type==="ticket"?`<span class="forum-pin-tag">📌 Ticket du jour</span>`:""}
          <time>${when}</time>
        </div>
        <h3>${title}</h3>
        <div class="forum-body">${body}</div>
        ${img}
        <div class="forum-meta">
          <span class="forum-author">👤 ${p.author_name} ${levelBadgeHtml(levelForAuthor(allPosts, p.author_id, p.author_name))}</span>
          <button type="button" class="forum-like ${likes.me?"on":""}" data-like="${p.id}">♥ ${likes.count||0}</button>
        </div>
      </article>`;
    }).join("");
  }

  function updateSocial(posts) {
    const el = document.getElementById("forumSocial");
    if (!el) return;
    const day = new Date().toISOString().slice(0, 10);
    const today = (posts || []).filter((p) => String(p.created_at || "").slice(0, 10) === day);
    const tickets = today.filter((p) => p.type === "ticket" || p.type === "win" || p.type === "loss");
    const n = tickets.length || today.filter((p) => p.type === "ticket").length;
    const totalToday = today.length;
    if (totalToday === 0) {
      el.textContent = "Meute calme pour l’instant — sois le premier à partager un ticket.";
    } else {
      el.innerHTML = `<b>${n}</b> ticket${n > 1 ? "s" : ""} partagé${n > 1 ? "s" : ""} aujourd’hui · <b>${totalToday}</b> message${totalToday > 1 ? "s" : ""} dans la meute`;
    }
  }

  async function refresh() {
    const el = document.getElementById("forumFeed");
    if (el) el.innerHTML = `<div class="skeleton-stack">${[1,2,3].map(()=>`<div class="skeleton-card"><div class="sk-line w40"></div><div class="sk-line"></div><div class="sk-line w70"></div></div>`).join("")}</div>`;
    try {
      const posts = await Promise.race([
        fetchPosts(),
        new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 6000)),
      ]);
      updateSocial(posts || []);
      renderList(posts || []);
      el?.querySelectorAll("[data-like]").forEach(btn=>{
        btn.onclick=()=>{
          const id=btn.getAttribute("data-like");
          const L=toggleLike(id);
          btn.textContent="♥ "+(L.count||0);
          btn.classList.toggle("on", !!L.me);
        };
      });
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
