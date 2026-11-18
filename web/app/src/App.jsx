import { useEffect, useRef, useState } from "react";
import { useStored, forgetEverything } from "./lib/store.js";
import { DEMO_RESUME, DEMO_RAW_TEXT, DEMO_PAGES, DEMO_UNDERSTANDING, DEMO_LANGUAGE } from "./demo.js";
import { go } from "./ui.jsx";
import Resume from "./screens/Resume.jsx";
import Report from "./screens/Report.jsx";
import Tracker from "./screens/Tracker.jsx";
import Jobs from "./screens/Jobs.jsx";
import Match from "./screens/Match.jsx";
import Tailor from "./screens/Tailor.jsx";
import Apply from "./screens/Apply.jsx";

const STEPS = [
  ["resume", "Resume"], ["report", "Resume report"], ["jobs", "Jobs"], ["match", "Match report"],
  ["tailor", "Tailor"], ["apply", "Apply"], ["tracker", "Tracker"],
];

export const DEFAULT_PREFS = {
  titles: ["Product Manager", "Senior Product Manager"],
  home: "",
  markets: { India: "Onsite, hybrid or remote", "United States": "Remote, open to my country", Europe: "Remote, open to my country" },
  maxAge: 60,
  dealBreakers: "",
};

const DEMO_PROFILE = {
  resume: DEMO_RESUME, rawText: DEMO_RAW_TEXT, pages: DEMO_PAGES, understanding: DEMO_UNDERSTANDING,
  language: DEMO_LANGUAGE, fileName: "meera-kapoor-resume.pdf (sample)",
};

function useHash() {
  const get = () => location.hash.slice(1) || "home";
  const [h, setH] = useState(get);
  useEffect(() => {
    const on = () => {
      setH(get());
      window.scrollTo(0, 0);
    };
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  return h;
}

export default function App() {
  const route = useHash();
  const [apiKey, setApiKey] = useStored("key", "");
  const [realProfile, setRealProfile] = useStored("profile", null);
  const [prefs, setPrefs] = useStored("prefs", DEFAULT_PREFS);
  const [tracker, setTracker] = useStored("tracker", []);
  const [realMatches, setRealMatches] = useStored("matches", {});
  const [demoMatches, setDemoMatches] = useState({});
  const [current, setCurrent] = useStored("current", null);
  // Claude calls run here, not in the screen, so they keep going when the user moves between steps.
  // They stop only if the tab is closed or reloaded (the key never goes to a server, so there is no server-side job).
  const [tasks, setTasks] = useState({}); // key -> { label, running } | { label, error }
  const live = useRef(new Set());
  async function runTask(key, label, fn) {
    if (live.current.has(key)) return;
    live.current.add(key);
    setTasks((t) => ({ ...t, [key]: { label, running: true } }));
    try {
      await fn();
      setTasks(({ [key]: _, ...t }) => t);
    } catch (e) {
      setTasks((t) => ({ ...t, [key]: { label, error: e.message || String(e) } }));
    } finally {
      live.current.delete(key);
    }
  }
  const running = Object.values(tasks).filter((t) => t.running);
  useEffect(() => {
    if (!running.length) return;
    const warn = (e) => e.preventDefault();
    addEventListener("beforeunload", warn);
    return () => removeEventListener("beforeunload", warn);
  }, [running.length]);
  const [demo, setDemo] = useState(false); // not persisted: a refresh leaves demo mode
  const [demoProfile, setDemoProfile] = useState(DEMO_PROFILE);

  const profile = demo ? demoProfile : realProfile;
  const setProfile = demo ? setDemoProfile : setRealProfile;
  const matches = demo ? demoMatches : realMatches;
  const setMatches = demo ? setDemoMatches : setRealMatches;
  const ctx = { apiKey, demo, profile, setProfile, prefs, setPrefs, tracker, setTracker, matches, setMatches, current, setCurrent, tasks, runTask };

  const startDemo = () => {
    setDemo(true);
    setDemoProfile(DEMO_PROFILE);
    go("resume");
  };

  const step = STEPS.findIndex(([id]) => id === route);
  return (
    <div className="wrap">
      <header className="top">
        <a className="brand" href="#home"><i />JOBBER</a>
        <div className="row">
          {running.length > 0 && (
            <span className="keychip" role="status"><span className="spin" aria-hidden="true" />{running.map((t) => t.label).join(", ")}… keep this tab open</span>
          )}
          {demo ? (
            <span className="keychip"><span className="dot" style={{ background: "var(--blue)" }} />Demo with a sample resume · <button className="linkbtn" onClick={() => { setDemo(false); go("home"); }}>exit</button></span>
          ) : apiKey ? (
            <span className="keychip"><span className="dot" />Key stored in this browser · <a href="#setup">manage</a></span>
          ) : (
            <span className="keychip"><span className="dot" style={{ background: "var(--warn)" }} />No key yet · <a href="#setup">connect</a></span>
          )}
        </div>
      </header>

      {step >= 0 && (
        <nav className="steps" aria-label="Steps">
          {STEPS.map(([id, label], i) => (
            <a key={id} href={`#${id}`} className={i === step ? "on" : i < step ? "done" : ""}><b>{i + 1}</b>{label}</a>
          ))}
        </nav>
      )}

      {route === "home" && <Home startDemo={startDemo} />}
      {route === "setup" && <Setup apiKey={apiKey} setApiKey={setApiKey} startDemo={startDemo} />}
      {route === "resume" && <Resume {...ctx} />}
      {route === "report" && <Report {...ctx} />}
      {route === "jobs" && <Jobs {...ctx} />}
      {route === "match" && <Match {...ctx} />}
      {route === "tailor" && <Tailor {...ctx} />}
      {route === "apply" && <Apply {...ctx} />}
      {route === "tracker" && <Tracker {...ctx} />}
    </div>
  );
}

function Home({ startDemo }) {
  const flow = [
    ["1 · Understand", "Reads your resume and asks what you want next"],
    ["2 · Report", "ATS and writing health check"],
    ["3 · Search", "Fresh jobs from the last 60 days that you can actually apply to"],
    ["4 · Score", "Match score and interview chance, with evidence"],
    ["5 · Tailor", "Honest rewrite. No invented skills, no AI-speak"],
    ["6 · Track", "Status for every application, export anytime"],
  ];
  return (
    <section className="hero">
      <div>
        <span className="pill blue">AI job-hunt agent</span>
        <h1 style={{ marginTop: 14 }}>Find the right roles, tailor an honest resume, and track every application.</h1>
        <p className="sub">Jobber reads your resume, finds fresh jobs that fit your goals, scores your chances, and rewrites your resume for each role in plain human language. You stay in control of every step.</p>
        <div className="row">
          <a className="btn" href="#setup" style={{ textDecoration: "none" }}>Start with my resume</a>
          <button className="btn ghost" onClick={startDemo}>View demo</button>
        </div>
        <p className="small muted" style={{ marginTop: 14 }}>Bring your own Claude API key. Your key and resume never touch our server.</p>
      </div>
      <div className="flow">
        {flow.map(([b, t]) => <div key={b}><b>{b}</b>{t}</div>)}
      </div>
    </section>
  );
}

function Setup({ apiKey, setApiKey, startDemo }) {
  const [val, setVal] = useState(apiKey);
  const [msg, setMsg] = useState("");
  const saveKey = () => {
    const k = val.trim();
    if (!k.startsWith("sk-ant-")) return setMsg("That doesn't look like an Anthropic API key. It should start with sk-ant-.");
    setApiKey(k);
    go("resume");
  };
  return (
    <div className="grid g2">
      <div className="card">
        <h2>Connect Claude</h2>
        <p className="sub">Jobber runs on your own Anthropic API key. It is saved only in this browser and sent only to Anthropic.</p>
        <label htmlFor="key">Anthropic API key</label>
        <input id="key" type="password" autoComplete="off" spellCheck="false" placeholder="sk-ant-..." value={val} onChange={(e) => { setVal(e.target.value); setMsg(""); }} />
        {msg && <p className="small" style={{ color: "var(--bad)" }}>{msg}</p>}
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn" onClick={saveKey}>Save and continue</button>
          {apiKey && <button className="btn ghost" onClick={() => { setApiKey(""); setVal(""); setMsg("Key removed from this browser."); }}>Forget my key</button>}
        </div>
        <div className="row" style={{ marginTop: 18 }}>
          <button className="linkbtn small" onClick={() => { if (confirm("Delete your key, resume, preferences and tracker from this browser? This can't be undone.")) { forgetEverything(); location.hash = "home"; location.reload(); } }}>Delete all my Jobber data from this browser</button>
        </div>
      </div>
      <div className="card">
        <h3>Before you paste a key</h3>
        <ul className="small" style={{ paddingLeft: 18, margin: 0 }}>
          <li>Create a key at <b>console.anthropic.com</b>. It's separate from a Claude.ai subscription.</li>
          <li>Make a dedicated key for Jobber and set a monthly spend limit on it.</li>
          <li>Reading a resume costs about $0.05 to $0.15. Tailoring for a job will cost about the same.</li>
          <li>No key? <button className="linkbtn" onClick={startDemo}>View the demo</button> with a sample resume.</li>
        </ul>
        <div className="note" style={{ marginTop: 14 }}>Jobber loads no third-party scripts and shows job and AI text as plain text only, so nothing on the page can read your key.</div>
      </div>
    </div>
  );
}
