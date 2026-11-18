import { useEffect, useState } from "react";
import { ELIG, RUBRIC, chance, flags } from "../lib/jobs.js";
import { Err, Gauge, Spinner } from "../ui.jsx";

const STATUS = { met: ["good", "Met"], partial: ["warn", "Partial"], gap: ["bad", "Gap"] };

/**
 * Score a job against the original resume ("original") or this job's tailored resume ("tailored").
 * Runs as an app-level task, so it keeps going if the user leaves the step. Shared with the Tailor screen.
 */
export function scoreTask(which, job0, { apiKey, profile, prefs, matches, setMatches, runTask }) {
  const tailored = matches[job0.id]?.tailored;
  const resume = which === "tailored" ? tailored.resume : profile.resume;
  const key = which === "tailored" ? `score-tailored:${job0.id}` : `score:${job0.id}`;
  const label = `Scoring ${which === "tailored" ? "tailored resume for " : ""}${job0.company || "job"}`;
  runTask(key, label, async () => {
    const { scoreJob } = await import("../lib/claude.js");
    const result = await scoreJob(apiKey, resume, job0, prefs, profile.evidence || []);
    if (which === "tailored") {
      setMatches((m) => ({ ...m, [job0.id]: { ...m[job0.id], tailoredScore: { result, at: Date.now(), tailoredAt: tailored.at } } }));
      return;
    }
    // Pasted jobs get their title/company from Claude's read of the text.
    const job = job0.source === "Pasted" ? { ...job0, title: result.job_title || "Pasted job", company: result.company, location: result.location } : job0;
    setMatches((m) => ({ ...m, [job0.id]: { ...m[job0.id], job, result, referral: m[job0.id]?.referral || false, scoredAt: Date.now() } }));
  });
}

const SOURCE = { experience: "From your experience", skills: "From your Skills section", implied: "Implied by your PM years", you: "Added by you" };

export default function Match({ apiKey, profile, setProfile, prefs, current, matches, setMatches, tasks, runTask }) {
  const saved = current && matches[current.id];
  const ts = saved?.tailoredScore;
  const [pick, setPick] = useState(null); // "original" | "tailored"; defaults to tailored once it's scored
  const view = pick || (ts ? "tailored" : "original");
  const task = current && tasks[`score:${current.id}`];
  const tTask = current && tasks[`score-tailored:${current.id}`];
  const viewTask = view === "tailored" ? tTask : task;
  const busy = !!viewTask?.running;
  const err = viewTask?.error || "";
  const [editing, setEditing] = useState(null); // requirement text being edited
  const [draft, setDraft] = useState("");
  const evidence = profile?.evidence || [];

  const ctx = { apiKey, profile, prefs, matches, setMatches, runTask };
  const run = (which = "original") => {
    if (which === "tailored") setPick("tailored");
    scoreTask(which, current, ctx);
  };

  useEffect(() => {
    if (current && profile && apiKey && !saved && !task) run();
  }, [current?.id]);

  if (!current) {
    return (
      <div className="card" style={{ maxWidth: 560 }}>
        <h2>Pick a job first</h2>
        <p className="sub">Choose a job from the list, or paste one, to see how well you match.</p>
        <a className="btn" href="#jobs" style={{ textDecoration: "none" }}>See jobs</a>
      </div>
    );
  }

  const job = saved?.job || current;
  const header = (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="row between">
        <div>
          <h2 style={{ marginBottom: 2 }}>{job.title}</h2>
          <div className="small muted">
            {[job.company, job.location, job.remote && "Remote", job.ageDays != null && `posted ${job.ageDays}d ago`, job.source].filter(Boolean).join(" · ")}
          </div>
        </div>
        <div className="row">
          {job.url && /^https?:\/\//.test(job.url) && <a className="btn ghost sm" href={job.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>Open job ↗</a>}
          <a className="btn ghost sm" href="#jobs" style={{ textDecoration: "none" }}>All jobs</a>
        </div>
      </div>
      {job.ageDays == null && <div className="note" style={{ marginTop: 12, background: "var(--warn-soft)", color: "#7a3d0b" }}>Posting date unknown. Check the job is still open and recent before you spend time on it.</div>}
    </div>
  );

  if (!saved) {
    return (
      <>
        {header}
        <Err msg={err} />
        {busy ? (
          <p className="muted"><Spinner /> Scoring this job against your resume. This takes 20 to 40 seconds.</p>
        ) : !apiKey ? (
          <div className="card" style={{ maxWidth: 560 }}>
            <h3>Scoring needs your Claude key</h3>
            <p className="sub">The match report is written by Claude using your own key. Connect it to score this job.</p>
            <a className="btn" href="#setup" style={{ textDecoration: "none" }}>Connect key</a>
          </div>
        ) : (
          <button className="btn" onClick={run}>Score this job</button>
        )}
      </>
    );
  }

  const r = view === "tailored" ? ts.result : saved.result;
  const c = chance(r, job, saved.referral);
  const tailoredFresh = ts && saved.tailored && ts.tailoredAt === saved.tailored.at;
  const [ecls, elabel] = ELIG[r.eligibility];
  const setReferral = (v) => setMatches((m) => ({ ...m, [current.id]: { ...saved, referral: v } }));
  const met = r.requirements.filter((x) => x.status === "met").length;
  const jobFlags = flags(job, prefs);
  // Evidence added after this job was last scored: shown on the row, counted toward the re-score prompt.
  const pending = evidence.filter((e) => e.at > ((view === "tailored" ? ts.at : saved.scoredAt) || 0));
  const pendingFor = (req) => pending.find((e) => e.requirement === req);

  function addEvidence(requirement) {
    const text = draft.trim();
    if (!text) return;
    setProfile({ ...profile, evidence: [...evidence.filter((e) => e.requirement !== requirement), { requirement, text, at: Date.now(), job: `${job.title} at ${job.company}` }] });
    setEditing(null);
    setDraft("");
  }
  const removeEvidence = (requirement) => setProfile({ ...profile, evidence: evidence.filter((e) => e.requirement !== requirement) });

  const scoreOfR = (res) => chance(res, job, saved.referral).match;
  return (
    <>
      {header}
      {saved.tailored && !tailoredFresh && (
        <div className="note row between" style={{ marginBottom: 16 }}>
          <span>{ts ? "Your tailored resume changed since it was scored." : "You have a tailored resume for this job."} See how it scores against this job: one Claude call on your key (about $0.10).</span>
          <button className="btn sm" onClick={() => run("tailored")} disabled={!!tTask?.running}>{tTask?.running ? <><Spinner /> Scoring…</> : "Re-score with tailored resume"}</button>
        </div>
      )}
      {ts && (
        <div className="filters" role="tablist" aria-label="Which resume">
          {[["original", "Original resume", saved.result], ["tailored", "Tailored resume", ts.result]].map(([k, label, res]) => (
            <button key={k} role="tab" aria-selected={view === k} className={`btn sm ${view === k ? "" : "ghost"}`} onClick={() => setPick(k)}>{label} · {scoreOfR(res)}</button>
          ))}
        </div>
      )}
      <div className="report">
        <div className="card rail">
          <Gauge score={c.match} label={view === "tailored" ? "Match (tailored)" : "Match"}>
            <div style={{ marginTop: 8 }}>
              <span className={`pill ${c.level === "High" ? "good" : c.level === "Medium" ? "warn" : "bad"}`}>Interview chance: {c.level} · {c.pct}%</span>
            </div>
          </Gauge>
          <ul className="checks" style={{ marginTop: 16 }}>
            {RUBRIC.map(([k, name, max]) => (
              <li key={k}><span>{name}</span><b>{Math.max(0, Math.min(max, r.parts[k].score))}/{max}</b></li>
            ))}
          </ul>
          <label className="row small" style={{ fontWeight: 400, marginTop: 14, flexWrap: "nowrap" }}>
            <input type="checkbox" style={{ width: "auto" }} checked={saved.referral} onChange={(e) => setReferral(e.target.checked)} />
            I have a referral at this company
          </label>
          <a className="btn" href="#tailor" style={{ display: "block", textAlign: "center", textDecoration: "none", marginTop: 14 }}>Tailor my resume for this job</a>
          <button className="linkbtn small" style={{ display: "block", margin: "10px auto 0" }} onClick={() => run(view)} disabled={busy}>{busy ? "Re-scoring…" : "Score again"}</button>
        </div>

        <div className="detail">
          <Err msg={err} />
          <div className="card" style={{ marginBottom: 16 }}>
            <h3>Why this score</h3>
            <ul style={{ paddingLeft: 18, margin: 0 }}>{r.why.map((w) => <li key={w}>{w}</li>)}</ul>
            <div className="row" style={{ marginTop: 12, gap: 6 }}>
              <span className={`pill ${ecls}`}>{elabel}</span>
              <span className="small muted">{r.eligibility_note}</span>
            </div>
            {jobFlags.length > 0 && <div className="row" style={{ marginTop: 8, gap: 6 }}>{jobFlags.map((f) => <span key={f} className="pill warn">{f}</span>)}</div>}
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <h3>Requirements and your evidence</h3>
            <p className="small muted">
              {met} of {r.requirements.length} requirements met. Evidence comes from your experience, your Skills section, everyday PM
              practice for your years as a PM, or what you add here. Missed something? Use <b>I have this</b> on any gap or partial.
            </p>
            {pending.length > 0 && (
              <div className="note row between" style={{ marginBottom: 12 }}>
                <span>
                  You've added {pending.length} piece{pending.length > 1 ? "s" : ""} of evidence since this score. Add everything you want first,
                  then re-score once: each re-score is one Claude call on your key (about $0.10).
                </span>
                <button className="btn sm" onClick={() => run(view)} disabled={busy}>{busy ? <><Spinner /> Re-scoring…</> : "Re-score with my updates"}</button>
              </div>
            )}
            <table className="evid">
              <thead><tr><th>Job asks for</th><th>Your evidence</th><th /></tr></thead>
              <tbody>
                {r.requirements.map((x, i) => {
                  const mine = pendingFor(x.requirement);
                  return (
                    <tr key={i}>
                      <td>{x.requirement}</td>
                      <td>
                        {x.evidence ? <div>{x.evidence}</div> : <div className="muted">Not shown in your resume</div>}
                        {SOURCE[x.source] && <div className="small muted" style={{ marginTop: 2 }}>{SOURCE[x.source]}</div>}
                        {mine && editing !== x.requirement && (
                          <div className="small" style={{ marginTop: 6 }}>
                            <b>Your note:</b> {mine.text} <span className="pill blue">Re-score to count it</span>{" "}
                            <button className="linkbtn small" onClick={() => { setEditing(x.requirement); setDraft(mine.text); }}>Edit</button>{" · "}
                            <button className="linkbtn small" onClick={() => removeEvidence(x.requirement)}>Remove</button>
                          </div>
                        )}
                        {editing === x.requirement && (
                          <div style={{ marginTop: 8 }}>
                            <textarea autoFocus aria-label={`Your evidence for ${x.requirement}`} style={{ minHeight: 60 }} placeholder="Where and how you did this, in your own words. e.g. Wrote PRDs for every checkout release at PaySprout, reviewed with eng and design." value={draft} onChange={(e) => setDraft(e.target.value)} />
                            <div className="row" style={{ marginTop: 6 }}>
                              <button className="btn sm" onClick={() => addEvidence(x.requirement)}>Save</button>
                              <button className="btn ghost sm" onClick={() => setEditing(null)}>Cancel</button>
                            </div>
                          </div>
                        )}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <span className={`pill ${STATUS[x.status][0]}`}>{STATUS[x.status][1]}</span>
                        {x.status !== "met" && !mine && editing !== x.requirement && (
                          <div><button className="linkbtn small" style={{ marginTop: 6 }} onClick={() => { setEditing(x.requirement); setDraft(""); }}>I have this</button></div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {evidence.length > 0 && <p className="small muted" style={{ marginBottom: 0 }}>Evidence you add is saved with your resume and used for every job you score. Tailoring may use it, in your words.</p>}
          </div>

          <div className="grid g2" style={{ marginBottom: 16 }}>
            <div className="card">
              <h3>Gaps</h3>
              {r.gaps.length ? (
                <>
                  <div className="row" style={{ gap: 6 }}>{r.gaps.map((g) => <span key={g} className="pill bad">{g}</span>)}</div>
                  <p className="small muted" style={{ marginBottom: 0 }}>Jobber won't add these to your resume. If you have related experience that isn't written down, add it to your resume in your own words first.</p>
                </>
              ) : <p className="small muted" style={{ margin: 0 }}>No gaps found.</p>}
            </div>
            <div className="card">
              <h3>Keywords recruiters will look for</h3>
              <div className="row" style={{ gap: 6 }}>{r.must_have_keywords.map((k) => <span key={k} className="pill">{k}</span>)}</div>
            </div>
          </div>

          <div className="card">
            <h3>How the interview chance was estimated</h3>
            <ul className="checks">
              <li><span>Match score</span><b>{c.match}</b></li>
              {c.adj.map(([why, d]) => <li key={why}><span>{why}</span><b>{d > 0 ? `+${d}` : d}</b></li>)}
              {c.capped && <li><span>Missing a hard requirement, so capped at Low</span><b>max 39</b></li>}
              <li><span><b>Interview chance</b></span><b>{c.pct}% · {c.level}</b></li>
            </ul>
            <p className="small muted" style={{ marginBottom: 0 }}>This is an estimate, not a prediction. Rule: start from the match score; posted over 30 days −10, over 45 days −20; seniority gap of 2+ levels −15; eligibility unclear −10; referral +15; a missing hard requirement caps it at Low. High is 70%+, Medium 40 to 69%.</p>
            {RUBRIC.map(([k, name]) => <p key={k} className="small" style={{ margin: "8px 0 0" }}><b>{name}:</b> {r.parts[k].note}</p>)}
          </div>
        </div>
      </div>
    </>
  );
}
