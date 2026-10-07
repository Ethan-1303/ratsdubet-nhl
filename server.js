/**
 * Serveur local RATSDUBET NHL
 * Usage : node server.js
 * Ouvre ensuite http://localhost:8787
 *
 * Sert les fichiers statiques + proxy /api vers les APIs NHL (CORS).
 */
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 8787;
const ROOT = __dirname;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function cors(res, type = "application/json") {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", type);
}

function proxyNHL(reqUrl, res) {
  const u = new URL(reqUrl, "http://localhost");
  const p = u.searchParams.get("path");
  if (!p) {
    cors(res);
    res.writeHead(400);
    return res.end(JSON.stringify({ error: "Missing path" }));
  }

  let base = "https://api.nhle.com";
  let targetPath = p.startsWith("/") ? p : "/" + p;

  if (p.startsWith("api-web.nhle.com/")) {
    base = "https://api-web.nhle.com";
    targetPath = p.replace(/^api-web\.nhle\.com/, "") || "/";
  } else if (p.startsWith("api.nhle.com/")) {
    base = "https://api.nhle.com";
    targetPath = p.replace(/^api\.nhle\.com/, "") || "/";
  }

  const target = new URL(targetPath, base);
  for (const [k, v] of u.searchParams.entries()) {
    if (k !== "path") target.searchParams.set(k, v);
  }

  https
    .get(
      target.toString(),
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "RATSDUBET-NHL-RDB/1.0",
        },
      },
      (up) => {
        const chunks = [];
        up.on("data", (c) => chunks.push(c));
        up.on("end", () => {
          const body = Buffer.concat(chunks);
          const ct = up.headers["content-type"] || "application/json";
          cors(res, ct);
          res.writeHead(up.statusCode || 200);
          res.end(body);
        });
      }
    )
    .on("error", (err) => {
      cors(res);
      res.writeHead(502);
      res.end(JSON.stringify({ error: "Upstream failed", message: String(err) }));
    });
}

function serveStatic(reqPath, res) {
  let file = reqPath === "/" ? "/index.html" : reqPath;
  file = path.normalize(file).replace(/^(\.\.[/\\])+/, "");
  const full = path.join(ROOT, file);

  if (!full.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.readFile(full, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("Not found");
    }
    const ext = path.extname(full).toLowerCase();
    res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
    res.writeHead(200);
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    cors(res);
    res.writeHead(204);
    return res.end();
  }

  const u = new URL(req.url, `http://localhost:${PORT}`);

  if (u.pathname === "/api" || u.pathname.startsWith("/api?")) {
    return proxyNHL(req.url, res);
  }

  serveStatic(u.pathname, res);
});

server.listen(PORT, () => {
  console.log("");
  console.log("  🐀 RATSDUBET NHL — serveur local prêt");
  console.log("  → http://localhost:" + PORT);
  console.log("  Ctrl+C pour arrêter");
  console.log("");
});
