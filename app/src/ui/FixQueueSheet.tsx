// Fix queue: the inspection's snag list for the picture on screen. Each item says what is wrong,
// how big the fix is, and the prompt for it. Small ones the app can run for you (spot edit,
// relight); you still see the prompt and cost before anything is sent.

import { useState } from "react";
import { setState, useApp } from "../store";
import { copyFix, currentFixEntry, editModelId, exportFixFile, fixText, importFixFile, runFix, setFixStatus } from "../actions";
import { canAutoRun, rollup, runsFor, SIZE_LABEL, sortFindings } from "../core/fixes";
import type { Finding, FixStatus } from "../core/fixes";
import { renderCost, usd } from "../lib/cost";
import { Sheet } from "./Sheet";
import { Icon } from "./Icon";

const SEV_COLOUR: Record<Finding["severity"], string> = { blocker: "#c62828", major: "#ef6c00", minor: "#8a6d00", note: "#6b7280" };
const SEV_LABEL: Record<Finding["severity"], string> = { blocker: "Blocker", major: "Major", minor: "Minor", note: "Note" };
const DONE: FixStatus[] = ["closed", "accepted", "wontfix"];

function Item({ image, f }: { image: string; f: Finding }) {
  const [open, setOpen] = useState(f.severity === "blocker" || f.severity === "major");
  const done = DONE.includes(f.status);
  const text = fixText(f);
  return (
    <li style={{ listStyle: "none", border: "1px solid var(--line, #8883)", borderRadius: 12, padding: 12, opacity: done ? 0.6 : 1, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ background: SEV_COLOUR[f.severity], color: "#fff", borderRadius: 10, padding: "1px 8px", fontSize: 12 }}>{SEV_LABEL[f.severity]}</span>
        <b style={{ flex: 1, minWidth: 160 }}>{f.title}</b>
        <span className="status neutral" title={f.fix.risk ?? ""} style={{ cursor: "default" }}>
          {SIZE_LABEL[f.fix.size]}
        </span>
        {f.status !== "open" ? <span className="status neutral" style={{ cursor: "default" }}>{f.status}</span> : null}
      </div>
      <button type="button" className="btn ghost" style={{ alignSelf: "flex-start" }} aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? "Hide details" : "Details"}
      </button>
      {open ? (
        <>
          <p style={{ margin: 0 }}>{f.what}</p>
          {f.expected ? <p className="note" style={{ margin: 0 }}>Should be: {f.expected}</p> : null}
          {f.fix.risk ? <p className="note" style={{ margin: 0 }}>Risk: {f.fix.risk}</p> : null}
          {f.fix.prompt || text.text ? (
            <textarea readOnly className="input" rows={Math.min(8, Math.max(2, Math.ceil(text.text.length / 70)))} value={text.text} aria-label="Fix prompt" style={{ width: "100%", resize: "vertical" }} />
          ) : null}
          {text.notes.map((n) => (
            <p key={n} className="note" style={{ margin: 0 }}>{n}</p>
          ))}
        </>
      ) : null}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {canAutoRun(f) ? (
          <button type="button" className="btn primary" onClick={() => void runFix(image, f)}>
            <Icon name="brush" /> {f.fix.method === "relight" ? "Relight" : "Run spot edit"}
          </button>
        ) : null}
        {f.fix.prompt || text.text ? (
          <button type="button" className="btn" onClick={() => void copyFix(f)}>
            <Icon name="clipboard" /> Copy fix
          </button>
        ) : null}
        {done ? (
          <button type="button" className="btn ghost" onClick={() => void setFixStatus(image, f.id, "open")}>Reopen</button>
        ) : (
          <>
            <button type="button" className="btn ghost" onClick={() => void setFixStatus(image, f.id, f.status === "applied" ? "accepted" : "closed")}>
              {f.status === "applied" ? "Accept result" : "Mark done"}
            </button>
            {f.status === "applied" ? (
              <button type="button" className="btn ghost" onClick={() => void setFixStatus(image, f.id, "recheck")} title="Ask for this item to be inspected again">Needs recheck</button>
            ) : null}
            <button type="button" className="btn ghost" onClick={() => void setFixStatus(image, f.id, "wontfix")}>Skip</button>
          </>
        )}
      </div>
    </li>
  );
}

export function FixQueueSheet() {
  const open = useApp((s) => s.fixSheet);
  const file = useApp((s) => s.fixes);
  const settings = useApp((s) => s.settings);
  useApp((s) => s.editName);
  useApp((s) => s.fixImage);
  useApp((s) => s.versions);
  const entry = open ? currentFixEntry() : undefined;
  const close = () => setState({ fixSheet: false });
  const per = renderCost(settings, editModelId());
  const r = entry ? rollup(entry.findings) : null;
  const cost = r && per.credits !== null ? `${Math.round(r.runs * per.credits * 100) / 100} credits (${usd(r.runs * per.credits)})` : per.label;
  return (
    <Sheet open={open} onClose={close} title="Fix queue" labelledBy="fix-title">
      <div className="sheet-body thin" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {!file ? (
          <>
            <p className="note" style={{ margin: 0 }}>Load the fix list (fixes.json) from the inspection. It lists what is wrong in each render, how big each fix is, and the prompt for it.</p>
            <label className="btn primary" style={{ alignSelf: "flex-start", cursor: "pointer" }}>
              Load fix list
              <input type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void importFixFile(f); }} />
            </label>
          </>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <select className="input" aria-label="Picture" value={entry?.image ?? ""} onChange={(e) => setState({ fixImage: e.target.value || null })} style={{ flex: 1, minWidth: 200 }}>
                {!entry ? <option value="">Pick a picture from the list…</option> : null}
                {file.images.map((e) => {
                  const n = rollup(e.findings);
                  return <option key={e.image} value={e.image}>{`${e.image} · ${n.open} open`}</option>;
                })}
              </select>
              <label className="btn ghost" style={{ cursor: "pointer" }}>
                Load another list
                <input type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void importFixFile(f); }} />
              </label>
              <button type="button" className="btn ghost" onClick={exportFixFile} title="Save the list with its ticks, to send back for another inspection">Save list for re-inspection</button>
            </div>
            {entry && r ? (
              <>
                <p style={{ margin: 0 }}>
                  <b>{entry.verdict === "pass" ? "Passes" : entry.verdict === "fail" ? "Not ready for the client" : "Ready after fixes"}</b>
                  {entry.summary ? ` · ${entry.summary}` : ""}
                </p>
                <p className="note num" style={{ margin: 0 }}>
                  {r.open} open · {r.blockers} blocker{r.blockers === 1 ? "" : "s"} · {r.majors} major · {r.closed} done · the app can run {r.runs} model run{r.runs === 1 ? "" : "s"} for this picture, about {cost}
                </p>
                <ul style={{ margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                  {sortFindings(entry.findings).map((f) => (
                    <Item key={f.id} image={entry.image} f={f} />
                  ))}
                </ul>
                {!entry.findings.length ? <p className="note">Nothing to fix on this picture.</p> : null}
                <p className="note" style={{ margin: 0 }}>Spot edits and relights work on the picture open in the Edit tab. You see the prompt and the cost before anything is sent.{entry.findings.some((f) => runsFor(f) && !canAutoRun(f)) ? " Re-renders and model changes are copy-only for now." : ""}</p>
              </>
            ) : (
              <p className="note" style={{ margin: 0 }}>This picture isn't in the list. Pick one above, or drop the picture that matches a name in the list onto the Edit tab.</p>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}
