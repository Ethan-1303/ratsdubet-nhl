/**
 * Fonction Cloudflare Pages — proxy NHL + Actualités
 * GET /api?path=...
 * GET /api?news=1
 */
const NHL_STATS = "https://api.nhle.com";
const NHL_WEB = "https://api-web.nhle.com";
const ESPN_NEWS = "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/news";
const GOOGLE_RSS = "https://news.google.com/rss/search?q=NHL+hockey&hl=fr&gl=FR&ceid=FR:fr";
const GOOGLE_RSS_EN = "https://news.google.com/rss/search?q=NHL&hl=en-US&gl=US&ceid=US:en";

export async function onRequest(context) {
  const req = context.request;
  si (req.method === "OPTIONS") {
    renvoie une nouvelle réponse(null, { statut: 204, en-têtes: cors() });
  }

  const url = nouvelle URL(req.url);

  si (url.searchParams.get("news") === "1") {
    const articles = await fetchNews();
    return json({ articles, updated: new Date().toISOString(), count: articles.length });
  }

  const path = url.searchParams.get("path");
  if (!path) return json({ error: "Paramètre de chemin manquant" }, 400);

  soit targetBase = NHL_STATS;
  soit targetPath = chemin;

  si (chemin.commencePar("api-web.nhle.com/")) {
    targetBase = NHL_WEB;
    targetPath = path.replace(/^api-web\.nhle\.com/, "") || "/";
  } else if (path.startsWith("api.nhle.com/")) {
    targetBase = STATISTIQUES_NHL;
    targetPath = path.replace(/^api\.nhle\.com/, "") || "/";
  } else if (!path.startsWith("/")) {
    chemin cible = "/" + chemin;
  }

  const targetUrl = new URL(targetPath, targetBase);
  pour (const [k, v] de url.searchParams.entries()) {
    si (k !== "chemin" && k !== "actualités") targetUrl.searchParams.set(k, v);
  }

  essayer {
    const upstream = await fetch(targetUrl.toString(), {
      en-têtes : { Accept : "application/json", "User-Agent : "RATSDUBET-NHL-RDB/1.3" },
      cf: { cacheTtl: 90, cacheEverything: true },
    });
    const corps = await upstream.text();
    const contentType = upstream.headers.get("content-type") || "application/json";
    retourner une nouvelle réponse(corps, {
      statut : upstream.status,
      en-têtes : { "Content-Type": contentType, ...cors(), "Cache-Control": "public, max-age=90" },
    });
  } attraper (erreur) {
    return json({ error: "Échec de la récupération en amont", message: String(err) }, 502);
  }
}

fonction asynchrone fetchNews() {
  const sources = [fromEspn, fromGoogleRss, fromScoreboard];
  pour (const fn de sources) {
    essayer {
      const arts = await fn();
      si (arts && arts.length) retourner arts.slice(0, 20);
    } attraper (_) {}
  }
  retour [];
}

fonction asynchrone fromEspn() {
  const up = await fetch(ESPN_NEWS, {
    en-têtes : {
      Accepter : "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; RATSDUBET/1.3)",
    },
  });
  const ct = up.headers.get("content-type") || "";
  if (!ct.includes("json")) throw new Error("espn not json");
  const data = await up.json();
  retourner (data.articles || []).map((a) => ({
    id : Chaîne(a.id || a.headline),
    titre : a.headline || a.title || "",
    description: a.description || "",
    publié : a.publié || a.lastModified || "",
    url: a.links?.web?.href || a.links?.web?.self?.href || "https://www.nhl.com/news",
    image: a.images?.[0]?.url || null,
    source : « ESPN NHL »,
  })).filter((a) => a.title);
}

fonction asynchrone fromGoogleRss() {
  soit xml = "";
  pour (const flux de [GOOGLE_RSS, GOOGLE_RSS_EN]) {
    essayer {
      const up = await fetch(feed, {
        en-têtes : {
          Accepter : "application/rss+xml, application/xml, text/xml, */*",
          "User-Agent": "Mozilla/5.0 (compatible; RATSDUBET/1.3)",
        },
      });
      xml = await up.text();
      if (xml.includes("<item>")) break;
    } attraper (_) {}
  }
  if (!xml.includes("<item>")) throw new Error("aucun élément RSS");

  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/gi;
  soit m;
  tant que ((m = re.exec(xml)) && items.length < 20) {
    bloc constant = m[1];
    const titre = décoderXml(pickTag(bloc, "titre"));
    let link = pickTag(block, "link");
    const pub = pickTag(bloc, "pubDate");
    const desc = decodeXml(stripTags(pickTag(block, "description")));
    const source = pickTag(block, "source") || "Google News";
    si (!titre) continuer ;
    Google ajuste les liens en conséquence ; privilégier le titre et le site source lorsque cela est possible.
    si (lien && lien.includes("news.google.com")) {
      // Conserver la redirection Google ; les utilisateurs peuvent l'ouvrir
    }
    articles.push({
      id : lien || titre,
      titre : title.replace(/\s+-\s+[^-]+$/, (s) => s), // conserver la source dans le titre
      description: desc.slice(0, 220),
      publié : pub ? nouvelle Date(pub).toISOString() : "",
      URL : lien || « https://www.nhl.com/news »,
      image : nulle,
      source: source || "Google News · NHL",
    });
  }
  retourner les articles;
}

fonction asynchrone fromScoreboard() {
  const up = await fetch(`${NHL_WEB}/v1/scoreboard/now`, {
    en-têtes : { Accept : "application/json", "User-Agent : "RATSDUBET-NHL/1.3" },
  });
  const data = await up.json();
  const arts = [];
  pour (const jour de data.gamesByDate || []) {
    pour (const g de jour.jeux || []) {
      const home = g.homeTeam?.abbrev || g.homeTeam?.name?.default || "?";
      const away = g.awayTeam?.abbrev || g.awayTeam?.name?.default || "?";
      const hs = g.homeTeam?.score;
      const as = g.awayTeam?.score;
      const état = g.gameState || g.gameScheduleState || "";
      const titre =
        Nombre.estFinition(hs) && Nombre.estFinition(as)
          ? `${away} ${as} – ${hs} ${home}`
          : `${away} @ ${home}`;
      arts.push({
        id : Chaîne(g.id || titre),
        titre : `NHL · ${title}`,
        description : `${jour.date || ""} · ${state} · Clique pour le centre de match NHL`,
        publié : g.startTimeUTC || jour.date || "",
        URL : g.gameCenterLink
          ? `https://www.nhl.com${g.gameCenterLink}`
          : "https://www.nhl.com/scores",
        image : nulle,
        source : « Tableau de bord de la LNH »,
      });
    }
  }
  if (!arts.length) throw new Error("pas de jeux");
  retour aux arts;
}

fonction pickTag(bloc, étiquette) {
  const m = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i"))
    || block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  retourner m ? m[1].trim() : "";
}
fonction stripTags(s) {
  retourner String(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
fonction décoderXml(s) {
  renvoie String(s || "")
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/'/g, "'")
    .replace(/'/g, "'");
}

fonction cors() {
  retour {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
fonction json(données, statut = 200) {
  retourner une nouvelle réponse(JSON.stringify(données), {
    statut,
    en-têtes : { "Content-Type": "application/json", ...cors(), "Cache-Control": "public, max-age=120" },
  });
}
