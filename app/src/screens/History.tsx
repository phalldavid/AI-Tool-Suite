import { useMemo, useState } from "react";
import { useApp } from "../store";
import { deleteHistoryItem, download, openHistoryItem } from "../actions";
import { toDataUrl } from "../core/images";
import { Icon } from "../ui/Icon";

export function HistoryScreen() {
  const history = useApp((s) => s.history);
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const w = q.trim().toLowerCase();
    return w ? history.filter((h) => `${h.presetName ?? ""} ${h.project ?? ""} ${h.model} ${h.prompt}`.toLowerCase().includes(w)) : history;
  }, [history, q]);
  const credits = history.reduce((n, h) => n + (h.credits ?? 0), 0);
  return (
    <div className="body">
      <main className="work">
        <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 22 }}>History</h1>
          <span className="num" style={{ color: "var(--muted)", fontSize: 13 }}>
            {history.length} renders{credits ? ` · ${Math.round(credits * 100) / 100} credits spent on this device` : ""}
          </span>
          <input className="input" style={{ marginLeft: "auto", width: 260 }} placeholder="Search history" aria-label="Search history" value={q} onChange={(e) => setQ(e.target.value)} />
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
                <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 6 }}>
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
            <h2>{history.length ? "No match" : "No renders yet"}</h2>
            <p>Every render is kept here with the prompt it used. History stays in this browser.</p>
          </div>
        )}
      </main>
    </div>
  );
}
