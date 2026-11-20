// GET /api/jobs?titles=Product Manager,Senior Product Manager&maxAge=60&boards=greenhouse:razorpay,lever:swiggy
// Fetches public job boards, keeps fresh title matches, returns plain-text jobs. Never sees the key or resume.
// Vercel caches the response for 1 hour (s-maxage). In dev, vite.config.js mounts this same handler.
import { readFileSync } from "node:fs";

// Company boards come from companies.json at the repo root (shared with scripts/fetch_jobs.py), so adding a
// company is a one-line config change. Users can add their own boards too (the `boards` query param).
const SOURCES = ["greenhouse", "lever", "ashby"];
const SLUG = /^[a-z0-9][a-z0-9-]{1,49}$/;
const MAX_USER_BOARDS = 15;
export const BOARDS = loadBoards();

function loadBoards() {
  try {
    const cfg = JSON.parse(readFileSync(new URL("../../../companies.json", import.meta.url), "utf8"));
    return Object.fromEntries(SOURCES.map((s) => [s, (cfg[s] || []).filter((t) => SLUG.test(t))]));
  } catch (e) {
    console.error("companies.json missing or invalid; using job sites only", e.message);
    return Object.fromEntries(SOURCES.map((s) => [s, []]));
  }
}

/**
 * One canonical form of the query, used both to run the search and as the cache key. Anything not listed here
 * is dropped, so `?x=1`, `?x=2`… all hit the same cache entry instead of each triggering a fresh fetch.
 * titles: up to 5, lowercased, sorted, de-duplicated. maxAge: whole days, 7..90. boards: "source:slug", validated.
 */
export function normalizeQuery(params) {
  const titles = [...new Set((params.get("titles") || "product manager").split(",").map((t) => t.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 60)).filter(Boolean))].sort().slice(0, 5);
  const maxAge = Math.min(90, Math.max(7, Math.round(+params.get("maxAge") || 60)));
  const boards = [...new Set((params.get("boards") || "").split(",").map((b) => b.trim().toLowerCase().replace(/\s+/g, "")).filter((b) => {
    const [source, slug, extra] = b.split(":");
    return !extra && SOURCES.includes(source) && SLUG.test(slug || "");
  }))].sort().slice(0, MAX_USER_BOARDS);
  const q = new URLSearchParams({ titles: (titles.length ? titles : ["product manager"]).join(","), maxAge: String(maxAge) });
  if (boards.length) q.set("boards", boards.join(","));
  return q.toString();
}

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };
const unescape = (s) => s.replace(/&(#?\w+);/g, (m, e) => ENT[e] ?? (e[0] === "#" ? String.fromCodePoint(+e.slice(1).replace(/^x/, "0x")) : m));
const text = (s) => unescape(unescape(s || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

async function get(url) {
  const r = await fetch(url, { headers: { "User-Agent": "jobber/0.1" }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

const job = (source, company, title, location, remote, posted, url, desc, openTo = "") => ({
  id: url, source, company: (company || "").trim(), title: title.trim(), location: location || "", remote: !!remote,
  posted: posted ? new Date(posted).toISOString() : null, url, openTo, description: text(desc).slice(0, 6000),
});

const greenhouse = async (t) =>
  (await get(`https://boards-api.greenhouse.io/v1/boards/${t}/jobs?content=true`)).jobs.map((j) => {
    const loc = j.location?.name || "";
    const meta = (j.metadata || []).map((m) => String(m.value)).join(" ");
    return job("Greenhouse", j.company_name || t, j.title, loc, /remote/i.test(loc + meta), j.first_published || j.updated_at, j.absolute_url, j.content);
  });

const lever = async (t) =>
  (await get(`https://api.lever.co/v0/postings/${t}?mode=json`)).map((j) => {
    const c = j.categories || {};
    return job("Lever", t, j.text, (c.allLocations || [c.location || ""]).join(", "), j.workplaceType === "remote", j.createdAt, j.hostedUrl, `${j.descriptionPlain || ""} ${j.additionalPlain || ""}`);
  });

const ashby = async (t) =>
  (await get(`https://api.ashbyhq.com/posting-api/job-board/${t}`)).jobs.map((j) => {
    const locs = [j.location, ...(j.secondaryLocations || []).map((s) => s.location)].filter(Boolean);
    return job("Ashby", t, j.title, locs.join(" | "), j.isRemote || j.workplaceType === "Remote", j.publishedAt, j.jobUrl, j.descriptionHtml);
  });

async function himalayas(q) {
  const out = [];
  for (const page of [1, 2, 3]) {
    const { jobs = [] } = await get(`https://himalayas.app/jobs/api/search?${new URLSearchParams({ q, page })}`);
    for (const j of jobs) {
      const open = (j.locationRestrictions || []).join(", ") || "Worldwide";
      out.push(job("Himalayas", j.companyName, j.title, open, true, +j.pubDate * 1000, j.applicationLink, j.description, open));
    }
    if (jobs.length < 20) break;
  }
  return out;
}

const remotive = async (q) =>
  (await get(`https://remotive.com/api/remote-jobs?${new URLSearchParams({ search: q })}`)).jobs.map((j) =>
    job("Remotive", j.company_name, j.title, j.candidate_required_location, true, `${j.publication_date}Z`, j.url, j.description, j.candidate_required_location),
  );

export async function GET(request) {
  const p = new URLSearchParams(normalizeQuery(new URL(request.url).searchParams));
  const titles = p.get("titles").split(",");
  const maxAge = +p.get("maxAge");

  // Built-in boards plus the user's own, without duplicates.
  const boards = Object.fromEntries(SOURCES.map((s) => [s, new Set(BOARDS[s])]));
  for (const b of (p.get("boards") || "").split(",").filter(Boolean)) {
    const [source, slug] = b.split(":");
    boards[source].add(slug);
  }
  const fetchers = { greenhouse, lever, ashby };
  const tasks = [
    ...SOURCES.flatMap((s) => [...boards[s]].map((t) => fetchers[s](t))),
    ...titles.flatMap((t) => [himalayas(t), remotive(t)]),
  ];
  // One board failing never breaks the feed.
  const settled = await Promise.allSettled(tasks);
  const failed = settled.filter((s) => s.status === "rejected").length;

  const now = Date.now();
  const seen = new Set();
  const jobs = [];
  for (const j of settled.flatMap((s) => (s.status === "fulfilled" ? s.value : []))) {
    const t = j.title.toLowerCase();
    const key = `${j.company.toLowerCase()}|${t}`;
    if (!titles.some((w) => t.includes(w)) || !j.posted || seen.has(j.url) || seen.has(key)) continue;
    const ageDays = Math.floor((now - Date.parse(j.posted)) / 864e5);
    if (ageDays > maxAge) continue;
    seen.add(j.url).add(key);
    jobs.push({ ...j, ageDays });
  }
  jobs.sort((a, b) => a.ageDays - b.ageDays);

  return Response.json(
    { jobs, sources: tasks.length, failed, fetchedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600" } },
  );
}

// Self-check (no network): node api/jobs.js
if (typeof process !== "undefined" && process.argv?.[1]?.endsWith("jobs.js") && process.argv[1].includes("api")) {
  const eq = (a, b, m) => { if (a !== b) throw new Error(`${m}: ${a} != ${b}`); };
  const n = (s) => normalizeQuery(new URLSearchParams(s));
  eq(n("titles=Senior PM, product manager&maxAge=60"), n("maxAge=60&titles=product  manager,senior pm&x=1&junk=2"), "same search, same key");
  eq(n("titles=pm&maxAge=999"), n("titles=pm&maxAge=90"), "maxAge clamped high");
  eq(n("titles=pm&maxAge=-5"), n("titles=pm&maxAge=7"), "maxAge clamped low");
  eq(new URLSearchParams(n("titles=a,b,c,d,e,f,g")).get("titles").split(",").length, 5, "max 5 titles");
  eq(new URLSearchParams(n("boards=greenhouse:razorpay,evil:x,lever:../etc,ashby:linear,greenhouse:razorpay")).get("boards"), "ashby:linear,greenhouse:razorpay", "boards validated");
  if (!BOARDS.greenhouse.length) throw new Error("companies.json not loaded");
  console.log("api/jobs.js ok");
}
