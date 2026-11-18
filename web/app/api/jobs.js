// GET /api/jobs?titles=Product Manager,Senior Product Manager&maxAge=60
// Fetches public job boards, keeps fresh title matches, returns plain-text jobs. Never sees the key or resume.
// Vercel caches the response for 1 hour (s-maxage). In dev, vite.config.js mounts this same handler.

const BOARDS = {
  greenhouse: ["groww", "slice", "inmobi", "hackerrank", "databricks", "stripe", "figma", "airbnb", "coinbase", "gitlab", "anthropic", "remote", "mongodb"],
  lever: ["meesho", "cred"],
  ashby: ["notion", "openai", "perplexity", "cohere", "zapier", "deel"],
};

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
  const p = new URL(request.url).searchParams;
  const titles = (p.get("titles") || "product manager").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 5);
  const maxAge = Math.min(+p.get("maxAge") || 60, 90);

  const tasks = [
    ...BOARDS.greenhouse.map((t) => greenhouse(t)),
    ...BOARDS.lever.map((t) => lever(t)),
    ...BOARDS.ashby.map((t) => ashby(t)),
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
