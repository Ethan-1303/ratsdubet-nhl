/**
 * Fonction Cloudflare Pages — API proxy NHL
 * Éviter les restrictions CORS du navigateur.
 *
 * Côté client :
 * /api?path=stats/rest/en/team/summary&...
 * /api?path=api-web.nhle.com/v1/schedule/2026-09-25
 */

const NHL_STATS = "https://api.nhle.com";
const NHL_WEB = "https://api-web.nhle.com";

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.searchParams.get("path");

  si (!chemin) {
    return new Response(JSON.stringify({ error: "Paramètre de chemin manquant" }), {
      statut : 400,
      en-têtes : corsHeaders("application/json"),
    });
  }

  // Déterminez la base selon le préfixe du chemin
  soit targetBase = NHL_STATS;
  soit targetPath = chemin;

  si (chemin.commencePar("api-web.nhle.com/")) {
    targetBase = NHL_WEB;
    targetPath = path.replace(/^api-web\.nhle\.com/, "");
  } else if (path.startsWith("api.nhle.com/")) {
    targetBase = STATISTIQUES_NHL;
    targetPath = path.replace(/^api\.nhle\.com/, "");
  } else if (!path.startsWith("/")) {
    chemin cible = "/" + chemin;
  }

  // Reconstruit les paramètres de requête (sans "path")
  const targetUrl = new URL(targetPath, targetBase);
  pour (const [k, v] de url.searchParams.entries()) {
    si (k !== "chemin") targetUrl.searchParams.set(k, v);
  }

  essayer {
    const upstream = await fetch(targetUrl.toString(), {
      en-têtes : {
        Accepter : "application/json",
        "User-Agent": "RATSDUBET-NHL-RDB/1.0",
      },
      // Cache léger bord latéral
      cf: { cacheTtl: 60, cacheEverything: true },
    });

    const corps = await upstream.text();
    const contentType = upstream.headers.get("content-type") || "application/json";

    retourner une nouvelle réponse(corps, {
      statut : upstream.status,
      en-têtes : {
        ...Object.fromEntries(corsHeaders(contentType)),
        "Cache-Control": "public, max-age=60",
      },
    });
  } attraper (erreur) {
    retourner une nouvelle réponse(
      JSON.stringify({ error: "Échec de la récupération en amont", message: String(err) }),
      {
        statut : 502,
        en-têtes : corsHeaders("application/json"),
      }
    );
  }
}

fonction corsHeaders(contentType) {
  retour {
    "Content-Type" : contentType,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}/**
 * Fonction Cloudflare Pages — API proxy NHL
 * Éviter les restrictions CORS du navigateur.
 *
 * Côté client :
 * /api?path=stats/rest/en/team/summary&...
 * /api?path=api-web.nhle.com/v1/schedule/2026-09-25
 */

const NHL_STATS = "https://api.nhle.com";
const NHL_WEB = "https://api-web.nhle.com";

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.searchParams.get("path");

  si (!chemin) {
    return new Response(JSON.stringify({ error: "Paramètre de chemin manquant" }), {
      statut : 400,
      en-têtes : corsHeaders("application/json"),
    });
  }

  // Déterminez la base selon le préfixe du chemin
  soit targetBase = NHL_STATS;
  soit targetPath = chemin;

  si (chemin.commencePar("api-web.nhle.com/")) {
    targetBase = NHL_WEB;
    targetPath = path.replace(/^api-web\.nhle\.com/, "");
  } else if (path.startsWith("api.nhle.com/")) {
    targetBase = STATISTIQUES_NHL;
    targetPath = path.replace(/^api\.nhle\.com/, "");
  } else if (!path.startsWith("/")) {
    chemin cible = "/" + chemin;
  }

  // Reconstruit les paramètres de requête (sans "path")
  const targetUrl = new URL(targetPath, targetBase);
  pour (const [k, v] de url.searchParams.entries()) {
    si (k !== "chemin") targetUrl.searchParams.set(k, v);
  }

  essayer {
    const upstream = await fetch(targetUrl.toString(), {
      en-têtes : {
        Accepter : "application/json",
        "User-Agent": "RATSDUBET-NHL-RDB/1.0",
      },
      // Cache léger bord latéral
      cf: { cacheTtl: 60, cacheEverything: true },
    });

    const corps = await upstream.text();
    const contentType = upstream.headers.get("content-type") || "application/json";

    retourner une nouvelle réponse(corps, {
      statut : upstream.status,
      en-têtes : {
        ...Object.fromEntries(corsHeaders(contentType)),
        "Cache-Control": "public, max-age=60",
      },
    });
  } attraper (erreur) {
    retourner une nouvelle réponse(
      JSON.stringify({ error: "Échec de la récupération en amont", message: String(err) }),
      {
        statut : 502,
        en-têtes : corsHeaders("application/json"),
      }
    );
  }
}

fonction corsHeaders(contentType) {
  retour {
    "Content-Type" : contentType,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
