// Opt-in LLM tracing (Langfuse). Off unless the user ticks "Share my sessions" on the Connect screen.
// One trace per feature call (score a job, tailor, cover note...), one generation per Claude request inside it, plus
// scores from Jobber's own deterministic checks. Events go to our /api/trace relay, which adds the Langfuse key.
// Before anything leaves the browser: name, email, phone and LinkedIn are replaced, PDFs and the API key are never included.
// Sending never blocks or breaks the app: failures are ignored.
import { load, save } from "./store.js";

const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const MAX_STRING = 40_000; // per string; a resume JSON is ~5-15 KB, a job description up to ~20 KB

export const tracingOn = () => load("trace", false) === true;
export const setTracing = (on) => save("trace", on ? true : null);

// Anonymous ids: user = this browser (random, never linked to the person), session = this tab.
function ids() {
  let user = load("anon", "");
  if (!user) save("anon", (user = uid()));
  let session = "";
  try {
    session = sessionStorage.getItem("jobber:session") || "";
    if (!session) sessionStorage.setItem("jobber:session", (session = uid()));
  } catch {
    session = user;
  }
  return { user, session };
}

// Personal details to strip: the user's own, set by App from their resume, plus any found in a model answer.
let identity = [];
export function setIdentity(resume) {
  identity = resume ? identityOf(resume) : [];
}
const identityOf = (r) =>
  [r?.name, r?.contact?.email, r?.contact?.phone, r?.contact?.linkedin, ...(r?.name || "").split(/\s+/)]
    .filter((s) => typeof s === "string" && s.trim().length >= 3)
    .sort((a, b) => b.length - a.length); // replace "Meera Kapoor" before "Meera"

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
// Not inside a longer word, so ids like "49a1-2345-6789" and hex strings aren't mistaken for phone numbers.
const PHONE = /(?<![\w-])\+?\(?\d[\d\s().-]{8,}\d(?![\w-])/g;
// Ids and times Jobber generates itself: never redacted, or traces lose their links to each other.
const OWN = new Set(["id", "traceId", "sessionId", "userId", "timestamp", "startTime", "endTime"]);
const LINKEDIN = /(https?:\/\/)?([\w-]+\.)?linkedin\.com\/[^\s"]*/gi;
const KEY = /sk-ant-[\w-]+/g;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Deep copy with personal details replaced, PDFs dropped and long strings cut. Exported for the self-check. */
export function redact(value, extra = []) {
  const words = [...new Set([...identity, ...extra])];
  const names = words.length ? new RegExp(`\\b(${words.map(esc).join("|")})\\b`, "gi") : null;
  const str = (s) => {
    let out = s.replace(KEY, "[key]").replace(EMAIL, "[email]").replace(LINKEDIN, "[linkedin]").replace(PHONE, (m) => (m.replace(/\D/g, "").length >= 9 ? "[phone]" : m));
    if (names) out = out.replace(names, "[name]");
    return out.length > MAX_STRING ? `${out.slice(0, MAX_STRING)}… [cut ${out.length - MAX_STRING} chars]` : out;
  };
  const walk = (v) => {
    if (typeof v === "string") return str(v);
    if (Array.isArray(v)) return v.map(walk);
    if (!v || typeof v !== "object") return v;
    if (v.type === "document" || v.type === "image") return { type: v.type, note: "[file not sent]" };
    return Object.fromEntries(Object.entries(v).filter(([k]) => k !== "cache_control" && k !== "parsed_output").map(([k, x]) => [k, OWN.has(k) ? x : walk(x)]));
  };
  return walk(value);
}

function send(batch) {
  fetch("/api/trace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ batch }) }).catch(() => {});
}

const NOOP = { id: "", generation: () => ({ end() {} }), score() {}, end() {} };

/**
 * Start a trace for one feature call. Returns { generation(), score(), end() }, or no-ops when tracing is off.
 * Events are held until end() and sent in one request, so a trace costs one call to our server.
 */
export function startTrace(name, { input, metadata } = {}) {
  if (!tracingOn()) return NOOP;
  const { user, session } = ids();
  const id = uid();
  const start = now();
  const events = [];
  const push = (type, body) => events.push({ id: uid(), type, timestamp: now(), body });
  let extra = []; // personal details found in model output (e.g. the name read from a new resume)

  return {
    id,
    /** One Claude request. Call .end({ res }) or .end({ error }) when it returns. */
    generation(params) {
      const genStart = now();
      return {
        end({ res, error, output } = {}) {
          if (res?.parsed_output?.resume) extra = identityOf(res.parsed_output.resume);
          const u = res?.usage;
          push("generation-create", {
            id: uid(),
            traceId: id,
            name: `${name}.claude`,
            startTime: genStart,
            endTime: now(),
            // Model actually used: can differ from the one asked for when a server-side fallback kicks in.
            model: res?.model || params.model,
            modelParameters: { effort: params.output_config?.effort || "", max_tokens: params.max_tokens },
            input: { messages: params.messages, tools: params.tools?.map((t) => t.name) },
            output: output ?? res?.content,
            usageDetails: u && {
              input: u.input_tokens,
              output: u.output_tokens,
              cache_read_input_tokens: u.cache_read_input_tokens || 0,
              cache_creation_input_tokens: u.cache_creation_input_tokens || 0,
            },
            level: error ? "ERROR" : res?.stop_reason === "refusal" || res?.stop_reason === "max_tokens" ? "WARNING" : "DEFAULT",
            statusMessage: error ? String(error.message || error) : res?.stop_reason,
            metadata: { requested_model: params.model, stop_reason: res?.stop_reason, server_tool_use: u?.server_tool_use },
          });
        },
      };
    },
    /** A check result on this trace: true/false (BOOLEAN) or a number. */
    score(scoreName, value, comment = "") {
      push("score-create", {
        id: uid(),
        traceId: id,
        name: scoreName,
        value: typeof value === "boolean" ? Number(value) : value,
        dataType: typeof value === "boolean" ? "BOOLEAN" : "NUMERIC",
        comment,
      });
    },
    end({ output, error } = {}) {
      events.unshift({
        id: uid(),
        type: "trace-create",
        timestamp: start,
        body: {
          id,
          name,
          sessionId: session,
          userId: user,
          input,
          output: error ? { error: String(error.message || error) } : output,
          tags: [name, ...(error ? ["error"] : [])],
          metadata: { ...metadata, app_version: import.meta.env?.VITE_APP_VERSION || "", ok: !error },
        },
      });
      try {
        send(redact(events, extra));
      } catch {
        /* never let tracing break a feature */
      }
    },
  };
}

/** Run fn inside a trace: fn gets the trace; its return value becomes the trace output. Errors are recorded and re-thrown. */
export async function traced(name, opts, fn) {
  const t = startTrace(name, opts);
  try {
    const out = await fn(t);
    t.end({ output: out });
    return out;
  } catch (e) {
    t.end({ error: e });
    throw e;
  }
}

// Self-check (no network): node src/lib/trace.js
if (typeof process !== "undefined" && process.argv?.[1]?.endsWith("trace.js") && process.argv[1].includes("lib")) {
  const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`); };
  setIdentity({ name: "Meera Kapoor", contact: { email: "meera.k@gmail.com", phone: "+91 98765 43210", linkedin: "linkedin.com/in/meerak" } });
  const r = redact({
    text: `Resume: {"name":"Meera Kapoor","contact":{"email":"meera.k@gmail.com","phone":"+91 98765 43210","linkedin":"https://www.linkedin.com/in/meerak"}} Meera led 12 launches in 2023, 40% growth.`,
    other: "write to someone@else.com or call (022) 555-01234; key sk-ant-api03-abc_DEF",
    doc: { type: "document", source: { data: "JVBERi0xLjQ..." } },
    cache_control: { type: "ephemeral" },
    n: 5,
  });
  eq(r.text, `Resume: {"name":"[name]","contact":{"email":"[email]","phone":"[phone]","linkedin":"[linkedin]"}} [name] led 12 launches in 2023, 40% growth.`, "identity removed, facts kept");
  eq(r.other, "write to [email] or call [phone]; key [key]", "generic contact details and key removed");
  eq(r.doc, { type: "document", note: "[file not sent]" }, "PDF dropped");
  eq(r.cache_control, undefined, "cache_control dropped");
  eq(r.n, 5, "numbers kept");
  const id = "131679e2-ce98-49a1-2345-678901f133f6";
  eq(redact({ id, traceId: id, note: `trace ${id}, 2019 - 2023, Rs 1,20,000` }), { id, traceId: id, note: `trace ${id}, 2019 - 2023, Rs 1,20,000` }, "ids, uuids, years and money kept");
  eq(redact({ t: "x".repeat(MAX_STRING + 5) }).t.endsWith("[cut 5 chars]"), true, "long strings cut");
  eq(redact("Kapoorsons Ltd hired Meera", ["Ravi"]), "Kapoorsons Ltd hired [name]", "whole words only");
  console.log("trace.js ok");
}
