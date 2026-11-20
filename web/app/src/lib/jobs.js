// Deterministic job checks that run in the browser: market + eligibility, ghost/scam flags, quick skill overlap,
// and the interview-chance arithmetic. Claude only supplies judgement (match parts, evidence); the maths is here.

// ponytail: keyword lists, not geocoding. Add cities here when a market is mis-detected.
const MARKETS = {
  India: /\b(india|bengaluru|bangalore|mumbai|delhi|ncr|gurgaon|gurugram|noida|hyderabad|pune|chennai|kolkata|ahmedabad)\b/i,
  "United States": /\b(us|u\.s\.|usa|united states|amer|americas|north america|sf|ssf|nyc|new york|seattle|sea|san francisco|chicago|california|boston|austin|denver|los angeles|remote-us|us-remote)\b/i,
  Europe: /\b(europe|emea|eu|uk|united kingdom|london|dublin|ireland|germany|berlin|munich|paris|france|amsterdam|netherlands|spain|madrid|barcelona|lisbon|portugal|poland|warsaw|sweden|stockholm)\b/i,
};
const OPEN_EVERYWHERE = /\b(worldwide|anywhere|global|any location)\b/i;
const ASIA = /\b(apac|asia)\b/i;

export const ELIG = {
  ok: ["good", "Open to you"],
  verify: ["warn", "Check eligibility"],
  no: ["bad", "Not open to you"],
};

/** Country from "City, country" (last part). */
export const homeCountry = (home) => (home || "").split(",").pop().trim().toLowerCase();

/** Which of the user's markets a job is in, and whether they can apply given their per-market work-mode choices. */
export function eligibility(job, prefs) {
  const where = `${job.location} ${job.openTo || ""}`;
  const country = homeCountry(prefs.home);
  const openToMe =
    OPEN_EVERYWHERE.test(where) ||
    (country && where.toLowerCase().includes(country)) ||
    (country && ASIA.test(where) && !MARKETS["United States"].test(where) && !MARKETS.Europe.test(where) && country !== "united states");
  const markets = Object.keys(MARKETS).filter((m) => MARKETS[m].test(job.location));

  const verdicts = markets.map((m) => {
    const mode = prefs.markets[m];
    if (!mode || mode === "Not interested") return "no";
    if (mode.startsWith("Onsite")) return "ok";
    if (!job.remote) return "no";
    if (country && homeCountry(m) === country) return "ok";
    if (openToMe) return "ok";
    // "Remote - US" style: remote, but tied to that market.
    return /\b(only|remote[- ]us|us[- ]remote|amer)\b/i.test(where) ? "no" : "verify";
  });
  if (!markets.length) verdicts.push(job.remote ? (openToMe ? "ok" : "verify") : "no");
  const status = verdicts.includes("ok") ? "ok" : verdicts.includes("verify") ? "verify" : "no";
  return { status, markets: markets.length ? markets : ["Other"] };
}

const PAY = /\b(salary|compensation|ctc|lpa|base pay|pay range|per annum)\b|[$₹€£]\s?\d/i;
const SCAM = /\b(registration|training|processing|security) (fee|deposit)\b|\bpay (a|the) (fee|deposit)\b|@(gmail|yahoo|hotmail|outlook)\.com/i;

/** Ghost and scam signals (F7). Flags lower the rank; they never hide a job. */
export function flags(job, prefs) {
  const out = [];
  if (job.ageDays == null) out.push("Posting date unknown");
  else if (job.ageDays > 30) out.push(`Posted ${job.ageDays} days ago`);
  if (!PAY.test(job.description)) out.push("No salary listed");
  if (job.description.length < 800) out.push("Short or vague description");
  if (SCAM.test(job.description)) out.push("Asks for a fee or personal-email contact");
  const d = job.description.toLowerCase();
  for (const db of (prefs.dealBreakers || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)) {
    if (d.includes(db)) out.push(`Mentions your deal-breaker: ${db}`);
  }
  return out;
}

/** Resume skill terms found in the job text. A quick sort key only, not the match score. */
export function overlap(job, resume) {
  const d = `${job.title} ${job.description}`.toLowerCase();
  const terms = [...new Set((resume?.skills || []).flatMap((s) => s.items).map((t) => t.trim()).filter((t) => t.length > 1))];
  return terms.filter((t) => new RegExp(`\\b${t.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(d));
}

/** Default title words to skip (same idea as title_exclude in profile.json). Users edit theirs on the Resume step. */
export const DEFAULT_EXCLUDE = ["director", "vp", "vice president", "head of", "principal", "group product", "staff", "intern", "chief"];

/** The first exclude word found in the title as a whole word or phrase, or null. */
export function excludedBy(title, exclude) {
  const t = ` ${(title || "").toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  return (exclude || []).find((w) => {
    const p = w.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    return p && t.includes(` ${p} `);
  }) ?? null;
}

export const RUBRIC = [
  ["must_haves", "Must-have requirements", 35],
  ["seniority", "Seniority and years", 20],
  ["domain", "Domain fit", 20],
  ["skills", "Skills and tools", 15],
  ["location", "Location and eligibility", 10],
];

/** Match score = sum of rubric parts, each clamped to 0..its max. The one place this is computed. */
export const matchScore = (result) => RUBRIC.reduce((s, [k, , max]) => s + Math.max(0, Math.min(max, result.parts[k]?.score ?? 0)), 0);

/** Interview chance = match with stated adjustments. */
export function chance(result, job, referral) {
  const match = matchScore(result);
  const adj = [];
  if (job.ageDays > 45) adj.push(["Posted more than 45 days ago", -20]);
  else if (job.ageDays > 30) adj.push(["Posted more than 30 days ago", -10]);
  if (result.seniority_gap_levels >= 2) adj.push([`Seniority gap of ${result.seniority_gap_levels} levels`, -15]);
  if (result.eligibility === "verify") adj.push(["Eligibility from your country not confirmed", -10]);
  if (referral) adj.push(["You have a referral", 15]);
  let pct = Math.max(0, Math.min(100, adj.reduce((s, [, d]) => s + d, match)));
  const capped = result.missing_hard_must_have;
  if (capped) pct = Math.min(pct, 39);
  const level = pct >= 70 ? "High" : pct >= 40 ? "Medium" : "Low";
  return { match, pct, level, adj, capped };
}

// Self-check: node src/lib/jobs.js
if (typeof process !== "undefined" && process.argv?.[1]?.endsWith("jobs.js")) {
  const prefs = { home: "Bengaluru, India", markets: { India: "Onsite, hybrid or remote", "United States": "Remote, open to my country", Europe: "Not interested" } };
  const j = (location, remote, openTo = "") => ({ location, remote, openTo, description: "" });
  const eq = (a, b, m) => { if (a !== b) throw new Error(`${m}: ${a} != ${b}`); };
  eq(eligibility(j("Bangalore", false), prefs).status, "ok", "India onsite");
  eq(eligibility(j("San Francisco, California", false), prefs).status, "no", "US onsite");
  eq(eligibility(j("US-Remote", true), prefs).status, "no", "US-only remote");
  eq(eligibility(j("Remote", true, "Worldwide"), prefs).status, "ok", "worldwide");
  eq(eligibility(j("Remote", true), prefs).status, "verify", "unclear remote");
  eq(eligibility(j("London", true), prefs).status, "no", "Europe not interested");
  eq(eligibility(j("Remote - Singapore", true, "APAC"), prefs).status, "ok", "APAC remote");
  const parts = { must_haves: { score: 30 }, seniority: { score: 15 }, domain: { score: 15 }, skills: { score: 10 }, location: { score: 10 } };
  const c = chance({ parts, seniority_gap_levels: 0, eligibility: "ok" }, { ageDays: 40 }, false);
  eq(c.match, 80, "match sum"); eq(c.pct, 70, "age penalty"); eq(c.level, "High", "level");
  eq(chance({ parts, missing_hard_must_have: true }, { ageDays: 1 }).level, "Low", "cap");
  // A part over its max (Claude said 38/35) counts as 35 everywhere: list, report and tracker.
  eq(matchScore({ parts: { ...parts, must_haves: { score: 38 } } }), 85, "clamped");
  // Title exclude: whole words, so "staff" skips "Staff PM" but "vp" doesn't skip "MVP".
  const ex = ["staff", "vp", "head of"];
  eq(excludedBy("Staff Product Manager", ex), "staff", "exclude staff");
  eq(excludedBy("Head of Product", ex), "head of", "exclude head of");
  eq(excludedBy("Product Manager, MVP launches", ex), null, "mvp is not vp");
  console.log("jobs.js ok");
}
