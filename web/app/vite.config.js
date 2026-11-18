import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";

// Same security headers locally (vite preview) as on Vercel (vercel.json).
const headers = Object.fromEntries(
  JSON.parse(readFileSync(new URL("./vercel.json", import.meta.url))).headers[0].headers.map((h) => [h.key, h.value]),
);

export default defineConfig({
  plugins: [react()],
  preview: { port: 4174, headers },
  server: { port: 4175 },
});
