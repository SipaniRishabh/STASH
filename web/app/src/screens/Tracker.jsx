import { useState } from "react";

export const STATUSES = ["Applied", "Intro Call Done", "Interview Scheduled", "Passed", "Rejected", "Ghosted"];
const COLS = ["Date", "Company", "Role", "Location", "Match", "Interview chance", "Status", "Notes", "URL"];

export default function Tracker({ tracker, setTracker }) {
  const [draft, setDraft] = useState({ company: "", role: "", url: "" });
  const update = (i, k, v) => setTracker(tracker.map((t, j) => (j === i ? { ...t, [k]: v } : t)));

  function add() {
    if (!draft.company.trim() || !draft.role.trim()) return;
    setTracker([{ date: new Date().toISOString().slice(0, 10), company: draft.company.trim(), role: draft.role.trim(), url: draft.url.trim(), location: "", match: "", chance: "", status: "Applied", notes: "" }, ...tracker]);
    setDraft({ company: "", role: "", url: "" });
  }

  function exportCsv() {
    const rows = [COLS, ...tracker.map((t) => [t.date, t.company, t.role, t.location, t.match, t.chance, t.status, t.notes, t.url])];
    // Prefix cells that start with = + - @ so spreadsheets don't run them as formulas.
    const cell = (v) => `"${String(v ?? "").replace(/^[=+\-@]/, "'$&").replace(/"/g, '""')}"`;
    const csv = rows.map((r) => r.map(cell).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "jobber-applications.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <div className="row between">
        <div><h2>Applications</h2><p className="sub">Update status as things move. Saved in this browser only.</p></div>
        <button className="btn ghost sm" onClick={exportCsv} disabled={!tracker.length}>Export CSV (opens in Excel or Google Sheets)</button>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", marginBottom: 16 }}>
        {STATUSES.map((s) => (
          <div key={s} className="stat"><b>{tracker.filter((t) => t.status === s).length}</b><span className="small muted">{s}</span></div>
        ))}
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Add an application</h3>
        <div className="row">
          <input style={{ flex: 1, minWidth: 140 }} placeholder="Company" value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} />
          <input style={{ flex: 1, minWidth: 140 }} placeholder="Role" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} />
          <input style={{ flex: 2, minWidth: 180 }} placeholder="Job link (optional)" value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} />
          <button className="btn sm" onClick={add}>Add</button>
        </div>
      </div>
      {tracker.length ? (
        <div style={{ overflowX: "auto" }}>
          <table className="tr">
            <thead><tr><th>Date</th><th>Company</th><th>Role</th><th>Match</th><th>Interview chance</th><th>Status</th><th>Notes</th><th /></tr></thead>
            <tbody>
              {tracker.map((t, i) => (
                <tr key={`${t.date}-${t.company}-${i}`}>
                  <td>{t.date}</td>
                  <td><b>{t.company}</b></td>
                  <td>{/^https?:\/\//.test(t.url) ? <a href={t.url} target="_blank" rel="noopener noreferrer">{t.role}</a> : t.role}</td>
                  <td>{t.match}</td>
                  <td>{t.chance}</td>
                  <td>
                    <select value={t.status} onChange={(e) => update(i, "status", e.target.value)} aria-label={`Status for ${t.company}`}>
                      {STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td><input value={t.notes} placeholder="Add a note" style={{ padding: "5px 8px", fontSize: 13 }} onChange={(e) => update(i, "notes", e.target.value)} /></td>
                  <td><button className="linkbtn small" onClick={() => confirm(`Remove ${t.company} from your tracker?`) && setTracker(tracker.filter((_, j) => j !== i))}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">No applications yet. They appear here when you confirm you've applied, or add one above.</p>
      )}
    </>
  );
}
