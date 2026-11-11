import { useEffect, useMemo, useRef, useState } from "react";
import { getState, setState, useApp } from "../store";
import { activeImage, download, openReview, runRelight, runSpotEdit } from "../actions";
import { toDataUrl } from "../core/images";
import { ZONES, ZonePainter } from "../core/zones";
import type { PaintTool } from "../core/zones";
import { renderCost } from "../lib/cost";
import { Panels } from "../ui/Panels";
import { Icon } from "../ui/Icon";

type Mode = "compare" | "edit" | "relight";

let painter: ZonePainter | null = null;
let painterFor: unknown = null;

export function ResultScreen() {
  const versions = useApp((s) => s.versions);
  const [mode, setMode] = useState<Mode>("compare");
  if (!versions.length) {
    return (
      <div className="body">
        <div className="empty">
          <Icon name="image" size={36} />
          <h2>No render yet</h2>
          <p>Render a view, or open one from History.</p>
          <button type="button" className="btn primary" onClick={() => setState({ tab: "render" })}>Go to Render</button>
        </div>
      </div>
    );
  }
  return <Panels label="edit" work={<ResultWork mode={mode} setMode={setMode} />} side={<ResultSide mode={mode} setMode={setMode} />} />;
}

function ResultWork({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  const versions = useApp((s) => s.versions);
  const active = useApp((s) => s.activeVersion);
  const before = useApp((s) => s.before);
  const busy = useApp((s) => s.busy);
  const v = versions[active];
  const tools: [Mode | "view" | "download" | "again", string, string][] = [
    ["compare", "Compare", "compare"],
    ["edit", "Spot edit", "brush"],
    ["relight", "Relight", "sun"],
    ["view", "New view", "camera"],
    ["again", "Try again", "refresh"],
    ["download", "Download", "download"],
  ];
  return (
    <>
      <div className="versions">
        <span style={{ fontSize: 12.5, color: "var(--muted)", marginRight: 4 }}>Versions</span>
        {versions.map((x, i) => (
          <button key={i} type="button" className="pill" aria-pressed={i === active} title={x.label} onClick={() => setState({ activeVersion: i })}>
            v{i + 1}
          </button>
        ))}
        <span className="lbl-md" style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--muted)" }}>{v?.label}</span>
      </div>
      <div className="stage cq" style={{ background: "var(--field)" }}>
        {mode === "edit" ? <PaintStage key={active} /> : <CompareStage before={before} after={v.image} />}
        {busy ? (
          <div className="progress" role="status">
            <Icon name="aperture" className="spin-slow" />
            <span>{busy.label}…</span>
            <div className="bar"><i style={{ width: "60%" }} /></div>
          </div>
        ) : null}
      </div>
      <nav className="refine glass cq" aria-label="Refine">
        {tools.map(([id, label, icon]) => (
          <button
            key={id}
            type="button"
            aria-pressed={mode === id}
            aria-label={label}
            title={label}
            onClick={() => {
              if (id === "view") return setState({ tab: "camera" });
              if (id === "download") return void download(v.image, `render-v${active + 1}`);
              if (id === "again") return void openReview();
              setMode(id);
            }}
          >
            <Icon name={icon} />
            <span className="lbl-md">{label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}

function CompareStage({ before, after }: { before: ReturnType<typeof activeImage>; after: NonNullable<ReturnType<typeof activeImage>> }) {
  const [split, setSplit] = useState(50);
  const drag = useRef(false);
  const a = useMemo(() => toDataUrl(after), [after]);
  const b = useMemo(() => (before ? toDataUrl(before) : ""), [before]);
  const r = after.width && after.height ? after.width / after.height : 4 / 3;
  const set = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setSplit(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)));
  };
  return (
    <div className="fit">
      <div
        className="frame rise"
        role="slider"
        tabIndex={0}
        aria-label="Before and after divider. Drag on the image, or use the arrow keys"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(split)}
        style={{ width: `min(100cqw, 100cqh * ${r.toFixed(4)})`, aspectRatio: `${r}`, cursor: before ? "ew-resize" : "default", touchAction: "none", userSelect: "none" }}
        onPointerDown={(e) => {
          if (!before) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = true;
          set(e);
        }}
        onPointerMove={(e) => drag.current && set(e)}
        onPointerUp={() => (drag.current = false)}
        onPointerCancel={() => (drag.current = false)}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 10 : 2;
          const n = e.key === "ArrowLeft" ? split - step : e.key === "ArrowRight" ? split + step : e.key === "Home" ? 0 : e.key === "End" ? 100 : null;
          if (n === null) return;
          e.preventDefault();
          setSplit(Math.max(0, Math.min(100, n)));
        }}
      >
        <img src={a} alt="Render" draggable={false} />
        {before ? (
          <>
            <div style={{ position: "absolute", inset: 0, clipPath: `inset(0 ${100 - split}% 0 0)` }}>
              <img src={b} alt="Before" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <div className="compare-line" style={{ position: "absolute", top: 0, bottom: 0, left: `${split}%`, width: 2, marginLeft: -1, background: "#fff", pointerEvents: "none" }}>
              <span style={{ position: "absolute", top: "50%", left: "50%", width: 40, height: 40, margin: "-20px 0 0 -20px", borderRadius: "50%", background: "#fff", boxShadow: "0 4px 14px rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", color: "#1b1815" }}>
                <Icon name="compare" size={18} />
              </span>
            </div>
            <span className="chip-img" style={{ position: "absolute", top: 12, left: 12 }}>Before</span>
            <span className="chip-img" style={{ position: "absolute", top: 12, right: 12 }}>After</span>
            <span className="chip-img glow lbl-sm" style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", pointerEvents: "none" }}>Drag to compare</span>
          </>
        ) : null}
      </div>
    </div>
  );
}

function usePainter(): ZonePainter | null {
  const img = activeImage();
  if (img !== painterFor) {
    painter = new ZonePainter();
    painterFor = img;
  }
  return painter;
}

function PaintStage() {
  const img = activeImage();
  const p = usePainter();
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!img || !p || !host.current) return;
    const el = document.createElement("img");
    el.src = toDataUrl(img);
    el.alt = "Render to edit";
    el.draggable = false;
    const surface = p.surface(el);
    p.onChange = () => setState((s) => ({ paintRev: s.paintRev + 1 }));
    host.current.replaceChildren(surface);
  }, [img, p]);
  const r = img?.width && img.height ? img.width / img.height : 4 / 3;
  return (
    <div className="fit">
      <div ref={host} className="frame" style={{ width: `min(100cqw, 100cqh * ${r.toFixed(4)})`, aspectRatio: `${r}` }} />
    </div>
  );
}

function ResultSide({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  return (
    <div className="side-scroll thin">
      {mode === "edit" ? <SpotEditPanel /> : mode === "relight" ? <RelightPanel /> : <InfoPanel setMode={setMode} />}
    </div>
  );
}

function InfoPanel({ setMode }: { setMode: (m: Mode) => void }) {
  const v = useApp((s) => s.versions[s.activeVersion]);
  const [open, setOpen] = useState(false);
  if (!v) return null;
  return (
    <>
      <div>
        <h1 className="hero" style={{ fontSize: 24 }}>Looks good?</h1>
        <p className="sub">Fix one area, change the light, or make another view with the same look.</p>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        <button type="button" className="btn" style={{ justifyContent: "flex-start" }} onClick={() => setMode("edit")}><Icon name="brush" /> Spot edit an area</button>
        <button type="button" className="btn" style={{ justifyContent: "flex-start" }} onClick={() => setMode("relight")}><Icon name="sun" /> Change the light</button>
        <button type="button" className="btn" style={{ justifyContent: "flex-start" }} onClick={() => setState({ tab: "camera" })}><Icon name="camera" /> New view, same look</button>
        <button type="button" className="btn primary" style={{ justifyContent: "flex-start" }} onClick={() => void download(v.image, "render")}><Icon name="download" /> Download</button>
      </div>
      <section className="step">
        <button type="button" className="more" onClick={() => setOpen(!open)}>
          <Icon name={open ? "chevron" : "plus"} size={14} /> Prompt used
        </button>
        {open ? <textarea className="input mono" rows={10} readOnly value={v.prompt} aria-label="Prompt used" /> : null}
      </section>
    </>
  );
}

const TOOLS: [PaintTool | "eraser", string, string][] = [
  ["brush", "Brush", "brush"],
  ["rect", "Rectangle", "rect"],
  ["lasso", "Lasso", "lasso"],
  ["eraser", "Eraser", "eraser"],
];

function SpotEditPanel() {
  const p = usePainter();
  useApp((s) => s.paintRev);
  const busy = useApp((s) => s.busy);
  const s = useApp((x) => x.settings);
  const [, bump] = useState(0);
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState("");
  const [zoneCount, setZoneCount] = useState(2);
  if (!p) return null;
  const refresh = () => bump((n) => n + 1);
  const tool = p.erase ? "eraser" : p.tool;
  const painted = p.paintedZones();
  const cost = renderCost(s, s.backend === "kie" ? s.editModel || s.kieModel : s.kieModel);
  return (
    <>
      <div>
        <h2 style={{ fontSize: 22 }}>Spot edit</h2>
        <p className="sub" style={{ height: 18, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {tool === "rect" ? "Drag a box around the area to change." : tool === "lasso" ? "Draw around the area; it closes when you let go." : tool === "eraser" ? "Paint over a selection to remove it." : "Paint over the area to change."}
        </p>
      </div>
      <div className="tools4" role="toolbar" aria-label="Selection tools">
        {TOOLS.map(([id, label, icon]) => (
          <button
            key={id}
            type="button"
            aria-pressed={tool === id}
            title={label}
            onClick={() => {
              if (id === "eraser") {
                p.erase = true;
                p.tool = "brush";
              } else {
                p.erase = false;
                p.tool = id;
              }
              refresh();
            }}
          >
            <Icon name={icon} size={20} stroke={1.8} />
            {label}
          </button>
        ))}
      </div>
      {tool === "brush" || tool === "eraser" ? (
        <div className="field">
          <label htmlFor="bs" className="num">Brush size · {p.size} px</label>
          <input id="bs" type="range" min={6} max={120} value={p.size} onChange={(e) => { p.size = Number(e.target.value); refresh(); }} style={{ accentColor: "var(--accent)" }} />
        </div>
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {ZONES.slice(0, zoneCount).map((z) => {
          const on = p.active === z.id;
          const has = painted.includes(z.id);
          return (
            <div key={z.id} className={`zone${on ? " on" : ""}`} style={{ ["--zc" as string]: z.css }} onClick={() => { p.active = z.id; refresh(); }}>
              <button type="button" className="tag" aria-label={`Select ${z.name}`} aria-pressed={on}>{z.id}</button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "baseline", fontSize: 13, fontWeight: 600 }}>
                  {z.name}
                  <span className="state" style={{ color: has ? "var(--ok)" : "var(--warn)" }}>{has ? "painted" : "not painted"}</span>
                </div>
                <textarea className="input" rows={1} aria-label={`What should change in ${z.name}`} placeholder="What should change here?" value={texts[z.id] ?? ""} onChange={(e) => setTexts({ ...texts, [z.id]: e.target.value })} />
              </div>
            </div>
          );
        })}
        {zoneCount < ZONES.length ? (
          <button type="button" className="btn ghost" onClick={() => { setZoneCount(zoneCount + 1); p.active = ZONES[zoneCount].id; refresh(); }}>Add zone</button>
        ) : null}
      </div>
      <div className="field">
        <label htmlFor="gen">Change for the whole picture (optional)</label>
        <input id="gen" className="input" value={general} onChange={(e) => setGeneral(e.target.value)} placeholder="e.g. make the sky clearer" />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="btn" style={{ flex: 1 }} aria-label="Undo, Ctrl Z" title="Undo · Ctrl Z" disabled={!p.canUndo()} onClick={() => { p.undo(); refresh(); }}>
          <Icon name="undo" /> <span className="lbl-xs">Undo</span>
        </button>
        <button type="button" className="btn" style={{ flex: 1 }} aria-label="Clear all selections" title="Clear all" onClick={() => { p.clearAll(); refresh(); }}>
          <Icon name="trash" /> <span className="lbl-xs">Clear all</span>
        </button>
      </div>
      <p className="note" style={{ margin: 0 }}>Everything outside your selection is pasted back from the original, so it stays exactly as it was.</p>
      <button type="button" className="cta sheen" disabled={Boolean(busy)} onClick={() => void runSpotEdit(p, texts, general).then(refresh)}>
        Apply edit · {cost.label}
      </button>
    </>
  );
}

const RELIGHT: [string, string, [string, string]][] = [
  ["morning", "Morning", ["#5f9bd6", "#f3d6a6"]],
  ["noon", "Midday", ["#2f86d8", "#bfe0f6"]],
  ["afternoon", "Late afternoon", ["#4a88c7", "#f2c98d"]],
  ["blue-hour", "Blue hour", ["#101a3d", "#3d5a99"]],
  ["overcast", "Monsoon", ["#5d6b74", "#9aa7ad"]],
  ["night", "Night", ["#05070f", "#1b2036"]],
];

function RelightPanel() {
  const [pick, setPick] = useState("blue-hour");
  const busy = useApp((s) => s.busy);
  const s = useApp((x) => x.settings);
  const cost = renderCost(s, s.backend === "kie" ? s.editModel || s.kieModel : s.kieModel);
  return (
    <>
      <div>
        <h2 style={{ fontSize: 22 }}>Change the light</h2>
        <p className="sub">Same building and camera, new time of day.</p>
      </div>
      <div className="lightcards">
        {RELIGHT.map(([id, label, sky]) => (
          <button key={id} type="button" className="lightcard" aria-pressed={pick === id} onClick={() => setPick(id)}>
            <span className="sky" style={{ background: `linear-gradient(180deg, ${sky[0]}, ${sky[1]})` }} />
            <b>{label}</b>
          </button>
        ))}
      </div>
      <button type="button" className="cta sheen" disabled={Boolean(busy)} onClick={() => void runRelight(pick)}>
        Relight · {cost.label}
      </button>
    </>
  );
}

export function resetPainter(): void {
  painter = null;
  painterFor = null;
  void getState;
}
