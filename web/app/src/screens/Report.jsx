import { useMemo, useState } from "react";
import { BANNED, CATEGORIES, lint, parseRate, replaceLine, score } from "../lib/lint.js";
import { DEMO_FIXES, DEMO_STORIES } from "../demo.js";
import { CopyBtn, Err, Gauge, IssuePill, PctPill, Spinner } from "../ui.jsx";
import Stories, { storyScore } from "./Stories.jsx";

export default function Report({ apiKey, demo, profile, setProfile }) {
  const findings = useMemo(
    () => (profile ? lint(profile.resume, profile.rawText, profile.pages, profile.language) : null),
    [profile],
  );
  const firstIssue = useMemo(() => {
    if (!findings) return null;
    for (const c of CATEGORIES) for (const k of c.checks) if (findings[k.id].length) return k.id;
    return "extract";
  }, [findings]);
  const [sel, setSel] = useState(null);
  const [open, setOpen] = useState({ ats: true, impact: true });

  if (!profile) {
    return (
      <div className="card" style={{ maxWidth: 560 }}>
        <h2>No resume yet</h2>
        <p className="sub">Upload your resume first, or try the demo.</p>
        <a className="btn" href="#resume" style={{ textDecoration: "none" }}>Upload resume</a>
      </div>
    );
  }

  const { cats, overall } = score(findings);
  const view = sel || firstIssue;
  const stories = demo && !profile.stories ? DEMO_STORIES : profile.stories;
  const sScore = stories ? storyScore(stories.stories) : null;

  function apply(from, to) {
    setProfile({
      ...profile,
      resume: replaceLine(profile.resume, from, to),
      language: (profile.language || []).filter((x) => x.text !== from),
    });
  }

  const item = (id, label, right) => (
    <li key={id} className={view === id ? "sel" : ""} onClick={() => setSel(id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setSel(id)}>
      {label}
      {right}
    </li>
  );

  return (
    <div className="report">
      <div className="card rail">
        <Gauge score={overall} label="Resume health" />
        <div style={{ margin: "16px 0 8px" }}>
          <a className="btn" href="#jobs" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>Find jobs for me</a>
        </div>
        <div className="row" style={{ justifyContent: "center", marginBottom: 8 }}>
          <button className="linkbtn small" onClick={() => setSel("method")}>How this report is judged</button>
          {profile.docUrl && <a className="small" href={profile.docUrl} target="_blank" rel="noopener noreferrer">Open my doc ↗</a>}
        </div>
        {cats.map((c) => (
          <div key={c.id} className={`cat ${open[c.id] || c.checks.some((k) => k.id === view) ? "open" : ""}`}>
            <button onClick={() => setOpen({ ...open, [c.id]: !open[c.id] })} aria-expanded={!!open[c.id]}>
              <span>{c.name}</span>
              <PctPill pct={c.pct} />
            </button>
            <ul>
              {c.checks.map((k) =>
                item(k.id, <span className={findings[k.id].length ? "no" : "ok"}>{k.name}</span>, <IssuePill n={findings[k.id].length} />)
              )}
            </ul>
          </div>
        ))}
        <div className="cat open" style={{ borderTop: "2px solid var(--line)" }}>
          <button disabled style={{ cursor: "default" }}>
            <span>Interview readiness · AI review</span>
            {sScore != null ? <PctPill pct={sScore} /> : <span className="pill">Not run</span>}
          </button>
          <ul>{item("stories", <span className={sScore == null ? "" : sScore >= 70 ? "ok" : "no"}>Story strength</span>, <span className="pill blue">Separate score</span>)}</ul>
        </div>
      </div>

      <div className="detail">
        {view === "method" ? (
          <Method />
        ) : view === "stories" ? (
          <Stories apiKey={apiKey} demo={demo} profile={profile} setProfile={setProfile} stories={stories} onApply={apply} />
        ) : (
          <Check view={view} cats={cats} findings={findings} profile={profile} apiKey={apiKey} demo={demo} onApply={apply} />
        )}
      </div>
    </div>
  );
}

function Check({ view, cats, findings, profile, apiKey, demo, onApply }) {
  const cat = cats.find((c) => c.checks.some((k) => k.id === view));
  const check = cat.checks.find((k) => k.id === view);
  const items = findings[view];
  const rate = parseRate(profile.resume, profile.rawText);
  return (
    <>
      <div className="head">
        <h2 style={{ textTransform: "uppercase", letterSpacing: ".5px", fontSize: 20 }}>{cat.name}</h2>
        <span className="pill" style={{ padding: "8px 14px" }}>{cat.issues} issue{cat.issues === 1 ? "" : "s"} found</span>
      </div>
      <div className="inner">
        <div className="row between">
          <h3 style={{ fontSize: 18, margin: 0 }}>{check.name}</h3>
          <IssuePill n={items.length} />
        </div>
        <p>{check.about}</p>
        <p className="small muted" style={{ marginTop: -6 }}>
          <span className={`pill ${check.by === "ai" ? "blue" : ""}`}>{check.by === "ai" ? "Judged by Claude" : "Fixed rule"}</span> {check.rule}
        </p>
        {view === "extract" && (
          <div style={{ margin: "16px 0" }}>
            <div className="bar"><i style={{ width: `${rate}%` }} /></div>
            <div className="row between small" style={{ marginTop: 6 }}>
              <span style={{ color: "var(--good)" }}>{rate}% of your resume text read by the ATS</span>
              <span style={{ color: "var(--bad)" }}>{100 - rate}% missed</span>
            </div>
          </div>
        )}
        {!items.length && <p className="pill good">Nothing to fix here.</p>}
        {items.map((it, i) => (
          <Issue key={`${view}-${i}-${it.text}`} it={it} apiKey={apiKey} demo={demo} profile={profile} onApply={onApply} />
        ))}
      </div>
    </>
  );
}

function Issue({ it, apiKey, demo, profile, onApply }) {
  const [fix, setFix] = useState(it.suggested ? { suggested: it.suggested, note: "This is how your contact line appears in every Jobber export." } : null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [kept, setKept] = useState(false);

  async function suggest() {
    setErr("");
    setBusy(true);
    try {
      if (demo) setFix(DEMO_FIXES[it.text] || { suggested: it.text, note: "No saved suggestion for this line in the demo. With your own key, Claude writes one." });
      else {
        const { suggestFix } = await import("../lib/claude.js");
        setFix(await suggestFix(apiKey, profile.resume, it.text, it.issue));
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const changed = fix && fix.suggested !== it.text;
  return (
    <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14, marginTop: 14 }}>
      <p className="small" style={{ margin: "0 0 8px" }}><b>{it.issue}</b></p>
      {it.text && !fix && <div className="ba" style={{ gridTemplateColumns: "1fr" }}><div className="before"><h4>Now</h4>{it.text}</div></div>}
      {fix && (
        <div className="ba">
          <div className="before"><h4>Now</h4>{it.text}</div>
          <div className="after"><h4>Suggested</h4>{fix.suggested}<p className="small muted" style={{ margin: "8px 0 0" }}>{fix.note}</p></div>
        </div>
      )}
      <Err msg={err} />
      {kept ? (
        <p className="small muted">Kept as is.</p>
      ) : (
        <div className="row" style={{ marginTop: 10 }}>
          {it.fixable && !fix && <button className="btn sm" onClick={suggest} disabled={busy}>{busy ? <><Spinner />Writing a fix…</> : "Suggest a fix"}</button>}
          {changed && <CopyBtn text={fix.suggested} />}
          {changed && profile.docUrl && <a className="btn ghost sm" style={{ textDecoration: "none" }} href={profile.docUrl} target="_blank" rel="noopener noreferrer">Open my doc ↗</a>}
          {it.fixable && changed && <button className="btn sm" onClick={() => onApply(it.text, fix.suggested)}>{profile.docUrl ? "Mark as fixed" : "Apply fix"}</button>}
          {it.fixable && <button className="btn ghost sm" onClick={() => setKept(true)}>Keep mine</button>}
        </div>
      )}
    </div>
  );
}

function Method() {
  return (
    <>
      <div className="head"><h2 style={{ textTransform: "uppercase", letterSpacing: ".5px", fontSize: 20 }}>How this report is judged</h2></div>
      <div className="inner">
        <h3>Resume health score</h3>
        <p className="small">
          Built from fixed rules, not AI opinion, so the same resume always gets the same score. Each category starts at 100 and
          loses 12 points per issue, down to a floor of 40. The overall score is the average of the six categories.
          Only spelling and grammar issues come from Claude.
        </p>
        <table className="evid">
          <thead><tr><th>Check</th><th>How it's judged</th><th>By</th></tr></thead>
          <tbody>
            {CATEGORIES.flatMap((c) => c.checks.map((k) => (
              <tr key={k.id}><td><b>{c.name}</b><br />{k.name}</td><td>{k.rule}</td><td><span className={`pill ${k.by === "ai" ? "blue" : ""}`}>{k.by === "ai" ? "Claude" : "Rule"}</span></td></tr>
            )))}
          </tbody>
        </table>
        <details style={{ marginTop: 12 }}>
          <summary className="small">See all {BANNED.length} flagged words and stems</summary>
          <p className="small muted">{BANNED.join(", ")}</p>
        </details>

        <h3 style={{ marginTop: 22 }}>Interview readiness (separate score)</h3>
        <p className="small">
          Claude picks the four achievements an interviewer is most likely to dig into and checks each against five parts of a
          strong story: the problem, why it mattered and why you owned it; options considered and the decision logic; the
          metrics and how each number was measured; what went wrong and the trade-offs; and your contribution versus the team's.
        </p>
        <p className="small">
          Story strength counts only the three parts a resume bullet can show: problem, metrics and ownership. Each scores 1 if
          shown, 0.5 if partly shown, 0 if missing, averaged across the four achievements. Options and trade-offs usually belong
          in the interview, so they become practice questions instead of lowering your score. Because this part is AI judgement,
          it is kept separate from the resume health score.
        </p>

        <h3 style={{ marginTop: 22 }}>What Jobber never does</h3>
        <p className="small">It never adds a skill, number, tool, title or claim that isn't already in your resume. Every suggestion only rewords, reorders or cuts what you wrote, and you approve each one.</p>
      </div>
    </>
  );
}
