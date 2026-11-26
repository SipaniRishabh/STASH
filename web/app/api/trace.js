// POST /api/trace: relays opt-in LLM traces from the browser to Langfuse (https://langfuse.com).
// The browser can't call Langfuse itself: that needs the secret key, and the CSP only allows connections to 'self' and
// api.anthropic.com. So the browser posts one finished trace here (a trace, its Claude calls and its check scores) and
// this adds the key server-side. Only users who tick "Share my sessions" send anything, and their name and contact
// details are removed in the browser first.
// Langfuse Cloud stopped accepting the old /api/public/ingestion endpoint on 2026-11-16, so the trace is sent as
// OpenTelemetry spans to /api/public/otel/v1/traces (Langfuse v4 format) and the scores to /api/public/scores.
// Off unless LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY are set (LANGFUSE_HOST defaults to Langfuse Cloud EU).
// Vercel runs this as a function; server.js (Render) and vite.config.js (dev) call the same POST handler.

export const MAX_BYTES = 1_000_000; // one trace (resume + job + output) is ~20-80 KB; this leaves room, not abuse
const MAX_EVENTS = 40;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hex = (uuid) => uuid.replace(/-/g, "").toLowerCase();

export const enabled = (env = process.env) => Boolean(env.LANGFUSE_PUBLIC_KEY && env.LANGFUSE_SECRET_KEY);

const nanos = (iso, fallback) => {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? String(BigInt(ms) * 1_000_000n) : fallback;
};
const json = (v) => (typeof v === "string" ? v : JSON.stringify(v));
// One OTLP attribute. Empty values are skipped; Langfuse wants plain strings (and string arrays for tags).
function attr(key, v) {
  if (v === undefined || v === null || v === "") return [];
  if (Array.isArray(v)) return [{ key, value: { arrayValue: { values: v.map((x) => ({ stringValue: String(x) })) } } }];
  return [{ key, value: { stringValue: typeof v === "object" ? JSON.stringify(v) : String(v) } }];
}
const object = (prefix, o) => (o && typeof o === "object" ? Object.entries(o).flatMap(([k, v]) => attr(`${prefix}.${k}`, v)) : []);
const level = (lv, msg) => [...attr("langfuse.observation.level", lv), ...attr("langfuse.observation.status_message", msg)];

/**
 * Turn the browser's batch (one trace-create, its generation-create and score-create events) into Langfuse v4 data:
 * a root span for the feature call with each Claude request as a child generation, plus scores.
 * Anything malformed or belonging to another trace is dropped, so this can't be used to write arbitrary data.
 * Returns null when there is no valid trace.
 */
export function convert(batch, release = "", environment = "development") {
  if (!Array.isArray(batch)) return null;
  const events = batch.slice(0, MAX_EVENTS).filter((e) => e && typeof e.type === "string" && e.body && typeof e.body === "object" && !Array.isArray(e.body));
  const trace = events.find((e) => e.type === "trace-create" && UUID.test(e.body.id || "") && typeof e.body.name === "string");
  if (!trace) return null;
  const t = trace.body;
  const traceId = hex(t.id);
  const rootId = traceId.slice(16); // root span id, derived from the trace id
  const start = nanos(trace.timestamp, String(BigInt(Date.now()) * 1_000_000n));
  const mine = (e, type) => e.type === type && e.body.traceId === t.id && UUID.test(e.body.id || "");

  // Trace-wide attributes go on every span: Langfuse v4 filters observations, not traces.
  const common = [
    ...attr("langfuse.trace.name", t.name),
    ...attr("langfuse.user.id", t.userId),
    ...attr("langfuse.session.id", t.sessionId),
    ...attr("langfuse.trace.tags", Array.isArray(t.tags) ? t.tags : undefined),
    ...attr("langfuse.environment", environment),
    ...attr("langfuse.release", release),
    ...object("langfuse.trace.metadata", t.metadata),
  ];

  const gens = events.filter((e) => mine(e, "generation-create")).map(({ body: g }) => ({
    traceId,
    spanId: hex(g.id).slice(0, 16),
    parentSpanId: rootId,
    name: String(g.name || `${t.name}.claude`),
    kind: 1,
    startTimeUnixNano: nanos(g.startTime, start),
    endTimeUnixNano: nanos(g.endTime, nanos(g.startTime, start)),
    attributes: [
      ...attr("langfuse.observation.type", "generation"),
      ...attr("langfuse.observation.model.name", g.model),
      ...attr("langfuse.observation.model.parameters", g.modelParameters && json(g.modelParameters)),
      ...attr("langfuse.observation.usage_details", g.usageDetails && json(g.usageDetails)),
      ...attr("langfuse.observation.input", g.input !== undefined ? json(g.input) : undefined),
      ...attr("langfuse.observation.output", g.output !== undefined ? json(g.output) : undefined),
      ...level(g.level, g.statusMessage),
      ...object("langfuse.observation.metadata", g.metadata),
      ...common,
    ],
    status: { code: g.level === "ERROR" ? 2 : 1 },
  }));

  const failed = t.metadata?.ok === false;
  const ends = gens.map((g) => BigInt(g.endTimeUnixNano));
  const end = nanos(t.endTime, String(ends.reduce((a, b) => (b > a ? b : a), BigInt(start))));
  const root = {
    traceId,
    spanId: rootId,
    name: t.name,
    kind: 1,
    startTimeUnixNano: start,
    endTimeUnixNano: end,
    attributes: [
      ...attr("langfuse.observation.type", "span"),
      // v4 has no separate trace input/output: the root observation carries the feature's overall input and result.
      ...attr("langfuse.observation.input", t.input !== undefined ? json(t.input) : undefined),
      ...attr("langfuse.observation.output", t.output !== undefined ? json(t.output) : undefined),
      ...level(failed ? "ERROR" : undefined, failed ? t.output?.error : undefined),
      ...common,
    ],
    status: { code: failed ? 2 : 1 },
  };

  const scores = events
    .filter((e) => mine(e, "score-create") && typeof e.body.name === "string" && typeof e.body.value === "number")
    .map(({ body: s }) => ({
      id: s.id,
      traceId,
      name: s.name.slice(0, 100),
      value: s.value,
      dataType: s.dataType === "BOOLEAN" ? "BOOLEAN" : "NUMERIC",
      ...(s.comment && { comment: String(s.comment).slice(0, 500) }),
      environment,
    }));

  return {
    otlp: {
      resourceSpans: [{
        resource: { attributes: attr("service.name", "jobber") },
        scopeSpans: [{ scope: { name: "jobber" }, spans: [root, ...gens] }],
      }],
    },
    scores,
  };
}

export async function POST(request, env = process.env) {
  if (!enabled(env)) return new Response(null, { status: 204 }); // tracing not set up: accept and drop
  const text = await request.text();
  if (text.length > MAX_BYTES) return Response.json({ error: "Trace too large" }, { status: 413 });
  let data;
  try {
    const hosted = Boolean(env.RENDER || env.VERCEL);
    // Set by the server, not the browser. Release = the deployed commit, so traces can be compared before and after a
    // change. Environment splits your own `npm run dev` sessions from real users' in the Langfuse UI.
    data = convert(JSON.parse(text).batch, env.RENDER_GIT_COMMIT || env.VERCEL_GIT_COMMIT_SHA || "", env.LANGFUSE_ENV || (hosted ? "production" : "development"));
  } catch {
    return Response.json({ error: "Bad trace" }, { status: 400 });
  }
  if (!data) return Response.json({ error: "No valid trace" }, { status: 400 });

  const host = (env.LANGFUSE_HOST || "https://cloud.langfuse.com").replace(/\/$/, "");
  const headers = {
    Authorization: `Basic ${Buffer.from(`${env.LANGFUSE_PUBLIC_KEY}:${env.LANGFUSE_SECRET_KEY}`).toString("base64")}`,
    "Content-Type": "application/json",
  };
  const post = (path, body, extra = {}) =>
    fetch(`${host}${path}`, { method: "POST", headers: { ...headers, ...extra }, body: JSON.stringify(body), signal: AbortSignal.timeout(10_000) });
  try {
    const r = await post("/api/public/otel/v1/traces", data.otlp, { "x-langfuse-ingestion-version": "4" });
    const out = await r.text().catch(() => "");
    // A wrong key, host or span format shows up here in the server logs.
    if (!r.ok || out.includes("rejected")) console.error("langfuse otel", r.status, out.slice(0, 500));
    if (!r.ok) return new Response(null, { status: 502 });
    // Scores only after the trace is in, so they never point at a trace that doesn't exist.
    const sent = await Promise.allSettled(data.scores.map((s) => post("/api/public/scores", s)));
    const bad = sent.filter((s) => s.status === "rejected" || !s.value.ok);
    if (bad.length) console.error("langfuse scores", `${bad.length}/${sent.length} failed`, bad[0].reason?.message || bad[0].value?.status);
    return new Response(null, { status: 202 });
  } catch (e) {
    console.error("langfuse unreachable", e.message);
    return new Response(null, { status: 502 });
  }
}

// Self-check (no network): node api/trace.js
if (typeof process !== "undefined" && process.argv?.[1]?.endsWith("trace.js") && process.argv[1].includes("api")) {
  const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`); };
  const T = "131679e2-ce98-49a1-8345-678901f133f6", G = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", S = "bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  const at = "2026-11-26T00:00:00.000Z";
  const batch = [
    { id: "e1", type: "trace-create", timestamp: at, body: { id: T, name: "score_job", userId: "u1", sessionId: "s1", tags: ["score_job"], input: { job: "PM" }, output: { score: 72 }, metadata: { ok: true } } },
    { id: "e2", type: "generation-create", timestamp: at, body: { id: G, traceId: T, name: "score_job.claude", startTime: at, endTime: "2026-11-26T00:00:05.000Z", model: "claude-opus-5-5", usageDetails: { input: 10, output: 5 }, input: { messages: [] }, output: [{ type: "text", text: "hi" }], level: "DEFAULT", metadata: { stop_reason: "end_turn" } } },
    { id: "e3", type: "score-create", timestamp: at, body: { id: S, traceId: T, name: "evidence_quoted_exactly", value: 1, dataType: "BOOLEAN", comment: "" } },
    { id: "e4", type: "generation-create", timestamp: at, body: { id: S, traceId: "00000000-0000-4000-8000-000000000000", name: "other trace" } },
    { id: "e5", type: "evil-create", timestamp: at, body: { id: S } },
  ];
  const out = convert(batch, "abc123", "production");
  const [root, gen] = out.otlp.resourceSpans[0].scopeSpans[0].spans;
  const a = (span) => Object.fromEntries(span.attributes.map((x) => [x.key, x.value.stringValue ?? x.value.arrayValue.values.map((v) => v.stringValue)]));
  eq(out.otlp.resourceSpans[0].scopeSpans[0].spans.length, 2, "root + own generation only");
  eq([root.traceId, root.spanId, gen.parentSpanId, gen.spanId], ["131679e2ce9849a18345678901f133f6", "8345678901f133f6", "8345678901f133f6", "aaaaaaaabbbb4ccc"], "hex ids and nesting");
  eq([a(root)["langfuse.observation.type"], a(gen)["langfuse.observation.type"]], ["span", "generation"], "observation types");
  eq(a(root)["langfuse.observation.output"], '{"score":72}', "root carries overall output");
  eq(root.endTimeUnixNano, "1795651205000000000", "root ends with its last generation");
  for (const s of [root, gen]) {
    const x = a(s);
    eq([x["langfuse.user.id"], x["langfuse.session.id"], x["langfuse.environment"], x["langfuse.release"], x["langfuse.trace.name"], x["langfuse.trace.tags"]], ["u1", "s1", "production", "abc123", "score_job", ["score_job"]], `trace attributes on ${s.name}`);
  }
  eq([a(gen)["langfuse.observation.model.name"], a(gen)["langfuse.observation.usage_details"], a(gen)["langfuse.observation.metadata.stop_reason"]], ["claude-opus-5-5", '{"input":10,"output":5}', "end_turn"], "generation details");
  eq(out.scores, [{ id: S, traceId: "131679e2ce9849a18345678901f133f6", name: "evidence_quoted_exactly", value: 1, dataType: "BOOLEAN", environment: "production" }], "scores point at the hex trace id");
  const failed = convert([{ ...batch[0], body: { ...batch[0].body, output: { error: "401" }, metadata: { ok: false } } }]);
  eq([failed.otlp.resourceSpans[0].scopeSpans[0].spans[0].status.code, a(failed.otlp.resourceSpans[0].scopeSpans[0].spans[0])["langfuse.observation.level"]], [2, "ERROR"], "failed call marked as error");
  eq(convert([batch[1]]), null, "no trace, nothing sent");
  eq(convert("nope"), null, "non-array batch");
  eq((await POST(new Request("http://x", { method: "POST", body: "{}" }), {})).status, 204, "no keys: no-op");
  eq((await POST(new Request("http://x", { method: "POST", body: "not json" }), { LANGFUSE_PUBLIC_KEY: "p", LANGFUSE_SECRET_KEY: "s" })).status, 400, "bad json");
  eq((await POST(new Request("http://x", { method: "POST", body: '{"batch":[]}' }), { LANGFUSE_PUBLIC_KEY: "p", LANGFUSE_SECRET_KEY: "s" })).status, 400, "empty batch");
  eq((await POST(new Request("http://x", { method: "POST", body: "x".repeat(MAX_BYTES + 1) }), { LANGFUSE_PUBLIC_KEY: "p", LANGFUSE_SECRET_KEY: "s" })).status, 413, "too large");
  console.log("api/trace.js ok");
}
