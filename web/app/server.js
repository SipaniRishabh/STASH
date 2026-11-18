// Production server for hosts that run Node (Render): serves the built app from dist/ with the same security
// headers as vercel.json, and /api/jobs from api/jobs.js with a 1-hour in-memory cache.
// Usage: npm run build && node server.js   (PORT defaults to 10000, Render's default)
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { GET } from "./api/jobs.js";

const DIST = fileURLToPath(new URL("./dist/", import.meta.url));
const HEADERS = Object.fromEntries(
  JSON.parse(readFileSync(new URL("./vercel.json", import.meta.url))).headers[0].headers.map((h) => [h.key, h.value]),
);
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".woff2": "font/woff2", ".mjs": "text/javascript",
  ".map": "application/json", ".txt": "text/plain",
};

// ponytail: one process, in-memory cache; fine for a single free instance. Use a shared cache if it ever scales out.
const HOUR = 36e5;
const cache = new Map(); // query string -> { at, body, pending }

async function jobs(query) {
  const hit = cache.get(query);
  if (hit?.body && Date.now() - hit.at < HOUR) return hit.body;
  if (hit?.pending) return hit.pending; // a search for the same query is already running
  const pending = GET(new Request(`http://local/api/jobs?${query}`)).then((r) => r.text());
  cache.set(query, { ...hit, pending });
  try {
    const body = await pending;
    cache.set(query, { at: Date.now(), body });
    return body;
  } catch (e) {
    cache.delete(query);
    throw e;
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url, "http://local");
  try {
    if (url.pathname === "/api/jobs") {
      const body = await jobs(url.searchParams.toString());
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store", ...HEADERS });
      return res.end(body);
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
