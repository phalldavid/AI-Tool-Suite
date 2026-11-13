// Edit tab: always there. Open a render, upload one from your computer, or paste one.
// Bottom pills switch the tool; the image area keeps the same layout for every tool.

import { useEffect, useMemo, useRef, useState } from "react";
import { getState, setState, useApp } from "../store";
import type { EditMode, Version } from "../store";
import type { ImageData64 } from "../core/types";
import { activeImage, clearBase, clearEdit, pasteInto, useEditFileAs, editLightScene, editModelId, captureFromSketchUp, download, openReview, pasteFromClipboard, runRelight, runSpotEdit, useEditFile } from "../actions";
import { toDataUrl } from "../core/images";
import { ZONES, ZonePainter } from "../core/zones";
import type { PaintTool } from "../core/zones";
import { dialTimeId } from "../core/prompt";
import { renderCost } from "../lib/cost";
import { cameraPromptLine } from "../lib/camera";
import { toast } from "../toasts";
import { Panels } from "../ui/Panels";
import { Icon } from "../ui/Icon";
import { SunDial, fmtHour } from "./SunDial";
import { CameraControls, CameraPreview } from "./Camera";
import { LoaderStatus, RenderLoader, StopButton } from "../ui/RenderLoader";
import { LightSceneSwitch } from "../ui/LightSceneSwitch";
import { GLOBAL_PRESETS, MATERIALS, PLANTS, SURFACES, ZONE_GROUPS, appendLine, materialSentence, removeLine } from "../lib/spot";
import { AdditionalNotes } from "./Render";
import { ModelPicker } from "../ui/ModelPicker";
import { useRatio } from "../ui/useRatio";
import { hoverSlot, hoveredSlot, onHoverSlot } from "../lib/pasteTarget";
import { copyImageToClipboard as copyImage, deleteVersion, renameVersion } from "../actions";
import { INTERIOR_RELIGHT } from "../core/prompt";

let painter: ZonePainter | null = null;
let painterFor: unknown = null;

export function EditScreen() {
  const versions = useApp((s) => s.versions);
  const mode = useApp((s) => s.editMode);
  if (!versions.length && mode !== "view" && mode !== "style") return <EditEmpty />;
  return <Panels label="edit" work={<EditWork />} side={<EditSide />} />;
}

function FilePick({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <label className={className} style={{ cursor: "pointer" }}>
      {children}
      <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => {
        for (const f of [...(e.target.files ?? [])]) void useEditFile(f, f.name);
        e.target.value = "";
      }} />
    </label>
  );
}

function EditEmpty() {
  const [over, setOver] = useState(false);
  return (
    <div className="body">
      <main className="work">
        <div
          className="stage rise"
          onDragOver={(e) => {
            if (![...e.dataTransfer.types].includes("Files")) return;
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOver(false);
            const f = [...e.dataTransfer.files].find((x) => x.type.startsWith("image/"));
            if (f) void useEditFile(f, f.name);
          }}
        >
          <div className={`drop breathe${over ? " over" : ""}`}>
            <div className="badge">
              <Icon name="brush" size={30} stroke={1.8} />
            </div>
            <h2>Drop or paste a render to edit</h2>
            <p>
              Spot edit an area, relight it, or make a new view with the same look. Press <b className="kbd">Ctrl V</b> anywhere, or open one from History.
            </p>
            <div className="row">
              <button type="button" className="btn primary sheen" onClick={() => void pasteFromClipboard()}>
                Paste <span className="kbd" style={{ background: "color-mix(in srgb, var(--accent-ink) 14%, transparent)", color: "inherit" }}>Ctrl V</span>
              </button>
              <FilePick className="btn">Upload a render</FilePick>
              <button type="button" className="btn" onClick={() => setState({ tab: "history" })}>
                <Icon name="history" /> History
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

const CAMERA_PRESETS: { label: string; icon: string; title: string; m: { orbit: number; tilt: number; lensMm: number; distanceM: number } }[] = [
  { label: "Eye level", icon: "view", title: "1.6 m high, level, 35 mm", m: { orbit: 0, tilt: 0, lensMm: 35, distanceM: 20 } },
  { label: "Wide angle", icon: "expand", title: "24 mm wide, level", m: { orbit: 0, tilt: 0, lensMm: 24, distanceM: 15 } },
  { label: "Two-point", icon: "grid", title: "Corner view, 30° round, straight verticals", m: { orbit: 30, tilt: 0, lensMm: 35, distanceM: 22 } },
  { label: "Low angle", icon: "up", title: "Close and slightly low, heroic", m: { orbit: -20, tilt: 0, lensMm: 24, distanceM: 10 } },
  { label: "Aerial", icon: "map", title: "Drone at 45°", m: { orbit: 20, tilt: 45, lensMm: 35, distanceM: 60 } },
];

/** Replace the image being edited, or clear the Edit tab. Asks first if a painted selection or queue would be lost. */
function ReplaceClear() {
  const [ask, setAsk] = useState(false);
  useEffect(() => {
    if (!ask) return;
    const t = window.setTimeout(() => setAsk(false), 4000);
    return () => window.clearTimeout(t);
  }, [ask]);
  const unsaved = () => {
    const st = getState();
    return Boolean(painter?.paintedZones().length || st.shots.length || st.styleRef);
  };
  const clear = () => {
    resetPainter();
    clearEdit();
    toast("Edit cleared. Your renders are still in History.", "ok");
  };
  return (
    <span className="rc">
      <label className="pill-btn" title="Replace with another image" style={{ cursor: "pointer" }}>
        <Icon name="image" size={14} /> <span className="lbl-md">Replace</span>
        <input type="file" accept="image/*" className="sr-only" onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            resetPainter();
            void useEditFile(f, f.name, true);
          }
          e.target.value = "";
        }} />
      </label>
      {ask ? (
        <button type="button" className="pill-btn danger" onClick={clear}>
          <Icon name="trash" size={14} /> Clear anyway?
        </button>
      ) : (
        <button type="button" className="pill-btn" aria-label="Clear image" title="Clear image" onClick={() => (unsaved() ? setAsk(true) : clear())}>
          <Icon name="trash" size={14} /> <span className="lbl-md">Clear</span>
        </button>
      )}
    </span>
  );
}

const TOOLS_ROW: [EditMode | "download" | "again" | "copy", string, string][] = [
  ["compare", "Compare", "compare"],
  ["spot", "Spot edit", "brush"],
  ["relight", "Relight", "sun"],
  ["view", "Multi-View", "camera"],
  ["style", "Style copy", "layers"],
  ["again", "Try again", "refresh"],
  ["copy", "Copy", "clipboard"],
  ["download", "Download", "download"],
];

function EditWork() {
  const versions = useApp((s) => s.versions);
  const active = useApp((s) => s.activeVersion);
  const mode = useApp((s) => s.editMode);
  const busy = useApp((s) => s.busy);
  const cap = useApp((s) => s.capture);
  const v = versions[active];
  const rows = versions.map((x, i) => ({ x, i }));
  const same = rows.filter((r) => r.x.kind !== "view");
  const views = rows.filter((r) => r.x.kind === "view");
  const pill = (r: { x: Version; i: number }, n: number, prefix: string) => (
    <button key={r.i} type="button" className="pill" aria-pressed={r.i === active} title={r.x.label} onClick={() => setState({ activeVersion: r.i })}>
      {prefix}{n}
    </button>
  );
  return (
    <>
      <div className="versions">
        <span className="vlabel">Versions</span>
        {same.map((r, n) => pill(r, n + 1, "v"))}
        {views.length ? (
          <>
            <span className="vsep" aria-hidden="true" />
            <span className="vlabel">Views</span>
            {views.map((r, n) => pill(r, n + 1, "View "))}
          </>
        ) : null}
        {v ? <VersionName key={active} i={active} label={v.label} count={versions.length} /> : <span style={{ marginLeft: "auto" }} />}
        <ReplaceClear />
      </div>
      <div className="stage cq" style={{ background: "var(--field)" }}>
        {mode === "view" ? <ViewStage /> : mode === "style" ? <StyleStage /> : mode === "spot" ? <PaintStage key={active} /> : <CompareStage v={v} />}
        <LoaderLayer />
        <LoaderStatus />
      </div>
      <div className="refine-wrap">
        <nav className="refine glass" aria-label="Edit tools">
          {TOOLS_ROW.map(([id, label, icon]) => {
            const disabled = (id === "again" && (!cap || Boolean(busy))) || (!v && id !== "view" && id !== "style");
            return (
              <button
                key={id}
                type="button"
                aria-pressed={id === "copy" || id === "download" || id === "again" ? undefined : mode === id}
                aria-label={label}
                title={id === "again" && !cap ? "Try again needs the view on the Render tab" : id === "copy" ? "Copy image, then paste into chat or slides" : label}
                disabled={disabled}
                onClick={() => {
                  if (id === "download") return void (v && download(v.image, `v${active + 1}`));
                  if (id === "copy") return void (v && copyImage(v.image));
                  if (id === "again") return void openReview();
                  if (id === "view") return setState((s) => ({ editMode: "view", lookIndex: s.editMode === "view" ? s.lookIndex : s.activeVersion }));
                  setState({ editMode: id });
                }}
              >
                <Icon name={icon} />
                <span className="lbl-md">{label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
}

/** The open version's name: click to rename, × to take it off the Edit tab (it stays in History). */
function VersionName({ i, label, count }: { i: number; label: string; count: number }) {
  const [edit, setEdit] = useState(false);
  const [text, setText] = useState(label);
  const save = () => {
    renameVersion(i, text);
    setEdit(false);
  };
  return (
    <span className="vname lbl-md">
      {edit ? (
        <input className="input" autoFocus value={text} aria-label="Version name" onChange={(e) => setText(e.target.value)} onBlur={save} onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") { setText(label); setEdit(false); }
        }} />
      ) : (
        <button type="button" className="lbl" title="Rename this version" onClick={() => { setText(label); setEdit(true); }}>{label}</button>
      )}
      {count > 1 ? (
        <button type="button" className="icon-btn" aria-label="Remove this version" title="Remove this version (it stays in History)" onClick={() => deleteVersion(i)}>
          <Icon name="close" size={14} />
        </button>
      ) : null}
    </span>
  );
}

function CompareStage({ v }: { v: Version }) {
  const mainBefore = useApp((s) => s.before);
  const before = v.before ?? (v.kind === "view" ? null : mainBefore);
  const after = v.image;
  const [split, setSplit] = useState(50);
  const [zoom, setZoom] = useState({ z: 1, x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const drag = useRef<null | "split" | { px: number; py: number; x: number; y: number }>(null);
  const box = useRef<HTMLDivElement>(null);
  const a = useMemo(() => toDataUrl(after), [after]);
  const b = useMemo(() => (before ? toDataUrl(before) : ""), [before]);
  const r = useRatio(after);
  useEffect(() => setZoom({ z: 1, x: 0, y: 0 }), [after]);
  // Mouse wheel zooms about the cursor (non-passive, so the page doesn't scroll).
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setZoom((o) => {
        const z = Math.max(1, Math.min(8, o.z * (e.deltaY < 0 ? 1.2 : 1 / 1.2)));
        if (z === 1) return { z: 1, x: 0, y: 0 };
        const k = z / o.z;
        const clamp = (t: number, size: number) => Math.min(0, Math.max(size * (1 - z), t));
        return { z, x: clamp(mx - (mx - o.x) * k, rect.width), y: clamp(my - (my - o.y) * k, rect.height) };
      });
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);
  const zoomed = zoom.z > 1.001;
  const tf = zoomed ? { transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.z})`, transformOrigin: "0 0" } : {};
  const set = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setSplit(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)));
  };
  return (
    <div className="fit">
      <div
        ref={box}
        className={`frame rise${zoomed ? " zoomed" : ""}${panning ? " panning" : ""}`}
        role="slider"
        tabIndex={0}
        aria-label="Before and after divider. Drag on the image, or use the arrow keys. Scroll to zoom"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(split)}
        style={{ width: `min(100cqw, 100cqh * ${r.toFixed(4)})`, aspectRatio: `${r}`, cursor: zoomed ? undefined : before ? "ew-resize" : "zoom-in", touchAction: "none", userSelect: "none" }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          // Zoomed: drag moves the picture; Shift-drag (or the line itself) still moves the divider.
          if (zoomed && !e.shiftKey) {
            drag.current = { px: e.clientX, py: e.clientY, x: zoom.x, y: zoom.y };
            setPanning(true);
            return;
          }
          if (!before) return;
          drag.current = "split";
          set(e);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          if (d === "split") return set(e);
          const rect = e.currentTarget.getBoundingClientRect();
          const clamp = (t: number, size: number) => Math.min(0, Math.max(size * (1 - zoom.z), t));
          setZoom((o) => ({ ...o, x: clamp(d.x + e.clientX - d.px, rect.width), y: clamp(d.y + e.clientY - d.py, rect.height) }));
        }}
        onPointerUp={() => { drag.current = null; setPanning(false); }}
        onPointerCancel={() => { drag.current = null; setPanning(false); }}
        onDoubleClick={() => setZoom({ z: 1, x: 0, y: 0 })}
        onKeyDown={(e) => {
          if (e.key === "0") return setZoom({ z: 1, x: 0, y: 0 });
          const step = e.shiftKey ? 10 : 2;
          const n = e.key === "ArrowLeft" ? split - step : e.key === "ArrowRight" ? split + step : e.key === "Home" ? 0 : e.key === "End" ? 100 : null;
          if (n === null) return;
          e.preventDefault();
          setSplit(Math.max(0, Math.min(100, n)));
        }}
      >
        <img src={a} alt="Render" draggable={false} style={tf} />
        {before ? (
          <>
            <div style={{ position: "absolute", inset: 0, clipPath: `inset(0 ${100 - split}% 0 0)`, overflow: "hidden" }}>
              <img src={b} alt="Before" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", ...tf }} />
            </div>
            <div className="compare-line" style={{ position: "absolute", top: 0, bottom: 0, left: `${split}%`, width: 2, marginLeft: -1, background: "#fff", pointerEvents: "none" }}>
              <span style={{ position: "absolute", top: "50%", left: "50%", width: 40, height: 40, margin: "-20px 0 0 -20px", borderRadius: "50%", background: "#fff", boxShadow: "0 4px 14px rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", color: "#1b1815" }}>
                <Icon name="compare" size={18} />
              </span>
            </div>
            <span className="chip-img" style={{ position: "absolute", top: 12, left: 12 }}>{v.kind === "view" ? "Your view" : "Before"}</span>
            <span className="chip-img" style={{ position: "absolute", top: 12, right: 12 }}>After</span>
            {zoomed ? null : <span className="chip-img glow lbl-sm" style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", pointerEvents: "none" }}>Drag to compare · scroll to zoom</span>}
          </>
        ) : null}
        {zoomed ? (
          <button type="button" className="chip-img zoomchip num" title="Back to fit (double-click or 0)" onPointerDown={(e) => e.stopPropagation()} onClick={() => setZoom({ z: 1, x: 0, y: 0 })}>
            {Math.round(zoom.z * 100)}% · Fit
          </button>
        ) : null}
        {zoomed && before ? <span className="chip-img lbl-sm" style={{ position: "absolute", bottom: 12, left: 12, pointerEvents: "none" }}>Drag to move · Shift-drag to compare</span> : null}
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
  const r = useRatio(img);
  useApp((s) => s.paintRev);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  // [ and ] change the brush size, like Photoshop.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!p || (e.target as HTMLElement)?.closest?.("input, textarea, select")) return;
      if (e.key !== "[" && e.key !== "]") return;
      e.preventDefault();
      p.size = Math.max(6, Math.min(120, p.size + (e.key === "]" ? 6 : -6)));
      setState((s) => ({ paintRev: s.paintRev + 1 }));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [p]);
  const brushy = p && (p.tool === "brush" || p.erase);
  return (
    <div className="fit">
      <div style={{ position: "relative", width: `min(100cqw, 100cqh * ${r.toFixed(4)})`, aspectRatio: `${r}` }}
        onPointerMove={(e) => { const rect = e.currentTarget.getBoundingClientRect(); setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top }); }}
        onPointerLeave={() => setPos(null)}>
        <div ref={host} className="frame" style={{ width: "100%", height: "100%", cursor: brushy ? "none" : undefined }} />
        {brushy && pos && p ? <span className="brush-ring" style={{ left: pos.x, top: pos.y, width: p.size, height: p.size, borderStyle: p.erase ? "dashed" : "solid" }} /> : null}
      </div>
    </div>
  );
}

/** The render loader over the stage, shaped like the picture being worked on. */
function LoaderLayer() {
  const v = useApp((s) => s.versions[s.activeVersion]);
  const before = useApp((s) => s.before);
  const under = v?.image ?? before;
  const r = useRatio(under);
  return (
    <div className="loader-layer">
      <div className="fit">
        <div className="frame" style={{ width: `min(100cqw, 100cqh * ${r.toFixed(4)})`, aspectRatio: `${r}` }}>
          <RenderLoader under={under} />
        </div>
      </div>
    </div>
  );
}

/** Mouse over a slot: Ctrl V pastes into it. */
function useSlotHover(target?: SlotTarget) {
  const [on, setOn] = useState(false);
  useEffect(() => onHoverSlot(() => setOn(Boolean(target) && hoveredSlot() === target)), [target]);
  useEffect(() => () => { if (target && hoveredSlot() === target) hoverSlot(null); }, [target]);
  return {
    on,
    props: target ? { onPointerEnter: () => hoverSlot(target), onPointerLeave: () => hoverSlot(null) } : {},
  };
}

function Fig({ src, label, children, accent, target }: { src?: string; label: string; children?: React.ReactNode; accent?: boolean; target?: SlotTarget }) {
  const h = useSlotHover(target);
  return (
    <figure className={`rise${h.on ? " paste-target" : ""}`} {...h.props} title={target ? "Ctrl V here replaces this picture" : undefined} style={accent && !h.on ? { outline: "2px solid color-mix(in srgb, var(--accent) 55%, transparent)", outlineOffset: -2 } : undefined}>
      {src ? <img src={src} alt={label} draggable={false} style={{ objectFit: "contain" }} /> : children}
      <figcaption className="chip-img" style={{ position: "absolute", left: 12, top: 12 }}>{label}</figcaption>
    </figure>
  );
}

/** An empty picture slot on the stage: drop, paste or upload into it. */
function DropFig({ title, hint, icon, target }: { title: string; hint: string; icon: string; target: SlotTarget }) {
  const [over, setOver] = useState(false);
  const h = useSlotHover(target);
  return (
    <figure
      className={`rise${h.on ? " paste-target" : ""}`}
      {...h.props}
      onDragOver={(e) => {
        if (![...e.dataTransfer.types].includes("Files")) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        const files = [...e.dataTransfer.files].filter((x) => x.type.startsWith("image/"));
        for (const f of target === "shot" ? files : files.slice(0, 1)) void useEditFileAs(f, f.name, target);
      }}
    >
      <div className={`drop${over ? " over" : ""}`} style={{ inset: 10 }}>
        <div className="badge"><Icon name={icon} size={26} stroke={1.8} /></div>
        <h2 style={{ fontSize: 18 }}>{title}</h2>
        <p>{hint}</p>
        <SlotButtons target={target} primary />
      </div>
    </figure>
  );
}

type SlotTarget = "base" | "ref" | "shot";

/** Paste, Upload (and Capture in SketchUp) into one slot. */
function SlotButtons({ target, primary }: { target: SlotTarget; primary?: boolean }) {
  const host = useApp((s) => s.host);
  return (
    <div className={primary ? "row" : "row-btns"}>
      <button type="button" className={primary ? "btn primary" : "btn"} onClick={() => void pasteInto(target)}>
        <Icon name="clipboard" /> Paste
      </button>
      <label className="btn" style={{ cursor: "pointer" }}>
        <Icon name="image" /> Upload
        <input type="file" accept="image/*" multiple={target === "shot"} className="sr-only" onChange={(e) => {
          for (const f of [...(e.target.files ?? [])]) void useEditFileAs(f, f.name, target);
          e.target.value = "";
        }} />
      </label>
      {host.kind === "sketchup" && target !== "ref" ? (
        <button type="button" className="btn" onClick={() => void captureFromSketchUp()}><Icon name="camera" /> Capture</button>
      ) : null}
    </div>
  );
}

function ViewStage() {
  const versions = useApp((s) => s.versions);
  const lookIndex = useApp((s) => s.lookIndex);
  const source = useApp((s) => s.viewSource);
  const shots = useApp((s) => s.shots);
  const look = versions[lookIndex] ?? versions[0];
  const lookSrc = useMemo(() => (look ? toDataUrl(look.image) : ""), [look]);
  const shotSrc = useMemo(() => (shots[0] ? toDataUrl(shots[0].image) : ""), [shots]);
  return (
    <div className="pairs view-pairs">
      {look ? <Fig src={lookSrc} label="1 · Look source" target="base" /> : <DropFig title="1 · Look source" hint="The render whose materials, light and planting the new view copies." icon="star" target="base" />}
      {source === "camera" ? (
        <Fig label="2 · New camera" accent>
          <CameraPreview />
          <span className="chip-img lbl-sm" style={{ position: "absolute", right: 12, bottom: 12 }}>Orange = front of the building</span>
        </Fig>
      ) : shots.length ? (
        <Fig src={shotSrc} label={shots.length > 1 ? `2 · New view 1 of ${shots.length}` : "2 · New view"} accent target="shot" />
      ) : (
        <DropFig title="2 · New view" hint="A SketchUp screenshot of the new angle. Several at once is fine." icon="camera" target="shot" />
      )}
    </div>
  );
}

function EditSide() {
  const mode = useApp((s) => s.editMode);
  if (mode === "view") return <NewViewPanel />;
  if (mode === "style") return <StyleCopyPanel />;
  return (
    <div className="side-scroll thin">
      {mode === "spot" ? <SpotEditPanel /> : mode === "relight" ? <RelightPanel /> : <SummaryPanel />}
    </div>
  );
}

const SCENE: Record<string, string> = { exterior: "Exterior", interior: "Interior", aerial: "Aerial", sketch: "Sketch" };

function SummaryPanel() {
  const v = useApp((s) => s.versions[s.activeVersion]);
  if (!v) return null;
  const m = v.meta;
  const rows: [string, string, string | undefined][] = [
    ["Scene", "cube", m?.scene ? SCENE[m.scene] ?? m.scene : undefined],
    ["Look", "star", m?.look],
    ["Light", "sun", m?.light],
    ["Environment", "map", m?.environment],
    ["Model", "aperture", m?.model],
  ];
  const known = rows.filter((r) => r[2]);
  return (
    <>
      <div>
        <h1 className="hero" style={{ fontSize: 24 }}>{v.label}</h1>
        <p className="sub">{m ? new Date(m.at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}{v.kind === "view" ? " · new view" : ""}</p>
      </div>
      {known.length ? (
        <div className="summary">
          {known.map(([k, icon, val]) => (
            <div key={k}>
              <Icon name={icon} size={16} />
              <small>{k}</small>
              <b>{val}</b>
            </div>
          ))}
        </div>
      ) : (
        <p className="note" style={{ margin: 0 }}>Uploaded from your computer, so there are no render settings to show. Use the tools below the image to edit it.</p>
      )}
      {v.prompt ? (
        <section className="field">
          <div style={{ display: "flex", alignItems: "center" }}>
            <span className="lbl" style={{ fontWeight: 600, color: "var(--soft)" }}>Master prompt</span>
            <button
              type="button"
              className="linkish"
              style={{ marginLeft: "auto" }}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(v.prompt);
                  toast("Prompt copied", "ok");
                } catch {
                  toast("Couldn't copy. Select the text and press Ctrl C.", "error");
                }
              }}
            >
              <Icon name="clipboard" size={14} /> Copy
            </button>
          </div>
          <textarea className="input mono" rows={14} readOnly value={v.prompt} aria-label="Master prompt" />
        </section>
      ) : null}
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
  const [globalPicks, setGlobalPicks] = useState<string[]>([]);
  const [general, setGeneral] = useState("");
  const [zoneCount, setZoneCount] = useState(2);
  const [group, setGroup] = useState<"light" | "decor" | "material">("light");
  const [surface, setSurface] = useState("surface");
  const [material, setMaterial] = useState(MATERIALS[0]);
  const [ownMaterial, setOwnMaterial] = useState("");
  const [sizing, setSizing] = useState(false);
  const [plant, setPlant] = useState("pothos");
  if (!p) return null;
  const refresh = () => bump((n) => n + 1);
  const tool = p.erase ? "eraser" : p.tool;
  const painted = p.paintedZones();
  const cost = renderCost(s, s.backend === "kie" ? editModelId() : s.kieModel);
  const promptOnly = s.backend === "browser" && !s.testMode;
  const active = ZONES.find((z) => z.id === p.active) ?? ZONES[0];
  const addToZone = (line: string) => setTexts((t) => ({ ...t, [active.id]: appendLine(t[active.id] ?? "", line) }));
  /** Click once to add, again to take out. Adding one takes its opposite out (Add LED / Remove LED). */
  const toggleAction = (a: { pair?: string }, line: string) =>
    setTexts((t) => {
      let v = t[active.id] ?? "";
      if (v.includes(line)) return { ...t, [active.id]: removeLine(v, line) };
      const opp = ZONE_GROUPS.flatMap((g) => g.actions).find((y) => y.id === a.pair);
      if (opp) v = removeLine(v, opp.text);
      if (opp?.id === "add-plants" || a.pair === "add-plants") for (const x of PLANTS) v = removeLine(v, x.text);
      return { ...t, [active.id]: appendLine(v, line) };
    });
  const globalText = [...GLOBAL_PRESETS.filter((g) => globalPicks.includes(g.id)).map((g) => g.text), ...(general.trim() ? [general.trim()] : [])].join(" ");
  const groupDef = ZONE_GROUPS.find((g) => g.id === group);
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
        <div className="brushrow">
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="bs" className="num">Brush size · {p.size} px</label>
            <input
              id="bs"
              type="range"
              min={6}
              max={120}
              value={p.size}
              onPointerDown={() => setSizing(true)}
              onPointerUp={() => setSizing(false)}
              onBlur={() => setSizing(false)}
              onChange={(e) => { p.size = Number(e.target.value); refresh(); }}
              style={{ accentColor: "var(--accent)" }}
            />
          </div>
          <div className={`brushprev${sizing ? " live" : ""}`} aria-hidden="true" title="Actual brush size on the image">
            <span style={{ width: p.size, height: p.size, ["--zc" as string]: tool === "eraser" ? "var(--soft)" : active.css }} />
          </div>
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
                <textarea className="input" rows={Math.min(4, Math.max(1, Math.ceil((texts[z.id]?.length ?? 0) / 46) + ((texts[z.id] ?? "").split("\n").length - 1)))} aria-label={`What should change in ${z.name}`} placeholder="Tap a quick action below, or type" value={texts[z.id] ?? ""} onChange={(e) => setTexts({ ...texts, [z.id]: e.target.value })} />
              </div>
            </div>
          );
        })}
        {zoneCount < ZONES.length ? (
          <button type="button" className="btn ghost" onClick={() => { setZoneCount(zoneCount + 1); p.active = ZONES[zoneCount].id; refresh(); }}><Icon name="plus" /> Add zone</button>
        ) : null}
      </div>
      <section className="quick" style={{ ["--zc" as string]: active.css }}>
        <div className="quick-head">
          <span className="qdot" />
          <b>Quick actions for {active.name}</b>
        </div>
        <div className="seg-mini" role="tablist" aria-label="Quick action group">
          {([["light", "Lighting"], ["decor", "Decor"], ["material", "Material"]] as const).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={group === id} aria-checked={group === id} onClick={() => setGroup(id)}>{label}</button>
          ))}
        </div>
        {groupDef ? (
          <div className="chips-row">
            {groupDef.actions.map((a) => {
              const cur = texts[active.id] ?? "";
              if (a.id === "add-plants") {
                const on = PLANTS.find((x) => cur.includes(x.text));
                return (
                  <span key={a.id} className="chip split qchip" aria-pressed={Boolean(on)}>
                    <button type="button" aria-pressed={Boolean(on)} title={(on ?? PLANTS.find((x) => x.id === plant))!.text} onClick={() => (on ? toggleAction(a, on.text) : toggleAction(a, PLANTS.find((x) => x.id === plant)!.text))}>
                      <Icon name={on ? "check" : "plus"} size={13} /> Add
                    </button>
                    <select aria-label="Which plant" value={on?.id ?? plant} onChange={(e) => {
                      const next = PLANTS.find((x) => x.id === e.target.value)!;
                      setPlant(next.id);
                      setTexts((t) => {
                        let v = t[active.id] ?? "";
                        for (const x of PLANTS) v = removeLine(v, x.text);
                        const pair = groupDef.actions.find((y) => y.id === a.pair);
                        if (pair) v = removeLine(v, pair.text);
                        return { ...t, [active.id]: appendLine(v, next.text) };
                      });
                    }}>
                      {PLANTS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                    </select>
                  </span>
                );
              }
              const on = a.id === "rm-plants" ? cur.includes(a.text) : cur.includes(a.text);
              return (
                <button key={a.id} type="button" className="chip qchip" title={on ? `${a.text}\n\nClick again to take it out.` : a.text} aria-pressed={on} onClick={() => toggleAction(a, a.text)}>
                  <Icon name={on ? "check" : a.icon} size={13} /> {a.label}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="matrow">
            <select className="input" aria-label="Surface" value={surface} onChange={(e) => setSurface(e.target.value)}>
              {SURFACES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
            <span style={{ color: "var(--muted)", fontSize: 13 }}>to</span>
            <select className="input" aria-label="Material" value={material} onChange={(e) => setMaterial(e.target.value)}>
              {MATERIALS.map((m) => <option key={m} value={m}>{m[0].toUpperCase() + m.slice(1)}</option>)}
              <option value="__own">Custom…</option>
            </select>
            {material === "__own" ? <input className="input" aria-label="Your material" placeholder="e.g. laterite block" value={ownMaterial} onChange={(e) => setOwnMaterial(e.target.value)} /> : null}
            <button type="button" className="btn" disabled={material === "__own" && !ownMaterial.trim()} onClick={() => addToZone(materialSentence(surface, material === "__own" ? ownMaterial : material))}>
              <Icon name="plus" /> Add
            </button>
          </div>
        )}
      </section>
      <section className="field">
        <span className="lbl" style={{ fontWeight: 600, color: "var(--soft)" }}>Global Edit <small style={{ fontWeight: 400, color: "var(--muted)" }}>· whole picture</small></span>
        <div className="chips-row">
          {GLOBAL_PRESETS.map((g) => (
            <button key={g.id} type="button" className="chip qchip" aria-pressed={globalPicks.includes(g.id)} title={g.text} onClick={() => setGlobalPicks((x) => (x.includes(g.id) ? x.filter((y) => y !== g.id) : [...x, g.id]))}>
              <Icon name={g.icon} size={13} /> {g.label}
            </button>
          ))}
        </div>
        <input id="gen" className="input" aria-label="Your own global edit" value={general} onChange={(e) => setGeneral(e.target.value)} placeholder="Your own, e.g. make the sky clearer" />
      </section>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="btn" style={{ flex: 1 }} aria-label="Undo, Ctrl Z" title="Undo · Ctrl Z" disabled={!p.canUndo()} onClick={() => { p.undo(); refresh(); }}>
          <Icon name="undo" /> <span className="lbl-xs">Undo</span>
        </button>
        <button type="button" className="btn" style={{ flex: 1 }} aria-label="Clear all selections" title="Clear all" onClick={() => { p.clearAll(); refresh(); }}>
          <Icon name="trash" /> <span className="lbl-xs">Clear all</span>
        </button>
      </div>
      <p className="note" style={{ margin: 0 }}>{globalText ? "Global Edit changes the whole picture, so the result is not pasted back over the original." : "Everything outside your selection is pasted back from the original, so it stays exactly as it was."}</p>
      <ModelPicker edit />
      {busy ? <StopButton /> : <button type="button" className="cta sheen" onClick={() => void runSpotEdit(p, texts, globalText).then(refresh)}>
        {promptOnly ? <><Icon name="clipboard" size={18} /> Get edit prompt + painted image</> : <>Apply edit · {cost.label}</>}
      </button>}
    </>
  );
}

const RELIGHT: { id: string; label: string; sub: string; hour?: number; sky: [string, string] }[] = [
  { id: "morning", label: "Morning", sub: "07:00 · soft east", hour: 7, sky: ["#5f9bd6", "#f3d6a6"] },
  { id: "noon", label: "Midday", sub: "12:00 · crisp", hour: 12, sky: ["#2f86d8", "#bfe0f6"] },
  { id: "afternoon", label: "Afternoon", sub: "16:30 · warm west", hour: 16.5, sky: ["#4a88c7", "#f2c98d"] },
  { id: "blue-hour", label: "Blue hour", sub: "18:45 · lights on", hour: 18.75, sky: ["#101a3d", "#3d5a99"] },
  { id: "overcast", label: "Monsoon", sub: "Overcast, wet", sky: ["#5d6b74", "#9aa7ad"] },
  { id: "night", label: "Night", sub: "Lights only", sky: ["#05070f", "#1b2036"] },
];

const RELIGHT_INTERIOR: typeof RELIGHT = [
  ...INTERIOR_RELIGHT.map((o) => ({ id: o.id, label: o.label, sub: o.sub ?? "", sky: (o.swatch ?? ["#3a2a1c", "#c98a4a"]) as [string, string] })),
  { id: "night", label: "Night", sub: "Lights only", sky: ["#05070f", "#1b2036"] },
];

function RelightPanel() {
  useApp((s) => s.editScene);
  useApp((s) => s.versions[s.activeVersion]);
  const interior = editLightScene() === "interior";
  const cards = interior ? RELIGHT_INTERIOR : RELIGHT;
  const [hour, setHour] = useState(() => getState().styleHour);
  const [card, setCard] = useState<string>("time");
  const busy = useApp((s) => s.busy);
  const s = useApp((x) => x.settings);
  const cost = renderCost(s, s.backend === "kie" ? editModelId() : s.kieModel);
  const id = card === "time" ? dialTimeId(hour) : card;
  const what = card === "time" ? fmtHour(hour) : cards.find((r) => r.id === card)?.label ?? RELIGHT.find((r) => r.id === card)?.label;
  return (
    <>
      <div>
        <h2 style={{ fontSize: 22 }}>Relight</h2>
        <p className="sub">Same building and camera, new time of day.</p>
      </div>
      <LightSceneSwitch info edit />
      <section className="step cq">
        <div className="lightwrap">
          <div className="dialcol">
            <SunDial hour={hour} onHour={(h) => { setHour(h); setCard("time"); }} />
          </div>
          <div className="lightcards">
            {cards.map((c) => {
              const on = card === c.id || (card === "time" && c.hour !== undefined && Math.abs(hour - c.hour) < 0.01);
              return (
                <button key={c.id} type="button" className="lightcard" aria-pressed={on} onClick={() => (c.hour !== undefined ? (setHour(c.hour), setCard("time")) : setCard(c.id))}>
                  <span className="sky" style={{ background: `linear-gradient(180deg, ${c.sky[0]}, ${c.sky[1]})` }} />
                  <b>{c.label}</b>
                  <small>{c.sub}</small>
                </button>
              );
            })}
          </div>
        </div>
      </section>
      <ModelPicker edit />
      {busy ? <StopButton /> : <button type="button" className="cta sheen" onClick={() => void runRelight(id)}>
        <Icon name="sun" size={18} /> Relight to {what} · {cost.label}
      </button>}
    </>
  );
}

function NewViewPanel() {
  const source = useApp((s) => s.viewSource);
  const shots = useApp((s) => s.shots);
  const cam = useApp((s) => s.camera);
  const busy = useApp((s) => s.busy);
  const s = useApp((x) => x.settings);
  const lookIndex = useApp((x) => x.lookIndex);
  const look = useApp((x) => x.versions[x.lookIndex] ?? x.versions[0]);
  const one = renderCost(s, s.backend === "kie" ? editModelId() : s.kieModel);
  const n = source === "shot" ? shots.length : 1;
  const total = one.credits !== null && n > 1 ? `${one.credits * n} credits` : one.label;
  const promptOnly = s.backend === "browser" && !s.testMode;
  return (
    <>
      <div className="side-scroll thin">
        <div>
          <h2 style={{ fontSize: 22 }}>Multi-View</h2>
          <p className="sub">Same look, new angle. Materials, light and environment come from the look source.</p>
        </div>
        <ol className="style-steps">
          <Slot title="Look source" hint={look ? undefined : "The render whose look the new view copies."} image={look?.image} name={look ? `${look.kind === "view" ? "View" : "v"}${lookIndex + 1} · ${look.label}` : undefined} onClear={clearBase} target="base" />
          <Slot title="New view" target="shot">
            <div className="tabs2" role="radiogroup" aria-label="How to set the new view">
              <button type="button" role="radio" aria-checked={source === "shot"} onClick={() => setState({ viewSource: "shot" })}>My view</button>
              <button type="button" role="radio" aria-checked={source === "camera"} onClick={() => setState({ viewSource: "camera" })}>Move camera</button>
            </div>
            {source === "shot" ? (
              <>
                <small>Most accurate: keeps the geometry of your screenshot exactly. Add several to render them as a set.</small>
                {shots.map((x, i) => (
                  <div key={i} className="qitem">
                    <img src={toDataUrl(x.image)} alt="" />
                    <span>{i + 1}. {x.name}</span>
                    <button type="button" className="icon-btn" aria-label={`Clear ${x.name}`} title="Clear" onClick={() => setState((st) => ({ shots: st.shots.filter((_, j) => j !== i) }))}>
                      <Icon name="close" size={14} />
                    </button>
                  </div>
                ))}
                <SlotButtons target="shot" />
              </>
            ) : (
              <>
                <small>Quick, but the AI imagines sides it hasn't seen. Small moves (under about 45°) work best.</small>
                <div className="chips-row" aria-label="Camera presets">
                  {CAMERA_PRESETS.map((x) => (
                    <button key={x.label} type="button" className="chip qchip" title={x.title} aria-pressed={cam.orbit === x.m.orbit && cam.tilt === x.m.tilt && cam.lensMm === x.m.lensMm && cam.distanceM === x.m.distanceM} onClick={() => setState({ camera: { ...x.m } })}>
                      <Icon name={x.icon} size={13} /> {x.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </Slot>
        </ol>
        {source === "camera" ? <CameraControls /> : null}
        <section className="field">
          <span className="lbl" style={{ fontWeight: 600, color: "var(--soft)" }}>Scene</span>
          <LightSceneSwitch info edit />
        </section>
        <AdditionalNotes slot="view" />
      </div>
      <div className="side-foot">
        <ModelPicker edit />
        {busy ? <StopButton /> : <button type="button" className="cta sheen" disabled={!look || (source === "shot" && !shots.length)} onClick={() => void openReview(source === "shot" ? "shots" : "view")}>
          <Icon name="camera" size={18} />
          {promptOnly ? "Get prompt · free" : source === "shot" ? (n > 1 ? `Render ${n} views · ${total}` : `Render this view · ${total}`) : `Render new camera · ${one.label}`}
        </button>}
      </div>
    </>
  );
}

export function resetPainter(): void {
  painter = null;
  painterFor = null;
}

function StyleStage() {
  const v = useApp((s) => s.versions[s.activeVersion]);
  const ref = useApp((s) => s.styleRef);
  const baseSrc = useMemo(() => (v ? toDataUrl(v.image) : ""), [v]);
  const refSrc = useMemo(() => (ref ? toDataUrl(ref.image) : ""), [ref]);
  return (
    <div className="pairs view-pairs">
      {v ? <Fig src={baseSrc} label="1 · Base architecture" target="base" /> : <DropFig title="1 · Base architecture" hint="Your SketchUp view: the building and camera that stay exactly as they are." icon="cube" target="base" />}
      {ref ? <Fig src={refSrc} label="2 · Style reference" accent target="ref" /> : <DropFig title="2 · Style reference" hint="A photo whose materials, light and mood you want. Its building is not copied, only its look." icon="layers" target="ref" />}
    </div>
  );
}

/** One numbered step on the right: a filled slot (thumbnail, name, ×) or its Paste / Upload buttons. */
function Slot({ title, hint, image, name, onClear, target, children }: { title: string; hint?: string; image?: ImageData64 | null; name?: string; onClear?: () => void; target?: SlotTarget; children?: React.ReactNode }) {
  const h = useSlotHover(target);
  return (
    <li {...h.props} className={h.on ? "paste-target" : undefined}>
      <b>{title}</b>
      {hint ? <small>{hint}</small> : null}
      {image ? (
        <div className="qitem">
          <img src={toDataUrl(image)} alt="" />
          <span>{name}</span>
          {onClear ? (
            <button type="button" className="icon-btn" aria-label={`Clear ${title}`} title="Clear" onClick={onClear}>
              <Icon name="close" size={14} />
            </button>
          ) : null}
        </div>
      ) : target && !children ? (
        <SlotButtons target={target} />
      ) : null}
      {children}
    </li>
  );
}

function StyleCopyPanel() {
  const ref = useApp((s) => s.styleRef);
  const base = useApp((s) => s.versions[s.activeVersion]);
  const activeIdx = useApp((s) => s.activeVersion);
  const light = useApp((s) => s.styleLight);
  const busy = useApp((s) => s.busy);
  const hour = useApp((s) => s.styleHour);
  const s = useApp((x) => x.settings);
  const cost = renderCost(s, s.backend === "kie" ? editModelId() : s.kieModel);
  const promptOnly = s.backend === "browser" && !s.testMode;
  return (
    <>
      <div className="side-scroll thin">
        <div>
          <h2 style={{ fontSize: 22 }}>Reference Style Copy</h2>
          <p className="sub">Keeps the building and camera of image 1. Copies materials, light, planting and photo style from image 2.</p>
        </div>
        <ol className="style-steps">
          <Slot title="Base architecture" hint={base ? undefined : "Your SketchUp view: geometry and camera stay exactly as they are."} image={base?.image} name={base ? `v${activeIdx + 1} · ${base.label}` : undefined} onClear={clearBase} target="base" />
          <Slot title="Style reference" hint={ref ? undefined : "The photo whose materials, light and mood you want."} image={ref?.image} name={ref?.name} onClear={() => setState({ styleRef: null })} target="ref" />
        </ol>
        <section className="field">
          <span className="lbl" style={{ fontWeight: 600, color: "var(--soft)" }}>Scene</span>
          <LightSceneSwitch info edit />
        </section>
        <section className="field">
          <span className="lbl" style={{ fontWeight: 600, color: "var(--soft)" }}>Time of day and sun</span>
          <div className="tabs2" role="radiogroup" aria-label="Where the light comes from">
            <button type="button" role="radio" aria-checked={light === "reference"} onClick={() => setState({ styleLight: "reference" })}>From the reference</button>
            <button type="button" role="radio" aria-checked={light === "dial"} onClick={() => setState({ styleLight: "dial" })}>My sun dial</button>
          </div>
          {light === "dial" ? (
            <div className="dialcol" style={{ marginTop: 8 }}>
              <SunDial hour={hour} onHour={(h) => setState({ styleHour: h })} />
            </div>
          ) : (
            <small style={{ color: "var(--muted)" }}>The render copies the sun angle, time of day and sky of the reference photo.</small>
          )}
        </section>
        <AdditionalNotes slot="style" />
      </div>
      <div className="side-foot">
        <ModelPicker edit />
        {busy ? <StopButton /> : <button type="button" className="cta sheen" disabled={!ref || !base} onClick={() => void openReview("style")}>
          <Icon name="layers" size={18} />
          {promptOnly ? "Get prompt · free" : `Copy the style · ${cost.label}`}
        </button>}
      </div>
    </>
  );
}
