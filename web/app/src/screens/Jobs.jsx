import { useEffect, useMemo, useState } from "react";
import { ELIG, eligibility, flags, overlap } from "../lib/jobs.js";
import { Err, Spinner, go } from "../ui.jsx";
import { useStored } from "../lib/store.js";

const HOUR = 36e5;

export default function Jobs({ profile, prefs, matches, setCurrent }) {
  const [feed, setFeed] = useStored("feed", null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [show, setShow] = useState("open");
  const [sort, setSort] = useState("fit");
  const [paste, setPaste] = useState({ text: "", url: "" });

  const query = `titles=${encodeURIComponent(prefs.titles.join(","))}&maxAge=${prefs.maxAge}`;

  async function load() {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch(`/api/jobs?${query}`);
      if (!r.ok) throw new Error(`Job search failed (${r.status}). Try again in a minute.`);
      const d = await r.json();
      setFeed({ ...d, query });
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  // Refetch when preferences change or the cached feed is over an hour old.
  useEffect(() => {
    if (!feed || feed.query !== query || Date.now() - Date.parse(feed.fetchedAt) > HOUR) load();
  }, [query]);

  const rows = useMemo(() => {
    if (!feed) return [];
    return feed.jobs.map((j) => ({ job: j, elig: eligibility(j, prefs), flags: flags(j, prefs), hits: overlap(j, profile?.resume) }));
  }, [feed, prefs, profile]);

  const counts = { open: 0, verify: 0, no: 0 };
  rows.forEach((r) => counts[r.elig.status === "ok" ? "open" : r.elig.status]++);
  const visible = rows
    .filter((r) => show === "all" || (show === "open" ? r.elig.status === "ok" : r.elig.status === show))
    .sort((a, b) => {
      const latest = (m) => m && (m.tailoredScore?.result || m.result);
      const sa = latest(matches[a.job.id]), sb = latest(matches[b.job.id]);
      if (sort === "new") return a.job.ageDays - b.job.ageDays;
      // Scored jobs first by score, then quick skill overlap; each flag costs a little rank.
      const k = (r, s) => (s ? 1000 + scoreOf(s) : r.hits.length * 5) - r.flags.length * 3;
      return k(b, sb) - k(a, sa);
    });

  const pasted = Object.values(matches).filter((m) => m.job.source === "Pasted");

  function open(job) {
    setCurrent(job);
    go("match");
  }

  function scorePasted() {
    const text = paste.text.trim();
    if (text.length < 200) return setErr("Paste the full job description (at least a few paragraphs).");
    open({ id: `paste:${Date.now()}`, source: "Pasted", company: "", title: "Pasted job", location: "", remote: false, posted: null, ageDays: null, url: paste.url.trim(), openTo: "", description: text.slice(0, 12000) });
    setPaste({ text: "", url: "" });
  }

  if (!profile) {
    return (
      <div className="card" style={{ maxWidth: 560 }}>
        <h2>No resume yet</h2>
        <p className="sub">Jobs are matched to your resume. Upload it first, or try the demo.</p>
        <a className="btn" href="#resume" style={{ textDecoration: "none" }}>Upload resume</a>
      </div>
    );
  }

  return (
    <>
      <div className="row between">
        <div>
          <h2>Jobs for you</h2>
          <p className="sub">{prefs.titles.join(", ")} · posted in the last {prefs.maxAge} days · from Greenhouse, Lever, Ashby, Himalayas and Remotive.</p>
        </div>
        <button className="btn ghost sm" onClick={load} disabled={busy}>{busy ? <><Spinner /> Searching…</> : "Refresh"}</button>
      </div>

      <div className="card paste" style={{ marginBottom: 16 }}>
        <div className="row between"><h3 style={{ margin: 0 }}>Found a job on LinkedIn or Naukri?</h3><span className="small muted">Paste the job description and Jobber runs the same checks</span></div>
        <textarea aria-label="Job description" placeholder="Paste the full job description here…" style={{ marginTop: 10, minHeight: 70 }} value={paste.text} onChange={(e) => setPaste({ ...paste, text: e.target.value })} />
        <div className="row" style={{ marginTop: 10 }}>
          <input aria-label="Job link" placeholder="Job link (optional)" style={{ flex: 1, width: "auto" }} value={paste.url} onChange={(e) => setPaste({ ...paste, url: e.target.value })} />
          <button className="btn" onClick={scorePasted}>Score this job</button>
        </div>
      </div>

      <Err msg={err} />

      {pasted.length > 0 && (
        <>
          <h3>Jobs you pasted</h3>
          {pasted.map((m) => <JobRow key={m.job.id} job={m.job} elig={{ status: m.result.eligibility }} flags={flags(m.job, prefs)} hits={overlap(m.job, profile.resume)} scored={m.tailoredScore?.result || m.result} onOpen={() => open(m.job)} />)}
          <h3 style={{ marginTop: 18 }}>From job boards</h3>
        </>
      )}

      {feed && (
        <>
          <div className="filters" style={{ marginTop: 12 }}>
            <select aria-label="Eligibility" value={show} onChange={(e) => setShow(e.target.value)}>
              <option value="open">Open to you ({counts.open})</option>
              <option value="verify">Check eligibility ({counts.verify})</option>
              <option value="no">Not open to you ({counts.no})</option>
              <option value="all">All ({rows.length})</option>
            </select>
            <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="fit">Sort: best fit</option>
              <option value="new">Sort: newest</option>
            </select>
            <span className="small muted" style={{ alignSelf: "center" }}>
              Updated {new Date(feed.fetchedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              {feed.failed ? ` · ${feed.failed} of ${feed.sources} boards didn't respond` : ""}
            </span>
          </div>
          {!visible.length && <p className="muted">No jobs here. Try another filter, more titles, or a longer time window on the Resume step.</p>}
          {visible.map((r) => <JobRow key={r.job.id} {...r} scored={matches[r.job.id]?.tailoredScore?.result || matches[r.job.id]?.result} onOpen={() => open(r.job)} />)}
        </>
      )}
      {!feed && busy && <p className="muted"><Spinner /> Searching job boards. This takes about 20 seconds.</p>}
    </>
  );
}

const scoreOf = (s) => Object.values(s.parts).reduce((a, p) => a + p.score, 0);

function JobRow({ job, elig, flags, hits, scored, onOpen }) {
  const m = scored ? scoreOf(scored) : null;
  const col = m == null ? "var(--line)" : m >= 75 ? "var(--good)" : m >= 55 ? "var(--warn)" : "var(--bad)";
  const [cls, label] = ELIG[elig.status];
  return (
    <div className="job" onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onOpen()}>
      <div className="ring" style={{ "--p": m ?? 0, "--c": col }} title={m == null ? "Not scored yet" : "Match score"}>
        <span className={m == null ? "small muted" : ""}>{m ?? "–"}</span>
      </div>
      <div>
        <h3>{job.title}</h3>
        <div className="small muted">{job.company} · {job.location || "Location not listed"}{job.remote ? " · Remote" : ""} · {job.ageDays == null ? "date unknown" : job.ageDays === 0 ? "today" : `${job.ageDays}d ago`} · {job.source}</div>
        <div className="row" style={{ marginTop: 6, gap: 6 }}>
          <span className={`pill ${cls}`}>{label}</span>
          {hits.length > 0 && <span className="pill">{hits.length} of your skills mentioned</span>}
          {flags.map((f) => <span key={f} className="pill warn">{f}</span>)}
        </div>
      </div>
      <span className="btn ghost sm right" style={{ justifySelf: "start" }}>{scored ? "View match" : "Score match"}</span>
    </div>
  );
}
