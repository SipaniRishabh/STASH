// Production server for hosts that run Node (Render): serves the built app from dist/ with the same security
// headers as vercel.json, and /api/jobs from api/jobs.js with a 1-hour in-memory cache.
// Usage: npm run build && node server.js   (PORT defaults to 10000, Render's default)
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { GET, normalizeQuery } from "./api/jobs.js";
import { POST as trace } from "./api/trace.js";

const DIST = fileURLToPath(new URL("./dist/", import.meta.url));
const HEADERS = Object.fromEntries(
  JSON.parse(readFileSync(new URL("./vercel.json", import.meta.url))).headers[0].headers.map((h) => [h.key, h.value]),
);
const SITE = (process.env.RENDER_EXTERNAL_URL || process.env.SITE_URL || "").replace(/\/$/, "");
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon", ".woff2": "font/woff2", ".mjs": "text/javascript",
  ".map": "application/json", ".txt": "text/plain",
};

// ponytail: one process, in-memory cache; fine for a single free instance. Use a shared cache if it ever scales out.
const HOUR = 36e5;
const MAX_ENTRIES = 200; // oldest entry is dropped beyond this, so memory stays bounded
const cache = new Map(); // canonical query -> { at, body, pending }; Map keeps insertion order = age

async function jobs(query) {
  const hit = cache.get(query);
  if (hit?.body && Date.now() - hit.at < HOUR) return hit.body;
  if (hit?.pending) return hit.pending; // a search for the same query is already running
  const pending = GET(new Request(`http://local/api/jobs?${query}`)).then((r) => r.text());
  remember(query, { ...hit, pending });
  try {
    const body = await pending;
    remember(query, { at: Date.now(), body });
    return body;
  } catch (e) {
    cache.delete(query);
    throw e;
  }
}

function remember(key, value) {
  cache.delete(key); // re-insert at the end, so it counts as newest
  cache.set(key, value);
  while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value);
}

// Rate limit per IP: each fresh search makes ~25 requests to job boards, so cap how often one visitor can ask.
// The app itself searches about once an hour per user; 20 per 10 minutes leaves plenty of room for Refresh.
// Traces have their own, looser budget (one per Claude call; a busy session makes a few dozen), so they never use up searches.
const WINDOW = 10 * 60e3;
const searches = limiter(20), traces = limiter(150);
const limited = (req) => searches(req);

function limiter(LIMIT) {
  const hits = new Map(); // ip -> timestamps in the current window
  setInterval(() => {
    const now = Date.now();
    for (const [ip, ts] of hits) if (!ts.some((t) => now - t < WINDOW)) hits.delete(ip);
  }, WINDOW).unref();
  return (req) => {
    // Render sits behind Cloudflare, which sets cf-connecting-ip to the real visitor. x-forwarded-for is a fallback;
    // its first entry can be faked by the client, so this is a speed bump, not a hard security boundary.
    const h = req.headers;
    const ip = String(h["cf-connecting-ip"] || h["true-client-ip"] || h["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress || "?";
    const now = Date.now();
    const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW);
    recent.push(now);
    hits.set(ip, recent);
    return recent.length > LIMIT;
  };
}

createServer(async (req, res) => {
  const url = new URL(req.url, "http://local");
  try {
    if (url.pathname === "/api/jobs") {
      if (limited(req)) {
        res.writeHead(429, { "Content-Type": "application/json", "Retry-After": "600", ...HEADERS });
        return res.end(JSON.stringify({ error: "Too many job searches. Wait a few minutes and try again." }));
      }
      const body = await jobs(normalizeQuery(url.searchParams));
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store", ...HEADERS });
      return res.end(body);
    }
    if (url.pathname === "/api/trace" && req.method === "POST") {
      if (traces(req)) return res.writeHead(429, HEADERS).end();
      const chunks = [];
      let size = 0;
      for await (const c of req) {
        if ((size += c.length) > 1_000_000) return res.writeHead(413, HEADERS).end();
        chunks.push(c);
      }
      const r = await trace(new Request("http://local/api/trace", { method: "POST", body: Buffer.concat(chunks) }));
      return res.writeHead(r.status, HEADERS).end();
    }
    if (url.pathname === "/healthz") return res.end("ok");

    // Static files. Unknown paths get index.html (the app routes with #hash, so this is just a safe fallback).
    const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
    let file = join(DIST, rel === "/" ? "index.html" : rel);
    if (!file.startsWith(DIST)) file = join(DIST, "index.html");
    let data;
    try {
      data = await readFile(file);
    } catch {
      file = join(DIST, "index.html");
      data = await readFile(file);
    }
    // Link-preview tags need absolute URLs. Render sets RENDER_EXTERNAL_URL (e.g. https://jobber-xxxx.onrender.com).
    if (file.endsWith("index.html")) data = String(data).replaceAll("__SITE__", SITE || `https://${req.headers.host}`);
    const immutable = file.includes(`${sep}assets${sep}`);
    res.writeHead(200, {
      "Content-Type": TYPES[extname(file)] || "application/octet-stream",
      "Cache-Control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
      ...HEADERS,
    });
    res.end(data);
  } catch (e) {
    console.error(e);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Server error. Try again in a minute." }));
  }
}).listen(process.env.PORT || 10000, () => console.log(`Jobber on :${process.env.PORT || 10000}`));
