import { useState } from "react";
import { CopyBtn, Err, Spinner } from "../ui.jsx";

const PARTS = [
  ["problem", "Problem, why it mattered, why you owned it", true],
  ["metrics", "Metrics, and how each number was measured", true],
  ["ownership", "Your contribution vs the team's", true],
  ["options", "Options considered and decision logic", false],
  ["tradeoffs", "What went wrong, trade-offs, what you'd change", false],
];
const LABEL = { shown: ["good", "In resume"], partial: ["warn", "Partly"], missing: ["bad", "Missing"] };
const PT = { shown: 1, partial: 0.5, missing: 0 };

/** Score uses only the parts a bullet can show (problem, metrics, ownership). */
export function storyScore(stories) {
  if (!stories.length) return 0;
  const pts = stories.flatMap((s) => PARTS.filter((p) => p[2]).map(([k]) => PT[s[k].status]));
  return Math.round((100 * pts.reduce((a, b) => a + b, 0)) / pts.length);
}

export default function Stories({ apiKey, demo, profile, setProfile, stories, onApply }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function run() {
    setErr("");
    setBusy(true);
    try {
      const { reviewStories } = await import("../lib/claude.js");
      setProfile({ ...profile, stories: await reviewStories(apiKey, profile.resume) });
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="head">
        <h2 style={{ textTransform: "uppercase", letterSpacing: ".5px", fontSize: 20 }}>Interview readiness</h2>
        {stories && <span className="pill" style={{ padding: "8px 14px" }}>Story strength {storyScore(stories.stories)}%</span>}
      </div>
      <div className="inner">
        <p>
          Interviewers pick your biggest claims and dig in. For your strongest achievements, Jobber checks five things: the problem
          and why you owned it, the options you weighed, how each number was measured, what went wrong, and what you did versus the team.
        </p>
        <p className="small muted" style={{ marginTop: -6 }}><span className="pill blue">Judged by Claude</span> The score counts only the first three parts. The last two become practice questions.</p>
        <Err msg={err} />
        {!stories && (
          <button className="btn" onClick={run} disabled={busy || demo}>{busy ? <><Spinner />Reviewing your achievements… about a minute</> : "Run interview-readiness review"}</button>
        )}
        {stories && !demo && <button className="linkbtn small" onClick={run} disabled={busy}>{busy ? "Re-running…" : "Run again after edits"}</button>}
        {stories?.stories.map((s, i) => <Story key={i} s={s} profile={profile} onApply={onApply} />)}
      </div>
    </>
  );
}

function Story({ s, profile, onApply }) {
  const [applied, setApplied] = useState(false);
  return (
    <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16, marginTop: 16 }}>
      <div className="small muted">{s.company}</div>
      <p style={{ margin: "4px 0 10px", fontWeight: 600 }}>{s.achievement}</p>
      <table className="evid">
        <tbody>
          {PARTS.map(([k, label, scored]) => (
            <tr key={k}>
              <td style={{ width: "34%" }}>{label}{!scored && <span className="small muted"> · interview only</span>}</td>
              <td style={{ width: 90 }}><span className={`pill ${LABEL[s[k].status][0]}`}>{LABEL[s[k].status][1]}</span></td>
              <td className="small">{s[k].note}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h4 className="small" style={{ margin: "12px 0 4px", textTransform: "uppercase", letterSpacing: ".6px", color: "var(--muted)" }}>Be ready to answer</h4>
      <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
        {s.questions.map((q) => <li key={q}>{q}</li>)}
      </ul>
      {s.improved && s.improved !== s.achievement && (
        <div className="ba" style={{ gridTemplateColumns: "1fr" }}>
          <div className="after">
            <h4>Stronger bullet, same facts</h4>
            {s.improved}
            <div className="row" style={{ marginTop: 10 }}>
              <CopyBtn text={s.improved} />
              {profile.docUrl && <a className="btn ghost sm" style={{ textDecoration: "none" }} href={profile.docUrl} target="_blank" rel="noopener noreferrer">Open my doc ↗</a>}
              {applied ? <span className="small muted">Updated in Jobber</span> : (
                <button className="btn sm" onClick={() => { onApply(s.achievement, s.improved); setApplied(true); }}>{profile.docUrl ? "Mark as fixed" : "Use this bullet"}</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
