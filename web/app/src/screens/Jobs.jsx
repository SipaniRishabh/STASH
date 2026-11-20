import { useEffect, useMemo, useState } from "react";
import { DEFAULT_EXCLUDE, ELIG, eligibility, excludedBy, flags, inIndia, matchScore, overlap } from "../lib/jobs.js";
import { Err, Spinner, go } from "../ui.jsx";
import { useStored } from "../lib/store.js";

const HOUR = 36e5;

// Filter bubbles. Each group is one row; the first option in a group means "no filter".
const STATUS = [["open", "Open to you"], ["verify", "Check eligibility"], ["no", "Not open to you"], ["all", "All"], ["archived", "Archived"]];
const WHERE = [["any", "India + abroad"], ["india", "India"], ["abroad", "Abroad"]];
const MODE = [["any", "Remote + on-site"], ["remote", "Remote"], ["onsite", "On-site / hybrid"]];
const SORT = [["fit", "Best fit"], ["new", "Newest"]];

const statusOf = (r) => (r.elig.status === "ok" ? "open" : r.elig.status);
const whereOk = (where, job) => where === "any" || (where === "india") === inIndia(job);
const modeOk = (mode, job) => mode === "any" || (mode === "remote") === !!job.remote;
const companyKey = (name) => (name || "").trim().toLowerCase();

export default function Jobs({ apiKey, demo, profile, prefs, matches, setCurrent }) {
  const [feed, setFeed] = useStored("feed", null);
  const [archived, setArchived] = useStored("archived", {}); // job id -> { job, at }
  const [companies, setCompanies] = useStored("companies", {}); // company name -> lookup result
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // Filters are remembered, so the page opens the way the user left it.
  const [show, setShow] = useStored("jobs-show", "open");
  const [where, setWhere] = useStored("jobs-where", "any");
  const [mode, setMode] = useStored("jobs-mode", "any");
  const [sort, setSort] = useStored("jobs-sort", "fit");
  const [paste, setPaste] = useState({ text: "", url: "" });

  const exclude = prefs.exclude ?? DEFAULT_EXCLUDE;
  const query = `titles=${encodeURIComponent(prefs.titles.join(","))}&maxAge=${prefs.maxAge}${prefs.boards?.trim() ? `&boards=${encodeURIComponent(prefs.boards)}` : ""}`;

  async function load() {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch(`/api/jobs?${query}`);
      if (!r.ok) throw new Error(r.status === 429 ? "Too many searches. Wait a few minutes and try again." : `Job search failed (${r.status}). Try again in a minute.`);
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

  const row = (job) => ({ job, elig: eligibility(job, prefs), flags: flags(job, prefs), hits: overlap(job, profile?.resume) });

  const rows = useMemo(() => {
    if (!feed) return [];
    return feed.jobs.filter((j) => !excludedBy(j.title, exclude)).map(row);
  }, [feed, prefs, profile]);
  const skipped = feed ? feed.jobs.length - rows.length : 0;

  // Location and work-mode bubbles narrow everything, so the status counts always match what a click shows.
  const narrowed = rows.filter((r) => whereOk(where, r.job) && modeOk(mode, r.job));
  const live = narrowed.filter((r) => !archived[r.job.id]);
  const archivedRows = Object.values(archived)
    .filter((a) => whereOk(where, a.job) && modeOk(mode, a.job))
    .sort((a, b) => b.at - a.at)
    .map((a) => row(a.job));
  const counts = { open: 0, verify: 0, no: 0, all: live.length, archived: archivedRows.length };
  live.forEach((r) => counts[statusOf(r)]++);

  const latest = (id) => matches[id]?.tailoredScore?.result || matches[id]?.result;
  const visible = (show === "archived" ? archivedRows : live.filter((r) => show === "all" || statusOf(r) === show)).sort((a, b) => {
    if (sort === "new") return (a.job.ageDays ?? 999) - (b.job.ageDays ?? 999);
    // Scored jobs first by score, then quick skill overlap; each flag costs a little rank.
    const k = (r) => { const s = latest(r.job.id); return (s ? 1000 + matchScore(s) : r.hits.length * 5) - r.flags.length * 3; };
    return k(b) - k(a);
  });

  const archive = (job) => setArchived((a) => ({ ...a, [job.id]: { job, at: Date.now() } }));
  const restore = (job) => setArchived(({ [job.id]: _, ...rest }) => rest);

  async function lookUp(job) {
    const key = companyKey(job.company);
    setCompanies((c) => ({ ...c, [key]: { loading: true } }));
    try {
      const { companyInfo } = await import("../lib/claude.js");
      const info = await companyInfo(apiKey, job.company, job.url);
      setCompanies((c) => ({ ...c, [key]: { ...info, at: Date.now() } }));
    } catch (e) {
      setCompanies((c) => ({ ...c, [key]: { error: e.message } }));
    }
  }

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

  const rowProps = (r) => ({
    ...r,
    scored: latest(r.job.id),
    onOpen: () => open(r.job),
    isArchived: !!archived[r.job.id],
    onArchive: () => archive(r.job),
    onRestore: () => restore(r.job),
    info: companies[companyKey(r.job.company)],
    onLookUp: apiKey && !demo ? () => lookUp(r.job) : null,
  });

  return (
    <>
      <div className="row between">
        <div>
          <h2>Jobs for you</h2>
          <p className="sub">{prefs.titles.join(", ")} · posted in the last {prefs.maxAge} days · from Greenhouse, Lever, Ashby, Himalayas and Remotive.</p>
        </div>
        <button className="btn ghost sm" onClick={load} disabled={busy}>{busy ? <><Spinner /> Searching…</> : "Refresh"}</button>
      </div>

      {feed && (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", marginBottom: 16 }}>
          <div className="stat"><b>{feed.jobs.length}</b><span className="small muted">jobs found</span></div>
          <div className="stat"><b>{feed.sources - feed.failed}<span className="small muted" style={{ fontWeight: 400 }}> / {feed.sources}</span></b><span className="small muted">job boards searched</span></div>
          <div className="stat"><b>{counts.open}</b><span className="small muted">open to you</span></div>
          <div className="stat"><b>{skipped}</b><span className="small muted">skipped by title filter</span></div>
          <div className="stat"><b>{counts.archived}</b><span className="small muted">archived</span></div>
        </div>
      )}

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
          {pasted.map((m) => <JobRow key={m.job.id} {...rowProps({ job: m.job, elig: { status: m.result.eligibility }, flags: flags(m.job, prefs), hits: overlap(m.job, profile.resume) })} />)}
          <h3 style={{ marginTop: 18 }}>From job boards</h3>
        </>
      )}

      {feed && (
        <>
          <Bubbles label="Eligibility" options={STATUS} value={show} onChange={setShow} counts={counts} />
          <div className="row" style={{ gap: 18, alignItems: "flex-start" }}>
            <Bubbles label="Location" options={WHERE} value={where} onChange={setWhere} />
            <Bubbles label="Work mode" options={MODE} value={mode} onChange={setMode} />
            <Bubbles label="Sort" options={SORT} value={sort} onChange={setSort} />
          </div>
          <p className="small muted" style={{ margin: "0 0 12px" }}>
            Showing {visible.length} · updated {new Date(feed.fetchedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            {feed.failed ? ` · ${feed.failed} of ${feed.sources} boards didn't respond` : ""}
            {skipped ? ` · title filter skips: ${exclude.join(", ")}` : ""}
          </p>
          {!visible.length && (
            <p className="muted">
              {show === "archived" ? "Nothing archived. Use Archive on a job you've already applied to elsewhere or don't want to see again." : "No jobs here. Try another filter, more titles, or a longer time window on the Resume step."}
            </p>
          )}
          {visible.map((r) => <JobRow key={r.job.id} {...rowProps(r)} />)}
        </>
      )}
      {!feed && busy && <p className="muted"><Spinner /> Searching job boards. This takes about 20 seconds.</p>}
    </>
  );
}

/** One row of filter bubbles. Buttons with aria-pressed, so keyboards and screen readers get a real toggle. */
function Bubbles({ label, options, value, onChange, counts }) {
  return (
    <div className="bubbles" role="group" aria-label={label}>
      {options.map(([id, text]) => (
        <button key={id} type="button" aria-pressed={value === id} className={value === id ? "on" : ""} onClick={() => onChange(id)}>
          {text}{counts ? ` (${counts[id]})` : ""}
        </button>
      ))}
    </div>
  );
}

function JobRow({ job, elig, flags, hits, scored, onOpen, isArchived, onArchive, onRestore, info, onLookUp }) {
  const [more, setMore] = useState(false);
  const m = scored ? matchScore(scored) : null;
  const col = m == null ? "var(--line)" : m >= 75 ? "var(--good)" : m >= 55 ? "var(--warn)" : "var(--bad)";
  const [cls, label] = ELIG[elig.status] || ELIG.verify;
  const stop = (fn) => (e) => { e.stopPropagation(); fn(); };
  return (
    // The whole card is clickable with a mouse; keyboard and screen-reader users get the real buttons inside it
    // (a role="button" card would hide those inner buttons from them).
    <div className="job" onClick={onOpen}>
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
          <button className="linkbtn small" aria-expanded={more} onClick={stop(() => setMore(!more))}>{more ? "Less info" : "More info"}</button>
        </div>
        {more && <MoreInfo job={job} info={info} onLookUp={onLookUp} />}
      </div>
      <div className="right" style={{ display: "grid", gap: 6, justifyItems: "end" }}>
        <button className="btn ghost sm" onClick={stop(onOpen)}>{scored ? "View match" : "Score match"}</button>
        {isArchived
          ? <button className="linkbtn small" onClick={stop(onRestore)}>Restore</button>
          : <button className="linkbtn small" onClick={stop(onArchive)}>Archive</button>}
      </div>
    </div>
  );
}

function MoreInfo({ job, info, onLookUp }) {
  const stop = (e) => e.stopPropagation();
  const fact = (k, v, asOf) => v && <tr><th style={{ width: 120 }}>{k}</th><td>{v}{asOf ? <span className="muted"> · as of {asOf}</span> : null}</td></tr>;
  return (
    <div className="card" style={{ marginTop: 10, padding: 14, cursor: "default" }} onClick={stop} onKeyDown={stop}>
      <h4 style={{ margin: "0 0 8px" }}>About {job.company || "this company"}</h4>
      {!info && (onLookUp
        ? <><p className="small muted" style={{ marginTop: 0 }}>Founded, latest revenue and funding, looked up on the web by Claude with your key (a few cents). Saved for every job at this company.</p><button className="btn sm" onClick={onLookUp}>Look up company</button></>
        : <p className="small muted" style={{ margin: 0 }}>Connect your Claude key to look up when the company was founded, its latest revenue and funding.</p>)}
      {info?.loading && <p className="small muted" style={{ margin: 0 }}><Spinner /> Searching the web. This takes 20 to 40 seconds.</p>}
      {info?.error && <><Err msg={info.error} />{onLookUp && <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={onLookUp}>Try again</button>}</>}
      {info?.found === false && <p className="small muted" style={{ margin: 0 }}>Couldn't find reliable information on this company.</p>}
      {info?.found && (
        <>
          {info.summary && <p className="small" style={{ marginTop: 0 }}>{info.summary}</p>}
          <table className="evid small"><tbody>
            {fact("Founded", info.founded)}
            {fact("Headquarters", info.headquarters)}
            {fact("Revenue", info.revenue, info.revenue_as_of)}
            {fact("Funding", info.funding, info.funding_as_of)}
          </tbody></table>
          {info.sources.length > 0 && (
            <p className="small muted" style={{ marginBottom: 0 }}>
              Sources: {info.sources.map((s, i) => <span key={s.url}>{i ? " · " : ""}<a href={s.url} target="_blank" rel="noopener noreferrer">{s.title || s.url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}</a></span>)}
            </p>
          )}
          <p className="small muted" style={{ marginBottom: 0 }}>From public reports; numbers can be out of date. Check the sources before you rely on them.
            {onLookUp && <> <button className="linkbtn small" onClick={onLookUp}>Refresh</button></>}</p>
        </>
      )}
      {job.url && /^https?:\/\//.test(job.url) && <p className="small" style={{ marginBottom: 0 }}><a href={job.url} target="_blank" rel="noopener noreferrer">Open the job posting ↗</a></p>}
    </div>
  );
}
