import { useState } from "react";
import { Err, Spinner } from "../ui.jsx";
import { DEFAULT_EXCLUDE } from "../lib/jobs.js";

export default function Resume({ apiKey, demo, profile, setProfile, prefs, setPrefs }) {
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  const [docUrl, setDocUrl] = useState("");

  async function importDoc() {
    setErr("");
    if (!apiKey) return setErr("Connect your Claude API key first, or try the demo.");
    try {
      setBusy("Claude is opening your Google Doc and reading it. This takes about 30 to 90 seconds…");
      const { readResumeFromDoc } = await import("../lib/claude.js");
      const out = await readResumeFromDoc(apiKey, docUrl);
      // ponytail: page count estimated from words (~600 per compact page); the doc export has no page info.
      const pages = Math.max(1, Math.ceil(out.source_text.split(/\s+/).length / 600));
      setProfile({ resume: out.resume, understanding: out.understanding, language: out.language_issues, rawText: out.source_text, pages, fileName: "Google Doc", docUrl: docUrl.trim() });
      setDocUrl("");
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  }

  async function upload(file) {
    setErr("");
    if (!file) return;
    if (file.type !== "application/pdf") return setErr("Upload a PDF. Word files are coming soon; for now, export your resume to PDF first.");
    if (file.size > 10 * 1024 * 1024) return setErr("That file is over 10 MB. Export a smaller PDF.");
    if (!apiKey) return setErr("Connect your Claude API key first, or try the demo.");
    try {
      setBusy("Reading the PDF in your browser…");
      const [{ readPdf }, { readResume }] = await Promise.all([import("../lib/pdf.js"), import("../lib/claude.js")]);
      const pdf = await readPdf(file);
      setBusy("Claude is reading your resume. This takes about 30 to 60 seconds…");
      const out = await readResume(apiKey, pdf.base64);
      setProfile({ resume: out.resume, understanding: out.understanding, language: out.language_issues, rawText: pdf.rawText, pages: pdf.pages, fileName: file.name });
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <h2>Who you are</h2>
      <p className="sub">Upload your resume. Jobber summarizes it, then asks what you want next.</p>
      <div className="grid g2" style={{ alignItems: "start" }}>
        <div>
          <label className="drop" style={{ display: "block", cursor: busy || demo ? "default" : "pointer", fontWeight: 400, margin: 0 }}>
            <input type="file" accept="application/pdf" hidden disabled={!!busy || demo} onChange={(e) => upload(e.target.files[0])} />
            {busy ? (
              <span><Spinner />{busy}</span>
            ) : profile ? (
              <>
                <b>{profile.fileName}</b>
                <div className="small muted">
                  {profile.docUrl ? `about ${profile.pages} page${profile.pages > 1 ? "s" : ""} · read by Claude from your link` : `${profile.pages} page${profile.pages > 1 ? "s" : ""} · read in your browser`}
                  {!demo && " · click to upload a PDF instead"}
                </div>
              </>
            ) : (
              <>
                <b>Drop your resume PDF here, or click to choose</b>
                <div className="small muted">Read in your browser, then sent only to Anthropic with your key. The file itself never goes anywhere else</div>
              </>
            )}
          </label>
          {!demo && (
            <div className="card" style={{ marginTop: 12, padding: 14 }}>
              <label htmlFor="doc" style={{ marginTop: 0 }}>Or paste a Google Docs link</label>
              <div className="row">
                <input id="doc" style={{ flex: 1 }} placeholder="https://docs.google.com/document/d/…" value={docUrl} disabled={!!busy} onChange={(e) => setDocUrl(e.target.value)} />
                <button className="btn sm" disabled={!!busy || !docUrl.trim()} onClick={importDoc}>Read doc</button>
              </div>
              <p className="small muted" style={{ margin: "8px 0 0" }}>
                The doc must be shared as "Anyone with the link can view". Anyone holding the link can read it, so switch sharing back off afterwards if you like.
                Jobber never edits your doc: you copy each fix in yourself.
              </p>
            </div>
          )}
          <div style={{ marginTop: 12 }}><Err msg={err} /></div>
          {profile && (
            <div className="card" style={{ marginTop: 16 }}>
              <h3>What Jobber understood</h3>
              <table className="evid">
                <tbody>
                  <tr><th style={{ width: 120 }}>Seniority</th><td>{profile.understanding.seniority}</td></tr>
                  <tr><th>Strongest in</th><td>{profile.understanding.strengths}</td></tr>
                  <tr><th>Best results</th><td>{profile.understanding.wins}</td></tr>
                  <tr><th>Watch-outs</th><td>{profile.understanding.watchouts}</td></tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
        <Prefs prefs={prefs} setPrefs={setPrefs} ready={!!profile} />
      </div>
    </>
  );
}

function Prefs({ prefs, setPrefs, ready }) {
  const [newTitle, setNewTitle] = useState("");
  // Edited as text, saved as a list when the field loses focus (so typing a comma doesn't jump around).
  const [exText, setExText] = useState((prefs.exclude ?? DEFAULT_EXCLUDE).join(", "));
  const set = (k, v) => setPrefs({ ...prefs, [k]: v });
  const addTitle = () => {
    const t = newTitle.trim();
    if (t && !prefs.titles.includes(t)) set("titles", [...prefs.titles, t]);
    setNewTitle("");
  };
  return (
    <div className="card">
      <h3>What you want next</h3>
      <label>Target roles</label>
      <div className="chips">
        {prefs.titles.map((t) => (
          <span key={t} className="on">
            {t} <button className="linkbtn" style={{ color: "#fff", textDecoration: "none", marginLeft: 4 }} aria-label={`Remove ${t}`} onClick={() => set("titles", prefs.titles.filter((x) => x !== t))}>×</button>
          </span>
        ))}
      </div>
      <div className="row">
        <input style={{ flex: 1 }} placeholder="Add a role, e.g. Product Manager II" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTitle()} />
        <button className="btn ghost sm" onClick={addTitle}>Add</button>
      </div>
      <label htmlFor="home">Where you live</label>
      <input id="home" placeholder="City, country" value={prefs.home} onChange={(e) => set("home", e.target.value)} />
      <label>Markets and work mode</label>
      <table className="evid">
        <tbody>
          {Object.entries(prefs.markets).map(([m, v]) => (
            <tr key={m}>
              <td>{m}</td>
              <td>
                <select value={v} onChange={(e) => set("markets", { ...prefs.markets, [m]: e.target.value })}>
                  <option>Onsite, hybrid or remote</option>
                  <option>Remote, open to my country</option>
                  <option>Not interested</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <label htmlFor="age">Only show jobs posted in the last</label>
      <div className="row">
        <input id="age" type="range" min="7" max="90" value={prefs.maxAge} style={{ flex: 1 }} onChange={(e) => set("maxAge", +e.target.value)} />
        <b>{prefs.maxAge} days</b>
      </div>
      <label htmlFor="db">Deal-breakers</label>
      <input id="db" placeholder="e.g. gambling, crypto, 6-day weeks" value={prefs.dealBreakers} onChange={(e) => set("dealBreakers", e.target.value)} />
      <label htmlFor="ex">Skip job titles containing</label>
      <input id="ex" placeholder="e.g. director, vp, intern" value={exText} onChange={(e) => setExText(e.target.value)}
        onBlur={() => set("exclude", exText.split(",").map((s) => s.trim()).filter(Boolean))} />
      <p className="small muted" style={{ margin: "4px 0 0" }}>Whole words, comma separated. "vp" skips "VP of Product" but not "MVP".</p>
      <label htmlFor="boards">More companies to search (optional)</label>
      <input id="boards" placeholder="greenhouse:razorpay, lever:swiggy, ashby:linear" value={prefs.boards || ""} onChange={(e) => set("boards", e.target.value)} />
      <p className="small muted" style={{ margin: "4px 0 0" }}>
        Use the company's name from its careers link: boards.greenhouse.io/<b>razorpay</b>, jobs.lever.co/<b>swiggy</b>, jobs.ashbyhq.com/<b>linear</b>. Up to 15.
      </p>
      <div className="row" style={{ marginTop: 16 }}>
        {ready ? <a className="btn" href="#report" style={{ textDecoration: "none" }}>See my resume report</a> : <span className="small muted">Upload your resume to continue.</span>}
      </div>
    </div>
  );
}
