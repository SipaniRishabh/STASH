import { useMemo, useState } from "react";
import { boldParts, download, printResume, resumeDocx, tailorChecks } from "../lib/tailor.js";
import { Err, Spinner, go } from "../ui.jsx";
import { scoreTask } from "./Match.jsx";
import { chance } from "../lib/jobs.js";

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default function Tailor({ apiKey, profile, prefs, current, matches, setMatches, tasks, runTask }) {
  const saved = current && matches[current.id];
  const task = current && tasks[`tailor:${current.id}`];
  const busy = !!task?.running;
  const [exportErr, setErr] = useState("");
  const err = task?.error || exportErr;
  const [showDiff, setShowDiff] = useState(true);
  const t = saved?.tailored;
  const evidence = profile?.evidence || [];

  const checks = useMemo(
    () => (t ? tailorChecks(profile.resume, t.resume, saved.result.must_have_keywords, evidence) : []),
    [t, profile, saved],
  );

  if (!saved || !profile) {
    return (
      <div className="card" style={{ maxWidth: 560 }}>
        <h2>Score a job first</h2>
        <p className="sub">Tailoring uses the job's match report: its keywords and gaps. Pick a job and score it, then come back.</p>
        <a className="btn" href="#jobs" style={{ textDecoration: "none" }}>See jobs</a>
      </div>
    );
  }

  const { job, result } = saved;

  function run() {
    const id = current.id;
    runTask(`tailor:${id}`, `Tailoring resume for ${job.company}`, async () => {
      const { tailorResume } = await import("../lib/claude.js");
      const out = await tailorResume(apiKey, profile.resume, job, result, evidence);
      setMatches((m) => ({ ...m, [id]: { ...m[id], tailored: { ...out, at: Date.now() } } }));
    });
  }

  async function exportDocx() {
    try {
      download(await resumeDocx(t.resume), `${slug(t.resume.name || "resume")}-${slug(job.company || "job")}.docx`);
    } catch (e) {
      setErr(`Couldn't build the Word file: ${e.message}`);
    }
  }

  const header = (
    <div className="row between" style={{ marginBottom: 12 }}>
      <div>
        <h2>Tailored resume</h2>
        <p className="sub">{job.title} at {job.company}. Reordered and reworded from your resume only. Nothing invented.</p>
      </div>
      <a className="btn ghost sm noprint" href="#match" style={{ textDecoration: "none" }}>Back to match report</a>
    </div>
  );

  if (!t) {
    return (
      <>
        {header}
        <Err msg={err} />
        <div className="card" style={{ maxWidth: 640 }}>
          <h3>Ready to tailor</h3>
          <p className="sub">
            Jobber reorders and rewords your resume to lead with what this job asks for ({result.must_have_keywords.length} keywords),
            cuts it to one page, and highlights every change. Gaps stay gaps. One Claude call on your key, about $0.10 to $0.20.
          </p>
          {apiKey ? (
            <button className="btn" onClick={run} disabled={busy}>{busy ? <><Spinner /> Tailoring, about 40 seconds…</> : "Tailor my resume"}</button>
          ) : (
            <a className="btn" href="#setup" style={{ textDecoration: "none" }}>Connect your key to tailor</a>
          )}
        </div>
      </>
    );
  }

  const original = new Set([profile.resume.summary, ...profile.resume.experience.flatMap((e) => e.bullets)]);
  const bold = (s) => boldParts(s).map((x, i) => (x.bold ? <b key={i}>{x.text}</b> : x.text));
  // Bullets only: bold impact numbers, highlight if changed.
  const mark = (s) => (showDiff && !original.has(s) ? <mark>{bold(s)}</mark> : bold(s));
  const r = t.resume;
  const failing = checks.filter((c) => !c.ok).length;
  const rescored = saved.tailoredScore?.tailoredAt === t.at ? saved.tailoredScore.result : null;

  return (
    <>
      {header}
      <Err msg={err} />
      <div className="report">
        <div className="card rail noprint">
          <h3>Checks</h3>
          <ul className="checks">
            {checks.map((c) => (
              <li key={c.id} title={c.detail} style={{ display: "block" }}>
                <div className="row between"><span>{c.name}</span><span className={`pill ${c.ok ? "good" : "warn"}`}>{c.ok ? "Pass" : "Check"}</span></div>
                <div className="small muted" style={{ marginTop: 4 }}>{c.detail}</div>
              </li>
            ))}
          </ul>
          {failing > 0 && <p className="small muted">Edit the downloaded Word file to fix these.</p>}
          <div className="grid" style={{ marginTop: 14, gap: 8 }}>
            <button className="btn" onClick={exportDocx}>Download Word (.docx)</button>
            <button className="btn ghost" onClick={() => printResume(document.querySelector(".doc.print"), `${t.resume.name || "Resume"} - ${job.company || "Resume"}`)}>Save as PDF</button>
            <button className="btn ghost" onClick={() => { scoreTask("tailored", current, { apiKey, profile, prefs, matches, setMatches, runTask }); go("match"); }} disabled={!!tasks[`score-tailored:${current.id}`]?.running}>
              {rescored ? "Re-score match again" : "Re-score match with this version"}
            </button>
            {rescored && <p className="small muted" style={{ margin: 0, textAlign: "center" }}>Match with this version: <b>{chance(rescored, job, saved.referral).match}</b> (original {chance(result, job, saved.referral).match})</p>}
            <a className="btn ghost" href="#apply" style={{ textAlign: "center", textDecoration: "none" }}>Continue to apply</a>
          </div>
          <label className="row small" style={{ fontWeight: 400, marginTop: 14, flexWrap: "nowrap" }}>
            <input type="checkbox" style={{ width: "auto" }} checked={showDiff} onChange={(e) => setShowDiff(e.target.checked)} />
            Highlight changed lines
          </label>
        </div>

        <div className="detail">
          <div className="doc print">
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{r.name}</div>
              {r.headline && <div>{r.headline}</div>}
              <div>{[r.contact.email, r.contact.phone, r.contact.location, r.contact.linkedin].filter(Boolean).join(" | ")}</div>
            </div>
            {r.summary && <><h4>SUMMARY</h4><p style={{ margin: 0 }}>{showDiff && !original.has(r.summary) ? <mark>{r.summary}</mark> : r.summary}</p></>}
            <h4>EXPERIENCE</h4>
            {r.experience.map((e, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div className="row between"><b>{e.title}, {e.company}</b><span>{[e.location, e.dates].filter(Boolean).join(" | ")}</span></div>
                {e.blurb && <i>{e.blurb}</i>}
                <ul>{e.bullets.map((b, j) => <li key={j}>{mark(b)}</li>)}</ul>
              </div>
            ))}
            {r.education.length > 0 && <><h4>EDUCATION</h4>{r.education.map((e, i) => <div key={i} className="row between"><b>{e.degree}, {e.school}</b><span>{e.dates}</span></div>)}</>}
            {r.skills.length > 0 && <><h4>SKILLS</h4>{r.skills.map((s, i) => <div key={i}>{s.label && <b>{s.label}: </b>}{s.items.join(", ")}</div>)}</>}
            {r.certifications.length > 0 && <><h4>CERTIFICATIONS</h4>{r.certifications.map((c, i) => <div key={i}>{c}</div>)}</>}
          </div>

          <div className="card noprint" style={{ marginTop: 16 }}>
            <h3>What changed ({t.changes.length})</h3>
            {t.changes.map((c, i) => (
              <div key={i} style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                {c.before && <div className="small muted" style={{ textDecoration: "line-through" }}>{c.before}</div>}
                <div className="small">{c.after}</div>
                <div className="small muted">{c.why}</div>
              </div>
            ))}
            {t.left_out.length > 0 && (
              <p className="small" style={{ marginBottom: 0 }}><b>Keywords left out because your resume doesn't support them:</b> {t.left_out.join(", ")}</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
