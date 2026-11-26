// POST /api/trace: relays opt-in LLM traces from the browser to Langfuse (https://langfuse.com).
// The browser can't call Langfuse itself: that needs the secret key, and the CSP only allows connections to 'self' and
// api.anthropic.com. So the browser posts a batch of Langfuse ingestion events here and this adds the key server-side.
// Only users who tick "Share my sessions" send anything, and their name and contact details are removed in the browser first.
// Off unless LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY are set (LANGFUSE_HOST defaults to Langfuse Cloud EU).
// Vercel runs this as a function; server.js (Render) and vite.config.js (dev) call the same POST handler.

const TYPES = new Set(["trace-create", "generation-create", "span-create", "event-create", "score-create"]);
export const MAX_BYTES = 1_000_000; // one trace (resume + job + output) is ~20-80 KB; this leaves room, not abuse
const MAX_EVENTS = 40;
const ID = /^[\w-]{8,64}$/;

export const enabled = (env = process.env) => Boolean(env.LANGFUSE_PUBLIC_KEY && env.LANGFUSE_SECRET_KEY);

/** Keep only well-formed ingestion events. Anything else is dropped, so this can't be used to write arbitrary data. */
export function clean(batch, release = "", environment = "development") {
  if (!Array.isArray(batch)) return [];
  return batch
    .slice(0, MAX_EVENTS)
    .filter((e) => e && TYPES.has(e.type) && ID.test(e.id || "") && typeof e.timestamp === "string" && e.body && typeof e.body === "object" && !Array.isArray(e.body))
    .map(({ id, type, timestamp, body }) => ({
      id,
      type,
      timestamp,
      // Set by the server, not the browser. Release = the deployed commit, so traces can be compared before and after a
      // change. Environment splits your own `npm run dev` sessions from real users' in the Langfuse UI.
      body: { ...body, environment, ...(type === "trace-create" && release && { release }) },
    }));
}

export async function POST(request, env = process.env) {
  if (!enabled(env)) return new Response(null, { status: 204 }); // tracing not set up: accept and drop
  const text = await request.text();
  if (text.length > MAX_BYTES) return Response.json({ error: "Trace too large" }, { status: 413 });
  let batch;
  try {
    const hosted = Boolean(env.RENDER || env.VERCEL);
    batch = clean(JSON.parse(text).batch, env.RENDER_GIT_COMMIT || env.VERCEL_GIT_COMMIT_SHA || "", env.LANGFUSE_ENV || (hosted ? "production" : "development"));
  } catch {
    return Response.json({ error: "Bad trace" }, { status: 400 });
  }
  if (!batch.length) return Response.json({ error: "No valid events" }, { status: 400 });

  const host = (env.LANGFUSE_HOST || "https://cloud.langfuse.com").replace(/\/$/, "");
  const auth = Buffer.from(`${env.LANGFUSE_PUBLIC_KEY}:${env.LANGFUSE_SECRET_KEY}`).toString("base64");
  try {
    const r = await fetch(`${host}/api/public/ingestion`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({ batch }),
      signal: AbortSignal.timeout(10_000),
    });
    // Langfuse answers 207 with per-event errors; log them so a schema mistake shows up in the server logs.
    const out = await r.json().catch(() => ({}));
    if (!r.ok || out.errors?.length) console.error("langfuse ingestion", r.status, JSON.stringify(out.errors || out).slice(0, 500));
    return new Response(null, { status: r.ok ? 202 : 502 });
  } catch (e) {
    console.error("langfuse unreachable", e.message);
    return new Response(null, { status: 502 });
  }
}

// Self-check (no network): node api/trace.js
if (typeof process !== "undefined" && process.argv?.[1]?.endsWith("trace.js") && process.argv[1].includes("api")) {
  const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`); };
  const ev = (type, id = "abcdefgh-1") => ({ id, type, timestamp: "2026-11-26T00:00:00Z", body: { id: "t1" } });
  eq(clean([ev("trace-create"), ev("evil-create"), ev("score-create", "x"), { ...ev("span-create"), body: [] }, null]).map((e) => e.type), ["trace-create"], "only valid events kept");
  eq(clean([ev("trace-create")], "abc123")[0].body.release, "abc123", "release added to traces");
  eq(clean([ev("generation-create")], "abc123")[0].body.release, undefined, "release only on traces");
  eq(clean([ev("span-create")], "", "production")[0].body.environment, "production", "environment set");
  eq(clean(Array.from({ length: 100 }, () => ev("span-create"))).length, MAX_EVENTS, "batch capped");
  eq(clean("nope"), [], "non-array batch");
  eq((await POST(new Request("http://x", { method: "POST", body: "{}" }), {})).status, 204, "no keys: no-op");
  eq((await POST(new Request("http://x", { method: "POST", body: "not json" }), { LANGFUSE_PUBLIC_KEY: "p", LANGFUSE_SECRET_KEY: "s" })).status, 400, "bad json");
  eq((await POST(new Request("http://x", { method: "POST", body: "x".repeat(MAX_BYTES + 1) }), { LANGFUSE_PUBLIC_KEY: "p", LANGFUSE_SECRET_KEY: "s" })).status, 413, "too large");
  console.log("api/trace.js ok");
}
