import { useState } from "react";
import { BANNED } from "../lib/lint.js";
import { chance } from "../lib/jobs.js";
import { CopyBtn, Err, Spinner } from "../ui.jsx";

// Jobber never submits anything. The user applies on the job's own site and tells Jobber what they decided.
export default function Apply({ apiKey, profile, current, matches, setMatches, tracker, setTracker, tasks, runTask }) {
  const saved = current && matches[current.id];
  const task = current && tasks[`cover:${current.id}`];
  const busy = !!task?.running;
  const err = task?.error || "";
  const [reason, setReason] = useState("");

  if (!saved || !profile) {
    return (
      <div className="card" style={{ maxWidth: 560 }}>
        <h2>Pick a job first</h2>
        <p className="sub">Choose and score a job, then come back here to decide whether to apply.</p>
        <a className="btn" href="#jobs" style={{ textDecoration: "none" }}>See jobs</a>
      </div>
    );
  }

  const { job, cover } = saved;
  // The latest score: the tailored resume's if it has been scored, since that's the version being sent.
  const result = saved.tailoredScore?.result || saved.result;
  const c = chance(result, job, saved.referral);
  const row = tracker.find((t) => t.jobId === job.id);
  const today = new Date().toISOString().slice(0, 10);

  function decide(status, notes) {
    if (status === "Applied" && !confirm(`Log ${job.title} at ${job.company} as applied? Only do this once you've submitted it on their site.`)) return;
    const entry = {
      date: today, company: job.company, role: job.title, location: job.location, url: job.url, jobId: job.id,
      match: String(c.match), chance: `${c.level} (${c.pct}%)`, status, notes: notes ?? row?.notes ?? "",
    };
    setTracker(row ? tracker.map((t) => (t === row ? { ...t, ...entry, date: status === "Applied" ? today : t.date } : t)) : [entry, ...tracker]);
  }

  function draft() {
    const id = current.id;
    runTask(`cover:${id}`, `Drafting cover note for ${job.company}`, async () => {
      const { coverNote } = await import("../lib/claude.js");
      const out = await coverNote(apiKey, saved.tailored?.resume || profile.resume, job, result);
      setMatches((m) => ({ ...m, [id]: { ...m[id], cover: out } }));
    });
  }

  const flagged = (s) => BANNED.filter((w) => s.toLowerCase().includes(w)).concat(/[—–]/.test(s) ? ["dash"] : []);
  const piece = (title, text, extra) => {
    const f = flagged(text);
    return (
      <div style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
        <div className="row between"><b className="small">{title}</b><div className="row">{extra}{f.length > 0 && <span className="pill warn">Check wording: {f.join(", ")}</span>}<CopyBtn text={text} /></div></div>
        <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{text}</p>
      </div>
    );
  };

  return (
    <>
      <div className="row between" style={{ marginBottom: 12 }}>
        <div>
          <h2>Apply</h2>
          <p className="sub">{job.title} at {job.company} · match {c.match} · interview chance {c.level} ({c.pct}%)</p>
        </div>
        <a className="btn ghost sm" href="#match" style={{ textDecoration: "none" }}>Back to match report</a>
      </div>
      <Err msg={err} />

      <div className="grid g2">
        <div className="card">
          <h3>1 · Decide</h3>
          {row ? (
            <p className="small">In your tracker as <span className="pill blue">{row.status}</span> since {row.date}.</p>
          ) : (
            <p className="small muted">Not in your tracker yet.</p>
          )}
          <div className="grid" style={{ gap: 8 }}>
            <button className="btn ghost" onClick={() => decide("Planning to apply")}>I'm going to apply</button>
            <div className="row" style={{ flexWrap: "nowrap" }}>
              <input aria-label="Reason for not applying" placeholder="Why not? (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
              <button className="btn ghost" style={{ whiteSpace: "nowrap" }} onClick={() => { decide("Not applying", reason.trim()); setReason(""); }}>Not applying</button>
            </div>
          </div>

          <h3 style={{ marginTop: 18 }}>2 · Apply on their site</h3>
          <p className="small muted">Jobber doesn't submit anything for you. Use your tailored resume and the answers on the right, then come back and confirm.</p>
          <div className="grid" style={{ gap: 8 }}>
            {job.url && /^https?:\/\//.test(job.url)
              ? <a className="btn ghost" href={job.url} target="_blank" rel="noopener noreferrer" style={{ textAlign: "center", textDecoration: "none" }}>Open job page ↗</a>
              : <p className="small muted" style={{ margin: 0 }}>No job link saved for this job.</p>}
            <a className="btn ghost" href="#tailor" style={{ textAlign: "center", textDecoration: "none" }}>{saved.tailored ? "Download tailored resume" : "Tailor my resume first"}</a>
            <button className="btn" onClick={() => decide("Applied")}>I've submitted my application</button>
          </div>
          <p className="small muted" style={{ marginBottom: 0 }}>Track progress (intro call, interview, result) on the <a href="#tracker">Tracker</a>.</p>
        </div>

        <div className="card">
          <h3>Answers and cover note</h3>
          {cover ? (
            <>
              {piece("Why this company?", cover.why_company)}
              {piece("Why this role?", cover.why_role)}
              {piece("Cover note", cover.cover_note, <span className="small muted">{cover.cover_note.split(/\s+/).length} words</span>)}
              <button className="linkbtn small" style={{ marginTop: 10 }} onClick={draft} disabled={busy}>{busy ? "Drafting…" : "Draft again"}</button>
            </>
          ) : (
            <>
              <p className="sub">Short answers for the usual "why us / why this role" questions and a cover note under 120 words, from your resume facts only. Optional: one small Claude call (a few cents).</p>
              {apiKey
                ? <button className="btn" onClick={draft} disabled={busy}>{busy ? <><Spinner /> Drafting…</> : "Draft answers and cover note"}</button>
                : <a className="btn" href="#setup" style={{ textDecoration: "none" }}>Connect your key</a>}
            </>
          )}
        </div>
      </div>
    </>
  );
}
