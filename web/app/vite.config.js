import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";

// Same security headers locally (vite preview) as on Vercel (vercel.json).
const headers = Object.fromEntries(
  JSON.parse(readFileSync(new URL("./vercel.json", import.meta.url))).headers[0].headers.map((h) => [h.key, h.value]),
);

// Local only: serve api/jobs.js at /api/jobs in `vite` and `vite preview`, the same handler Vercel runs in production.
function mountApi(server) {
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

export default defineConfig({
  plugins: [react(), localApi],
  preview: { port: 4174, headers },
  server: { port: 4175 },
});
