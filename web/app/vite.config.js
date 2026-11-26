import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";

// Same security headers locally (vite preview) as on Vercel (vercel.json).
const headers = Object.fromEntries(
  JSON.parse(readFileSync(new URL("./vercel.json", import.meta.url))).headers[0].headers.map((h) => [h.key, h.value]),
);

// Local only: serve api/jobs.js at /api/jobs in `vite` and `vite preview`, the same handler Vercel runs in production.
function mountApi(server) {
  // Traces: same handler as production. Put LANGFUSE_* in web/app/.env.local to send your dev sessions to Langfuse.
  server.middlewares.use("/api/trace", async (req, res) => {
    try {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const { POST } = await import("./api/trace.js");
      const r = await POST(new Request("http://localhost/api/trace", { method: "POST", body: Buffer.concat(chunks) }), { ...process.env, ...loadEnv("development", process.cwd(), "LANGFUSE_") });
      res.statusCode = r.status;
      res.end();
    } catch (e) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: String(e) }));
    }
  });
  server.middlewares.use("/api/jobs", async (req, res) => {
    try {
      const { GET } = await import("./api/jobs.js");
      const r = await GET(new Request(`http://localhost${req.originalUrl}`));
      res.statusCode = r.status;
      res.setHeader("Content-Type", "application/json");
      res.end(await r.text());
    } catch (e) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: String(e) }));
    }
  });
}
const localApi = { name: "local-api", configureServer: mountApi, configurePreviewServer: mountApi };

// Static hosting has no server to fill in __SITE__ (the absolute URL link previews need), so do it at build time
// when SITE_URL is set. Left as-is otherwise, and server.js fills it per request.
const site = (process.env.SITE_URL || "").replace(/\/$/, "");
const siteUrl = { name: "site-url", transformIndexHtml: (html) => (site ? html.replaceAll("__SITE__", site) : html) };

export default defineConfig({
  plugins: [react(), localApi, siteUrl],
  preview: { port: 4174, headers },
  server: { port: 4175 },
});
