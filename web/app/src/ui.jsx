import { useState } from "react";

export function Gauge({ score, label, children }) {
  const L = 157;
  const col = score >= 80 ? "var(--good)" : score >= 60 ? "var(--warn)" : "var(--bad)";
  return (
    <div className="gauge">
      <div className="lbl" style={{ fontSize: 20, color: "var(--ink)", fontWeight: 600 }}>{label}</div>
      <svg viewBox="0 0 120 70" role="img" aria-label={`${label}: ${score} out of 100`}>
        <path d="M10 62 A50 50 0 0 1 110 62" fill="none" stroke="var(--soft)" strokeWidth="12" strokeLinecap="round" />
        <path d="M10 62 A50 50 0 0 1 110 62" fill="none" stroke={col} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${(score / 100) * L} ${L}`} />
      </svg>
      <div className="num" style={{ color: col }}>
        {score}
        <span style={{ fontSize: 18, color: "var(--muted)" }}>/100</span>
      </div>
      {children}
    </div>
  );
}

export const PctPill = ({ pct }) => <span className={`pill ${pct >= 85 ? "good" : pct >= 60 ? "warn" : "bad"}`}>{pct}%</span>;

export const IssuePill = ({ n }) =>
  n ? <span className="pill">{n} issue{n > 1 ? "s" : ""}</span> : <span className="pill good">No issues</span>;

export const Spinner = () => <span className="spin" aria-hidden="true" />;

export const Err = ({ msg }) => (msg ? <div className="err" role="alert">{msg}</div> : null);

export function go(route) {
  location.hash = route;
}

export function CopyBtn({ text }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      /* clipboard blocked: the text is visible to copy by hand */
    }
  }
  return <button className="btn ghost sm" onClick={copy}>{done ? "Copied" : "Copy"}</button>;
}

