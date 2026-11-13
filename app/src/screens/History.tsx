import { useMemo, useState } from "react";
import { useApp } from "../store";
import { copyImageToClipboard as copyImage, deleteHistoryItem, download, openHistoryItem, toggleStar } from "../actions";
import type { ToolId } from "../core/types";

const FILTERS: [string, string][] = [
  ["all", "All"],
  ["starred", "Starred"],
  ["render", "Renders"],
  ["spot-edit", "Spot edits"],
  ["lighting", "Relights"],
  ["style-copy", "Style copies"],
  ["view", "Views"],
];

function matches(f: string, tool: ToolId, starred?: boolean): boolean {
  if (f === "all") return true;
  if (f === "starred") return Boolean(starred);
  if (f === "style-copy") return tool === "style-copy" || tool === "style-match";
  return tool === f;
}
import { toDataUrl } from "../core/images";
import { Icon } from "../ui/Icon";

export function HistoryScreen() {
  const history = useApp((s) => s.history);
  const [q, setQ] = useState("");
  const [f, setF] = useState("all");
  const shown = useMemo(() => {
    const w = q.trim().toLowerCase();
    return history.filter((h) => matches(f, h.tool, h.starred) && (!w || `${h.presetName ?? ""} ${h.project ?? ""} ${h.model} ${h.prompt}`.toLowerCase().includes(w)));
  }, [history, q, f]);
  const credits = history.reduce((n, h) => n + (h.credits ?? 0), 0);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const today = history.filter((h) => h.createdAt >= start.getTime());
  const todayCr = Math.round(today.reduce((n, h) => n + (h.credits ?? 0), 0) * 100) / 100;
  const counts = Object.fromEntries(FILTERS.map(([id]) => [id, history.filter((h) => matches(id, h.tool, h.starred)).length]));
  return (
    <div className="body">
      <main className="work">
        <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 22 }}>History</h1>
          <span className="num" style={{ color: "var(--muted)", fontSize: 13 }}>
            {history.length} renders{credits ? ` · ${Math.round(credits * 100) / 100} credits spent on this device` : ""}
          </span>
          {today.length ? (
            <span className="status neutral num" style={{ cursor: "default" }} title="Renders and credits since midnight">
              Today · {today.length} render{today.length > 1 ? "s" : ""}{todayCr ? ` · ${todayCr} credits` : ""}
            </span>
          ) : null}
          <input className="input" style={{ marginLeft: "auto", width: 260 }} placeholder="Search history" aria-label="Search history" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="chips-row" role="radiogroup" aria-label="Show" style={{ flex: "none" }}>
          {FILTERS.filter(([id]) => id === "all" || counts[id]).map(([id, label]) => (
            <button key={id} type="button" className="chip" role="radio" aria-checked={f === id} onClick={() => setF(id)}>
              {id === "starred" ? <Icon name="star" size={13} /> : null} {label} <small className="num" style={{ opacity: 0.6 }}>{counts[id]}</small>
            </button>
          ))}
        </div>
        {shown.length ? (
          <div className="history-grid thin">
            {shown.map((h) => (
              <div key={h.id} style={{ position: "relative" }}>
                <button type="button" className="hcard lift" style={{ width: "100%" }} onClick={() => openHistoryItem(h)}>
                  <img src={toDataUrl(h.after)} alt="" loading="lazy" />
                  <span className="meta">
                    <b style={{ display: "block" }}>{h.presetName ?? "Render"}</b>
                    <span className="num" style={{ opacity: 0.8 }}>
                      {new Date(h.createdAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {h.provider}
                      {h.credits ? ` · ${h.credits} cr` : ""}
                    </span>
                  </span>
                </button>
                <button type="button" className={`chip-img star${h.starred ? " on" : ""}`} style={{ position: "absolute", top: 8, left: 8, padding: 8 }} aria-label={h.starred ? "Remove star" : "Star"} aria-pressed={Boolean(h.starred)} title={h.starred ? "Remove star" : "Star"} onClick={() => void toggleStar(h.id)}>
                  <Icon name="star" size={14} />
                </button>
                <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 6 }}>
                  <button type="button" className="chip-img" style={{ padding: 8 }} aria-label="Copy image" title="Copy image" onClick={() => void copyImage(h.after)}>
                    <Icon name="clipboard" size={14} />
                  </button>
                  <button type="button" className="chip-img" style={{ padding: 8 }} aria-label="Download" title="Download" onClick={() => void download(h.after, h.presetName ?? "render")}>
                    <Icon name="download" size={14} />
                  </button>
                  <button
                    type="button"
                    className="chip-img"
                    style={{ padding: 8 }}
                    aria-label="Delete from History"
                    title="Delete"
                    onClick={() => {
                      if (window.confirm("Delete this render from History?")) void deleteHistoryItem(h.id);
                    }}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty">
            <Icon name="history" size={36} />
            <h2>{history.length ? (f === "starred" && !q ? "No starred renders" : "No match") : "No renders yet"}</h2>
            <p>Every render is kept here with the prompt it used. History stays in this browser.</p>
          </div>
        )}
      </main>
    </div>
  );
}
