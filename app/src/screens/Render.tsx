import { useEffect, useMemo, useRef, useState } from "react";
import { getState, setState, useApp } from "../store";
import { captureFromSketchUp, clearView, lightCaption, lookPreset, openHistoryItem, openReview, pasteFromClipboard, pickFrame, updateSettings, useFile } from "../actions";
import { FRAME_ROW, findFrame, swapFrameId } from "../core/frame";
import { toDataUrl } from "../core/images";
import { previewFile } from "../core/preview-files";
import { findLibraryItem } from "../core/library";
import { LIGHTING, findOption, parseDialTime } from "../core/prompt";
import { contextLabel, parseContexts, joinContexts } from "../core/context";
import type { ProjectType } from "../core/types";
import { renderCost } from "../lib/cost";
import { splitTypology } from "../lib/typology";
import { resetSize, setSizes, useSizes } from "../layout";
import { Panels } from "../ui/Panels";
import { Splitter } from "../ui/Splitter";
import { Icon } from "../ui/Icon";
import { SunDial, fmtHour } from "./SunDial";
import { ModelPicker } from "../ui/ModelPicker";
import { DYN_ICONS } from "../ui/DynamicSheet";
import { GENERATORS, countSet } from "../core/dynamic";
import { BUILT_IN_NOTES, GLASS_COLOURS, labelFor, loadCustomNotes, saveCustomNotes } from "../lib/notes";
import type { NotePreset } from "../lib/notes";

const STARTERS: Record<ProjectType, string[]> = {
  exterior: ["ext-mansion-tropical", "ext-mansion-new-khmer", "ext-link-house-modern", "ext-hotel-tropical", "ext-mansion-minimal", "ext-link-house-indochine"],
  interior: ["int-living-modern", "int-living-khmer", "int-kitchen-japandi", "int-bedroom-tropical", "int-bathroom-minimal", "int-dining-indochine"],
  aerial: ["air-borey-golden", "air-resort-default", "air-township-blue", "air-riverside-golden", "air-mixed-use-overcast", "air-campus-default"],
  sketch: ["sketch-to-photo", "sketch-villa-dusk", "sketch-interior"],
};

const PLACES: Record<ProjectType, string[]> = {
  exterior: ["tropical-garden", "pp-street", "borey", "riverside", "kampot"],
  interior: ["view-garden", "view-city", "view-river", "view-pool"],
  aerial: ["mp-city", "mp-suburb", "mp-farmland", "mp-river"],
  sketch: ["tropical-garden", "pp-street", "borey"],
};

const TYPES: [ProjectType, string][] = [
  ["exterior", "Exterior"],
  ["interior", "Interior"],
  ["aerial", "Aerial"],
  ["sketch", "Sketch"],
];

export function RenderScreen() {
  return <Panels label="render" work={<RenderWork />} side={<RenderSide />} />;
}

// ---------- left: the view ----------

function RenderWork() {
  const history = useApp((s) => s.history);
  const { stripH } = useSizes();
  const collapsed = stripH < 70 || history.length === 0;
  const h = collapsed ? 40 : stripH;
  const thumbH = Math.max(40, h - 34);
  return (
    <>
      <Stage />
      {history.length ? (
        <>
          <div style={{ margin: "-6px 0" }}>
            <Splitter
              dir="h"
              label="Resize recent renders"
              value={h}
              onSize={(p, box) => {
                const v = Math.round(box.bottom - p.y - 12);
                setSizes({ stripH: v < 70 ? 40 : Math.min(260, v) }, false);
              }}
              onDone={() => setSizes({}, true)}
              onReset={() => resetSize("strip")}
            />
          </div>
          <section className="strip" aria-label="Recent renders" style={{ height: h }}>
            <div className="strip-head">
              <h2>Recent renders</h2>
              <button type="button" className="linkish" onClick={() => setState({ tab: "history" })}>See all</button>
              <button type="button" className="chip" style={{ marginLeft: "auto", padding: "4px 10px", fontSize: 12.5 }} onClick={() => setSizes({ stripH: collapsed ? 150 : 40 })}>
                {collapsed ? "Show" : "Hide"}
              </button>
            </div>
            {!collapsed ? (
              <div className="thumbs noscroll">
                {history.slice(0, 12).map((it) => (
                  <button key={it.id} type="button" className="thumb lift" style={{ width: Math.round(thumbH * 1.5), height: thumbH }} onClick={() => openHistoryItem(it)}>
                    <img src={toDataUrl(it.after)} alt="" loading="lazy" />
                    <span>{it.presetName ?? "Render"} · {new Date(it.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </>
  );
}

function Stage() {
  const cap = useApp((s) => s.capture);
  const name = useApp((s) => s.captureName);
  const busy = useApp((s) => s.busy);
  const host = useApp((s) => s.host);
  const preset = useApp((s) => s.preset);
  const [over, setOver] = useState(false);
  const src = useMemo(() => (cap ? toDataUrl(cap.view) : ""), [cap]);
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div
      className="stage rise cq"
      onDragOver={(e) => {
        if (![...e.dataTransfer.types].includes("Files")) return;
        e.preventDefault();
        if (!over) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = [...e.dataTransfer.files].find((x) => x.type.startsWith("image/"));
        if (f) void useFile(f);
      }}
    >
      <input ref={fileRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={(e) => e.target.files?.[0] && void useFile(e.target.files[0])} />
      {cap ? (
        <>
          <img className="blur" src={src} alt="" aria-hidden="true" />
          <FitFrame src={src} />
          <div className="chips tl">
            <span className="chip-img" title={`${preset.projectType} view`}>
              <Icon name="check" size={14} style={{ color: "var(--ok)" }} />
              <span className="lbl-md" style={{ textTransform: "capitalize" }}>{preset.projectType}</span>
            </span>
            <span className="chip-img" title="Geometry locked: the look changes materials and mood only">
              <Icon name="lock" size={14} style={{ color: "var(--accent)" }} />
              <span className="lbl-lg">Geometry locked</span>
            </span>
          </div>
          <div className="chips tr">
            <FrameRow />
          </div>
          <div className="chips bl lbl-md">
            <div className="chip-img" style={{ flexDirection: "column", alignItems: "flex-start", gap: 0, borderRadius: 14 }}>
              <small style={{ opacity: 0.7, fontSize: 11.5 }}>Your view</small>
              <b style={{ fontWeight: 600, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis" }}>{name || "View"}</b>
            </div>
          </div>
          <div className="chips br">
            <button type="button" className="chip-img" aria-label="Paste from clipboard, Ctrl V" title="Paste · Ctrl V" onClick={() => void pasteFromClipboard()}>
              <span className="lbl-sm">Paste</span>
              <span className="kbd">Ctrl V</span>
            </button>
            <button type="button" className="chip-img" aria-label="Clear image" title="Clear image" onClick={clearView}>
              <Icon name="trash" size={15} />
              <span className="lbl-sm">Clear</span>
            </button>
            <button type="button" className="chip-img light" aria-label={host.kind === "sketchup" ? "Capture from SketchUp" : "Upload a file"} title={host.kind === "sketchup" ? "Capture from SketchUp" : "Upload a file"} onClick={() => (host.kind === "sketchup" ? void captureFromSketchUp() : fileRef.current?.click())}>
              <Icon name={host.kind === "sketchup" ? "camera" : "image"} size={15} />
              <span className="lbl-sm">{host.kind === "sketchup" ? "Capture from SketchUp" : "Upload"}</span>
            </button>
          </div>
        </>
      ) : (
        <div className={`drop breathe${over ? " over" : ""}`}>
          <div className="badge">
            <Icon name="image" size={30} stroke={1.8} className="spin-slow" />
          </div>
          <h2>Drop, paste or capture your view</h2>
          <p>
            Press <b className="kbd">Ctrl V</b> anywhere to paste a screenshot. SketchUp, CAD, a site photo or an iPad sketch all work.
          </p>
          <div className="row">
            <button type="button" className="btn primary sheen" onClick={() => void pasteFromClipboard()}>
              Paste from clipboard <span className="kbd" style={{ background: "color-mix(in srgb, var(--accent-ink) 14%, transparent)", color: "inherit" }}>Ctrl V</span>
            </button>
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}>Upload file</button>
            {host.kind === "sketchup" ? (
              <button type="button" className="btn" onClick={() => void captureFromSketchUp()}>
                <Icon name="camera" /> Capture from SketchUp
              </button>
            ) : null}
          </div>
        </div>
      )}
      {busy ? <Progress /> : null}
    </div>
  );
}

function FitFrame({ src }: { src: string }) {
  const frameId = useApp((s) => s.frameId);
  const cap = useApp((s) => s.capture);
  const f = findFrame(frameId);
  const nat = cap?.view.width && cap.view.height ? cap.view.width / cap.view.height : 4 / 3;
  const r = f.ratio || nat;
  const busy = useApp((s) => s.busy);
  return (
    <div className="fit">
      <div className="frame" style={{ width: `min(100cqw, 100cqh * ${r.toFixed(4)})`, aspectRatio: `${r}` }}>
        <img src={src} alt="Your view" />
        {busy ? <div className="scan" /> : null}
      </div>
    </div>
  );
}

function FrameRow() {
  const frameId = useApp((s) => s.frameId);
  const portrait = useApp((s) => s.portrait);
  const res = useApp((s) => s.settings.kieResolution);
  const cap = useApp((s) => s.capture);
  const row = FRAME_ROW.map((id) => (portrait ? swapFrameId(id) : id));
  const f = findFrame(frameId);
  const r = f.ratio || (cap?.view.width && cap.view.height ? cap.view.width / cap.view.height : 4 / 3);
  const long = res === "4K" ? 4096 : res === "1K" ? 1024 : 2048;
  const out = r >= 1 ? [long, Math.round(long / r)] : [Math.round(long * r), long];
  return (
    <div className="seg-img" role="group" aria-label="Frame">
      {row.map((id) => {
        const fr = findFrame(id);
        const rr = fr.ratio || 4 / 3;
        const m = Math.max(rr, 1);
        return (
          <button key={id} type="button" aria-pressed={frameId === id} title={fr.hint} onClick={() => pickFrame(id)}>
            <span className="shape" aria-hidden="true">
              <i style={{ width: (12 * rr) / m, height: 12 / m }} />
            </span>
            {fr.label}
          </button>
        );
      })}
      <button
        type="button"
        className="swap"
        aria-label="Swap portrait and landscape"
        aria-pressed={portrait}
        title={portrait ? "Show landscape frames" : "Show portrait frames"}
        onClick={() => {
          const id = getState().frameId;
          setState({ portrait: !portrait });
          const flipped = swapFrameId(id);
          if (flipped !== id) pickFrame(flipped);
        }}
      >
        <Icon name="swap" style={{ transition: "transform 350ms", transform: portrait ? "rotate(90deg)" : "none" }} />
      </button>
      <span className="size num lbl-md">
        {res} · {out[0]} × {out[1]} px
      </span>
    </div>
  );
}

export function Progress() {
  const busy = useApp((s) => s.busy)!;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, []);
  const el = Math.max(0, Math.floor((now - busy.since) / 1000));
  const left = Math.max(0, Math.round(busy.typical / 1000 - el));
  return (
    <div className="busy-chip" role="status" aria-live="polite" title={left > 0 ? `About ${left} s left` : "Almost done"}>
      <Icon name="aperture" className="spin-slow" size={15} />
      <span className="num">{busy.label} · {Math.floor(el / 60)}:{String(el % 60).padStart(2, "0")}</span>
      <button type="button" aria-label="Cancel render" title="Cancel" onClick={() => void import("../actions").then((a) => a.cancelRender())}>
        <Icon name="close" size={13} />
      </button>
    </div>
  );
}

// ---------- right: settings ----------

function RenderSide() {
  const s = useApp((x) => x.settings);
  const preset = useApp((x) => x.preset);
  const busy = useApp((x) => x.busy);
  const cap = useApp((x) => x.capture);
  const cost = renderCost(s);
  const promptOnly = s.backend === "browser" && !s.testMode;
  return (
    <>
      <div className="side-scroll thin">
        <div>
          <h1 className="hero">Make it real.</h1>
          <p className="sub">Pick a look. Your design stays exactly as modelled.</p>
        </div>
        <section className="step">
          <div className="step-head">
            <span className="n">1</span>
            <h2>Scene</h2>
          </div>
          <div className="chips-row" role="radiogroup" aria-label="Scene type">
            {TYPES.map(([id, label]) => (
              <button
                key={id}
                type="button"
                className="chip"
                role="radio"
                aria-checked={preset.projectType === id}
                onClick={() => {
                  if (preset.projectType === id) return;
                  const last = s.lastSetup?.[id]?.preset?.id;
                  setState({ preset: { ...lookPreset(last ?? STARTERS[id][0]), lighting: preset.lighting, environment: id === "interior" ? "keep" : preset.environment } });
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </section>
        <Looks />
        <Light />
        <Environment />
        <AdditionalNotes />
        <Advanced />
      </div>
      <div className="side-foot">
        <ModelPicker />
        <button type="button" className="cta sheen" disabled={(!cap && !promptOnly) || Boolean(busy)} onClick={() => void openReview()}>
          <Icon name={promptOnly ? "clipboard" : "aperture"} size={18} className={promptOnly ? undefined : "spin-slow"} />
          {busy ? "Rendering…" : promptOnly ? "Get prompt · free" : `Render · ${cost.label}`}
          <span className="kbd">R</span>
        </button>
      </div>
    </>
  );
}

function Looks() {
  const preset = useApp((s) => s.preset);
  const favorites = useApp((s) => s.settings.favorites);
  const type = preset.projectType;
  const ids = [...favorites.filter((id) => findLibraryItem(id)?.projectType === type), ...STARTERS[type]].filter((id, i, a) => a.indexOf(id) === i).slice(0, 6);
  if (!ids.includes(preset.id) && findLibraryItem(preset.id)) ids.unshift(preset.id);
  const suggestion = suggest(preset.id);
  return (
    <section className="step">
      <div className="step-head">
        <span className="n">2</span>
        <h2>Look</h2>
        <button type="button" className="linkish end" onClick={() => setState({ libOpen: "look" })}>Browse all</button>
      </div>
      <div className="looks">
        {ids.slice(0, 6).map((id) => {
          const it = findLibraryItem(id)!;
          const img = previewFile(id);
          const on = preset.id === id;
          const fav = favorites.includes(id);
          return (
            <div key={id} style={{ position: "relative" }}>
              <button
                type="button"
                className="look lift"
                aria-pressed={on}
                title={splitTypology(it.style).style}
                style={{ width: "100%" }}
                onClick={() => setState((s) => ({ preset: { ...lookPreset(id), lighting: s.preset.lighting, environment: s.preset.environment } }))}
              >
                {img ? <img src={img} alt="" loading="lazy" /> : <span className="noimg">{it.name}</span>}
                <span className="name">{it.name}</span>
                {on ? (
                  <span className="tick">
                    <Icon name="check" size={12} stroke={3.2} />
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                className={`look-star${fav ? " on" : ""}`}
                aria-label={fav ? `Unstar ${it.name}` : `Star ${it.name}`}
                aria-pressed={fav}
                title={fav ? "Starred: shown first" : "Star: show first"}
                style={{ position: "absolute", top: 6, left: 6, width: 26, height: 26, borderRadius: "50%", border: 0, background: "rgba(10,8,6,0.55)", color: fav ? "#ffd27a" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                onClick={() => void updateSettings({ favorites: fav ? favorites.filter((x) => x !== id) : [id, ...favorites] })}
              >
                <Icon name="star" size={13} />
              </button>
            </div>
          );
        })}
      </div>
      {suggestion ? (
        <div className="note" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ flex: 1 }}>This look suggests {suggestion.text}.</span>
          <button type="button" className="chip" style={{ padding: "6px 12px" }} onClick={suggestion.apply}>Use</button>
        </div>
      ) : null}
    </section>
  );
}

/** What the look would have changed (audit H-03): offered, never applied silently. */
function suggest(id: string): { text: string; apply: () => void } | null {
  const it = findLibraryItem(id);
  if (!it) return null;
  const st = getState();
  const parts: string[] = [];
  const currentLight = st.lighting === "time" ? `time:${Math.floor(st.hour)}:${String(Math.round((st.hour % 1) * 60)).padStart(2, "0")}` : st.lighting;
  const wantsLight = it.lighting && it.lighting !== currentLight;
  const wantsPlace = it.environment && it.environment !== st.preset.environment && it.environment !== "keep";
  if (wantsLight) {
    const dial = parseDialTime(it.lighting);
    parts.push(dial !== null ? `light at ${fmtHour(dial)}` : (findOption(LIGHTING, it.lighting)?.label ?? it.lighting).toLowerCase());
  }
  if (wantsPlace) parts.push(parseContexts(it.environment).map(contextLabel).join(" + "));
  if (!parts.length) return null;
  return {
    text: parts.join(" and "),
    apply: () => {
      const dial = parseDialTime(it.lighting);
      setState((s) => ({
        ...(wantsLight ? (dial !== null ? { lighting: "time", hour: dial } : { lighting: it.lighting }) : {}),
        preset: { ...s.preset, environment: wantsPlace ? it.environment : s.preset.environment },
      }));
    },
  };
}

const CARDS: { id: string; label: string; sub: string; hour?: number; sky: [string, string] }[] = [
  { id: "morning", label: "Morning", sub: "07:00 · soft east", hour: 7, sky: ["#5f9bd6", "#f3d6a6"] },
  { id: "noon", label: "Midday", sub: "12:00 · crisp", hour: 12, sky: ["#2f86d8", "#bfe0f6"] },
  { id: "afternoon", label: "Afternoon", sub: "16:30 · warm west", hour: 16.5, sky: ["#4a88c7", "#f2c98d"] },
  { id: "blue-hour", label: "Blue hour", sub: "18:45 · lights on", hour: 18.75, sky: ["#101a3d", "#3d5a99"] },
  { id: "overcast", label: "Monsoon", sub: "Overcast, wet", sky: ["#5d6b74", "#9aa7ad"] },
  { id: "night", label: "Night", sub: "Lights only", sky: ["#05070f", "#1b2036"] },
];

function Light() {
  const hour = useApp((s) => s.hour);
  const lighting = useApp((s) => s.lighting);
  const facts = useApp((s) => s.capture?.facts);
  const exact = useApp((s) => s.sun.exact);
  const caption = useApp(() => lightCaption());
  const cards = facts?.shadowTime ? [{ id: "sketchup", label: "SketchUp sun", sub: "From your model", sky: ["#5a5f8a", "#f0a050"] as [string, string] }, ...CARDS] : CARDS;
  return (
    <section className="step cq">
      <div className="step-head">
        <span className="n">3</span>
        <h2>Light</h2>
        <button type="button" className="linkish end" onClick={() => setState({ tab: "sun" })}>
          {exact ? "Exact direction on" : "Set exact direction"}
        </button>
      </div>
      <div className="lightwrap">
        <div className="dialcol">
          <SunDial hour={hour} onHour={(h) => setState({ hour: h, lighting: "time" })} />
          <p className="caption">{caption}</p>
        </div>
        <div className="lightcards">
          {cards.map((c) => {
            const on = lighting === c.id || (lighting === "time" && c.hour !== undefined && Math.abs(hour - c.hour) < 0.01);
            return (
              <button key={c.id} type="button" className="lightcard" aria-pressed={on} onClick={() => setState(c.hour !== undefined ? { hour: c.hour, lighting: "time" } : { lighting: c.id })}>
                <span className="sky" style={{ background: `linear-gradient(180deg, ${c.sky[0]}, ${c.sky[1]})` }} />
                <b>{c.label}</b>
                <small>{c.sub}</small>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Environment() {
  const preset = useApp((s) => s.preset);
  const picks = parseContexts(preset.environment);
  const opts = [...PLACES[preset.projectType], ...picks.filter((p) => !PLACES[preset.projectType].includes(p))];
  const toggle = (id: string) => {
    const next = picks.includes(id) ? picks.filter((x) => x !== id) : [...picks, id];
    setState((s) => ({ preset: { ...s.preset, environment: joinContexts(next) } }));
  };
  return (
    <section className="step">
      <div className="step-head">
        <span className="n">4</span>
        <h2>Environment</h2>
        <button type="button" className="linkish end" onClick={() => setState({ libOpen: "env" })}>Browse all</button>
      </div>
      <div className="chips-row">
        {opts.map((id) => (
          <button key={id} type="button" className="chip" aria-pressed={picks.includes(id)} onClick={() => toggle(id)}>
            {contextLabel(id)}
          </button>
        ))}
        <button type="button" className="chip" aria-pressed={picks.length === 0} onClick={() => setState((s) => ({ preset: { ...s.preset, environment: "keep" } }))}>
          As modelled
        </button>
      </div>
    </section>
  );
}

function AdditionalNotes() {
  const notes = useApp((s) => s.notes);
  const picked = useApp((s) => s.noteChips);
  const colour = useApp((s) => s.glassColour);
  const [custom, setCustom] = useState<NotePreset[]>(() => loadCustomNotes());
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [label, setLabel] = useState("");
  const toggle = (id: string) => setState((s) => ({ noteChips: s.noteChips.includes(id) ? s.noteChips.filter((x) => x !== id) : [...s.noteChips, id] }));
  const add = () => {
    const t = text.trim();
    if (!t) return;
    const n: NotePreset = { id: `my-${Date.now().toString(36)}`, label: label.trim() || labelFor(t), text: /[.!?]$/.test(t) ? t : `${t}.`, custom: true };
    const next = [...custom, n];
    setCustom(next);
    saveCustomNotes(next);
    setState((s) => ({ noteChips: [...s.noteChips, n.id] }));
    setText("");
    setLabel("");
    setAdding(false);
  };
  const remove = (id: string) => {
    const next = custom.filter((x) => x.id !== id);
    setCustom(next);
    saveCustomNotes(next);
    setState((s) => ({ noteChips: s.noteChips.filter((x) => x !== id) }));
  };
  return (
    <section className="step">
      <div className="step-head">
        <span className="n">5</span>
        <h2>Additional Notes</h2>
      </div>
      <div className="chips-row">
        {BUILT_IN_NOTES.map((n) =>
          n.id === "glass" ? (
            <span key={n.id} className="chip split" aria-pressed={picked.includes(n.id)}>
              <button type="button" aria-pressed={picked.includes(n.id)} onClick={() => toggle(n.id)} title={n.text.split("{colour}").join(colour)}>
                Change
              </button>
              <select aria-label="Colour to turn into glass" value={colour} onChange={(e) => setState((s) => ({ glassColour: e.target.value, noteChips: s.noteChips.includes("glass") ? s.noteChips : [...s.noteChips, "glass"] }))}>
                {GLASS_COLOURS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
              <button type="button" aria-pressed={picked.includes(n.id)} onClick={() => toggle(n.id)} tabIndex={-1}>to glass</button>
            </span>
          ) : (
            <button key={n.id} type="button" className="chip" aria-pressed={picked.includes(n.id)} title={n.text} onClick={() => toggle(n.id)}>
              {n.label}
            </button>
          ),
        )}
        {custom.map((n) => (
          <span key={n.id} className="chip mine" aria-pressed={picked.includes(n.id)}>
            <button type="button" aria-pressed={picked.includes(n.id)} title={n.text} onClick={() => toggle(n.id)}>{n.label}</button>
            <button type="button" className="x" aria-label={`Delete ${n.label}`} title="Delete" onClick={() => remove(n.id)}>
              <Icon name="close" size={12} />
            </button>
          </span>
        ))}
        <button type="button" className="chip add" aria-label="Add your own note preset" aria-expanded={adding} title="Add your own" onClick={() => setAdding(!adding)}>
          <Icon name="plus" size={14} />
        </button>
      </div>
      {adding ? (
        <div className="addnote">
          <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Button name, e.g. Red to brick" aria-label="Button name" />
          <textarea className="input" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Sentence for the prompt, e.g. Turn the red solid colors into red clay brick." aria-label="Prompt sentence" />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" className="btn ghost" onClick={() => setAdding(false)}>Cancel</button>
            <button type="button" className="btn primary" disabled={!text.trim()} onClick={add}>Save button</button>
          </div>
        </div>
      ) : null}
      <textarea id="notes" className="input" rows={2} aria-label="Anything else" value={notes} placeholder="Anything else, in English or Khmer, e.g. two motorbikes by the gate" onChange={(e) => setState({ notes: e.target.value })} />
    </section>
  );
}

function Advanced() {
  const open = useApp((s) => s.advancedOpen);
  const s = useApp((x) => x.settings);
  const exact = useApp((x) => x.sun.exact);
  const on = GENERATORS.filter((g) => countSet(s.dynamic[g.id]) > 0).length + (exact ? 1 : 0) + (s.look === "cgi" ? 1 : 0);
  return (
    <section className={`adv${open ? " open" : ""}`}>
      <button type="button" className="adv-head" aria-expanded={open} onClick={() => setState({ advancedOpen: !open })}>
        <span className="adv-ic"><Icon name="sliders" size={18} /></span>
        <span style={{ flex: 1, textAlign: "left" }}>
          <b>Advanced</b>
          <small>{GENERATORS.length} dynamic prompts, sun direction, photo or 3D look</small>
        </span>
        {on ? <span className="adv-count num">{on} on</span> : null}
        <Icon name="chevron" size={16} style={{ transition: "transform 200ms var(--ease)", transform: open ? "rotate(180deg)" : "none" }} />
      </button>
      {open ? (
        <div className="adv-body">
          <div className="dyn-grid">
            {GENERATORS.map((g) => {
              const n = countSet(s.dynamic[g.id]);
              return (
                <button key={g.id} type="button" className="dyn-card lift" aria-pressed={n > 0} onClick={() => setState({ dynOpen: g.id })}>
                  <Icon name={DYN_ICONS[g.id] ?? "sliders"} size={18} />
                  <b>{g.name}</b>
                  <small>{n ? `${n} set` : g.blurb}</small>
                </button>
              );
            })}
          </div>
          {GENERATORS.some((g) => countSet(s.dynamic[g.id]) > 0) ? (
            <button type="button" className="linkish" style={{ alignSelf: "flex-start" }} onClick={() => void updateSettings({ dynamic: {} })}>Clear all dynamic prompts</button>
          ) : null}
          <label className="fontopt" style={{ cursor: "pointer" }}>
            <input type="checkbox" checked={exact} onChange={(e) => setState((x) => ({ sun: { ...x.sun, exact: e.target.checked } }))} style={{ accentColor: "var(--accent)" }} />
            <span style={{ flex: 1, textAlign: "left" }}>Use the exact sun direction from the Sun screen</span>
          </label>
          <div className="tabs2" role="radiogroup" aria-label="Output look">
            <button type="button" role="radio" aria-checked={s.look === "photo"} onClick={() => void updateSettings({ look: "photo" })}>Photo</button>
            <button type="button" role="radio" aria-checked={s.look === "cgi"} onClick={() => void updateSettings({ look: "cgi" })}>3D render</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
