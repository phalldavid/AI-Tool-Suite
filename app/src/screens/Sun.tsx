// Exact sun: a top-down ring measured from the camera, plus a height arc.
// Only the dragged marker moves during a drag; labels change 5° past each boundary.

import { Foot } from "../ui/PhoneBar";
import { useMemo, useRef } from "react";
import { getState, setState, useApp } from "../store";
import { sunNow } from "../actions";
import { toDataUrl } from "../core/images";
import { FALL_SHORT, FROM_SHORT, compass, heightWord, sector, sunPromptLine } from "../lib/sun";
import { Panels } from "../ui/Panels";
import { Icon } from "../ui/Icon";
import { fmtHour } from "./SunDial";

const CX = 160;
const CY = 160;
const R = 120;
const rad = Math.PI / 180;
let lastSector: number | null = null;

const DATES: [number, string][] = [
  [80, "21 Mar"],
  [172, "21 Jun"],
  [264, "21 Sep"],
  [355, "21 Dec"],
];
const TIMES = [7, 9, 12, 15, 16.5, 17.5];

export function SunScreen() {
  return <Panels label="sun" work={<SunWork />} side={<SunSide />} />;
}

function useSun() {
  useApp((s) => s.sun);
  useApp((s) => s.hour);
  const live = sunNow();
  const sect = sector(live.toCamera, lastSector);
  lastSector = sect;
  return { live, sect };
}

function SunWork() {
  const cap = useApp((s) => s.capture);
  const { live, sect } = useSun();
  const src = useMemo(() => (cap ? toDataUrl(cap.view) : ""), [cap]);
  const el = Math.max(0, live.elevation);
  const th = live.toCamera;
  const lit = Math.cos(th * rad) < 0;
  const glowX = 50 + Math.sin(th * rad) * 55;
  const glowY = Math.max(-10, 45 - el * 0.9);
  const glowA = live.elevation < 0 ? 0 : lit ? 0.18 : 0.45;
  const g = gizmo(th, el);
  return (
    <>
      <div className="stage rise">
        {src ? <img src={src} alt="Your view" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : <div className="empty" style={{ position: "absolute", inset: 0, justifyContent: "center" }}>Add a view on the Render screen to see it here.</div>}
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", mixBlendMode: "screen", background: `radial-gradient(circle at ${glowX.toFixed(0)}% ${glowY.toFixed(0)}%, rgba(255,190,110,${glowA}), transparent 55%)` }} />
        <div className="gizmo glass">
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 600 }}>
            Shadow preview
            <span style={{ marginLeft: "auto", width: 120, textAlign: "right", whiteSpace: "nowrap", color: "var(--muted)", fontWeight: 500 }}>{heightWord(live.elevation)}</span>
          </div>
          <svg viewBox="0 0 240 150" style={{ width: "100%", height: "auto", display: "block", marginTop: 6 }} role="img" aria-label={`Shadows fall ${FALL_SHORT[(sect + 4) % 8]}`}>
            <ellipse cx="120" cy="104" rx="112" ry="40" fill="rgba(143,178,122,0.28)" stroke="rgba(255,255,255,0.18)" />
            <polygon points={g.boxShadow} fill="rgba(0,0,0,0.55)" />
            <line x1="170" y1="100" x2={g.poleX} y2={g.poleY} stroke="rgba(0,0,0,0.55)" strokeWidth="5" strokeLinecap="round" />
            <polygon points={g.front} fill={lit ? "#e8e1d7" : "#8a8178"} />
            <polygon points={g.top} fill="#f3eee7" />
            <line x1="170" y1="100" x2="170" y2="56" stroke="#f3eee7" strokeWidth="4" strokeLinecap="round" />
            <circle cx={g.sunX} cy={g.sunY} r="9" fill="#ffd27a" opacity={lit ? 0.35 : 1} />
            <text x="120" y="146" textAnchor="middle" fontSize="10" style={{ fill: "var(--muted)" }} >camera ↑ looks into the scene</text>
          </svg>
        </div>
        <div className="chip-img" style={{ position: "absolute", right: 16, top: 16, width: 280, overflow: "hidden" }}>
          <span className="glow" style={{ flex: "none", width: 10, height: 10, borderRadius: "50%", background: "#ffd27a", boxShadow: "0 0 12px #ffd27a" }} />
          <span className="num" style={{ minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {live.elevation < 0 ? "Sun below the horizon" : `Light: ${FROM_SHORT[sect]} · ${Math.round(live.elevation)}°`}
          </span>
        </div>
      </div>
      <div className="prompt-box glass">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h2 style={{ fontSize: 14 }}>Added to your prompt</h2>
          <span className="lbl-md" style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)" }}>Numbers and plain words, so the model follows it</span>
        </div>
        <p className="mono num">{sunPromptLine(live, sect)}</p>
      </div>
    </>
  );
}

function gizmo(th: number, el: number) {
  const phis = (th + 180) * rad;
  const len = (h: number) => Math.min(110, h / Math.tan(Math.max(4, el) * rad));
  const proj = (L: number): [number, number] => [Math.sin(phis) * L, -Math.cos(phis) * L * 0.5];
  const [pdx, pdy] = proj(len(44));
  const bx = 82, by = 104, bw = 20, bd = 10, bh = 30;
  const foot: [number, number][] = [[bx - bw, by - bd], [bx + bw, by - bd], [bx + bw, by + bd], [bx - bw, by + bd]];
  const [sdx, sdy] = proj(len(bh));
  const pts = foot.concat(foot.map(([x, y]) => [x + sdx, y + sdy] as [number, number]));
  const ps = (P: [number, number][]) => P.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return {
    boxShadow: ps(hull(pts)),
    poleX: 170 + pdx,
    poleY: 100 + pdy,
    front: ps([[bx - bw, by + bd], [bx + bw, by + bd], [bx + bw, by + bd - bh], [bx - bw, by + bd - bh]]),
    top: ps(foot.map(([x, y]) => [x, y - bh] as [number, number])),
    sunX: 120 + Math.sin(th * rad) * 100,
    sunY: 52 - Math.cos(th * rad) * 18 - el * 0.35,
  };
}

function hull(P: [number, number][]): [number, number][] {
  const p = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: [number, number][] = [];
  const up: [number, number][] = [];
  for (const q of p) {
    while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
    lo.push(q);
  }
  for (const q of p.slice().reverse()) {
    while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop();
    up.push(q);
  }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

function SunSide() {
  const sun = useApp((s) => s.sun);
  const hour = useApp((s) => s.hour);
  const facts = useApp((s) => s.capture?.facts);
  const { live, sect } = useSun();
  const drag = useRef<null | "sun" | "north" | "arc">(null);
  const raf = useRef(0);
  const el = Math.max(0, live.elevation);
  const r = R * Math.cos(el * rad);
  const sunX = CX + r * Math.sin(live.toCamera * rad);
  const sunY = CY - r * Math.cos(live.toCamera * rad);
  const nX = CX + R * Math.sin(sun.north * rad);
  const nY = CY - R * Math.cos(sun.north * rad);
  const ticks = useMemo(() => {
    let d = "";
    for (let a = 0; a < 360; a += 15) {
      const l = a % 90 === 0 ? 12 : 6;
      d += `M${(CX + R * Math.sin(a * rad)).toFixed(1)} ${(CY - R * Math.cos(a * rad)).toFixed(1)}L${(CX + (R - l) * Math.sin(a * rad)).toFixed(1)} ${(CY - (R - l) * Math.cos(a * rad)).toFixed(1)}`;
    }
    return d;
  }, []);
  const ax = 150 + 100 * Math.cos(el * rad);
  const ay = 112 - 100 * Math.sin(el * rad);
  const setSun = (patch: Partial<typeof sun>) => setState((s) => ({ sun: { ...s.sun, ...patch } }));
  const toFree = (patch: Partial<typeof sun>) => {
    const cur = sunNow();
    setSun({ mode: "free", toCamera: Math.round(cur.toCamera), elevation: Math.round(Math.max(0, cur.elevation)), ...patch });
  };
  const ring = (e: React.PointerEvent<SVGSVGElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - b.left) / b.width) * 320;
    const y = ((e.clientY - b.top) / b.height) * 320;
    const step = e.shiftKey ? 1 : 5;
    const a = (((Math.round(((Math.atan2(x - CX, CY - y) / rad + 360) % 360) / step) * step) % 360) + 360) % 360;
    return { x, y, a, d: Math.hypot(x - CX, y - CY) };
  };
  const arcAt = (e: React.PointerEvent<SVGSVGElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - b.left) / b.width) * 320;
    const y = ((e.clientY - b.top) / b.height) * 130;
    return Math.round(Math.max(0, Math.min(90, Math.atan2(112 - y, x - 150) / rad)));
  };
  const frame = (fn: () => void) => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(fn);
  };
  const end = () => {
    if (drag.current && drag.current !== "north" && getState().sun.mode === "time") toFree({});
    drag.current = null;
    setState({ dragging: false });
  };
  return (
    <>
      <div style={{ flex: "none", padding: "18px 20px 0", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button type="button" className="icon-btn" aria-label="Back to Render" onClick={() => setState({ tab: "render" })}>
            <Icon name="back" />
          </button>
          <h1 style={{ fontSize: 22 }}>Sun direction</h1>
        </div>
        <div className="tabs3" role="tablist" aria-label="How to set the sun">
          {(["time", "free", "sketchup"] as const).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={sun.mode === m} onClick={() => (m === "free" ? toFree({}) : setSun({ mode: m }))}>
              {m === "time" ? "Time" : m === "free" ? "Free" : "SketchUp"}
            </button>
          ))}
        </div>
        <p style={{ margin: 0, height: 36, overflow: "hidden", fontSize: 12.5, lineHeight: 1.45, color: "var(--muted)" }}>
          {sun.mode === "time" ? "Pick a date and time. Set north once and the sun is calculated for Phnom Penh." : sun.mode === "free" ? "Grab the sun to turn it. Use the Height arc to raise or lower it." : facts?.sunToCameraDeg !== undefined ? "Read from your SketchUp model: camera, north and shadow time." : "Capture from SketchUp to read the sun from the model."}
        </p>
      </div>
      <div className="side-scroll thin" style={{ gap: 18 }}>
        <section className="step">
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <h2 style={{ fontSize: 16 }}>Direction</h2>
            <span style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--muted)" }}>Drag the sun · drag N to set north</span>
          </div>
          <svg
            className="ring"
            viewBox="0 0 320 320"
            role="slider"
            tabIndex={0}
            aria-label="Sun direction around the camera. Arrow keys turn 5 degrees, Shift for 1"
            aria-valuemin={0}
            aria-valuemax={359}
            aria-valuenow={Math.round(live.toCamera)}
            aria-valuetext={`${FROM_SHORT[sect]}, ${Math.round(live.elevation)} degrees high`}
            onPointerDown={(e) => {
              if (sun.mode === "sketchup") return;
              const p = ring(e);
              if (Math.hypot(p.x - nX, p.y - nY) < 22) drag.current = "north";
              else if (Math.hypot(p.x - sunX, p.y - sunY) < 26 || (p.d >= 40 && p.d <= 152)) {
                drag.current = "sun";
                if (sun.mode !== "time") setSun({ toCamera: p.a });
              } else return;
              e.currentTarget.setPointerCapture(e.pointerId);
              setState({ dragging: true });
            }}
            onPointerMove={(e) => {
              if (drag.current !== "sun" && drag.current !== "north") return;
              const p = ring(e);
              if (p.d < 24) return;
              const kind = drag.current;
              frame(() => {
                if (kind === "north") setSun({ north: p.a });
                else if (getState().sun.mode === "time") toFree({ toCamera: p.a });
                else setSun({ toCamera: p.a });
              });
            }}
            onPointerUp={end}
            onPointerCancel={end}
            onKeyDown={(e) => {
              const step = e.shiftKey ? 1 : 5;
              const d = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
              if (!d || sun.mode === "sketchup") return;
              e.preventDefault();
              toFree({ toCamera: (Math.round(live.toCamera) + d + 360) % 360 });
            }}
          >
            <circle cx="160" cy="160" r="150" style={{ fill: "var(--well)" }} />
            <g className="spin-slow" style={{ transformOrigin: "160px 160px" }}>
              <circle cx="160" cy="160" r="142" fill="none" strokeDasharray="2 10" style={{ stroke: "color-mix(in srgb, var(--accent) 30%, transparent)" }} />
            </g>
            <circle cx="160" cy="160" r="120" fill="none" strokeWidth="1.5" style={{ stroke: "var(--line2)" }} />
            <circle cx="160" cy="160" r="80" fill="none" strokeDasharray="3 6" style={{ stroke: "var(--line)" }} />
            <circle cx="160" cy="160" r="40" fill="none" strokeDasharray="3 6" style={{ stroke: "var(--line)" }} />
            <path d={ticks} strokeWidth="1.5" style={{ stroke: "var(--line3)" }} />
            <text x="160" y="26" textAnchor="middle" fontSize="11" style={{ fill: "var(--muted)" }} >Ahead</text>
            <text x="300" y="164" textAnchor="end" fontSize="11" style={{ fill: "var(--muted)" }} >Right</text>
            <text x="160" y="304" textAnchor="middle" fontSize="11" style={{ fill: "var(--muted)" }} >Behind you</text>
            <text x="20" y="164" fontSize="11" style={{ fill: "var(--muted)" }} >Left</text>
            <polygon points="160,236 128,176 192,176" style={{ fill: "color-mix(in srgb, var(--accent) 10%, transparent)", stroke: "color-mix(in srgb, var(--accent) 35%, transparent)" }} />
            <rect x="144" y="144" width="32" height="32" rx="4" style={{ fill: "var(--line2)", stroke: "var(--soft)" }} />
            <g transform="translate(160 236)">
              <rect x="-11" y="-7" width="22" height="15" rx="3" style={{ fill: "var(--text)" }} />
              <circle cx="0" cy="0.5" r="4" style={{ fill: "var(--panel)" }} />
            </g>
            <line x1={sunX} y1={sunY} x2="160" y2="160" strokeWidth="2" strokeDasharray="5 5" style={{ stroke: "var(--accent)" }} />
            <g transform={`translate(${nX} ${nY})`} style={{ cursor: "grab" }}>
              <circle r="13" style={{ fill: "var(--raised)", stroke: "var(--soft)" }} />
              <text y="4" textAnchor="middle" fontSize="12" fontWeight="700" style={{ fill: "var(--text)" }} >N</text>
            </g>
            <circle cx={sunX} cy={sunY} r="26" fill="#ffb347" opacity="0.22" className="glow" />
            <circle cx={sunX} cy={sunY} r="11" fill="#ffd27a" style={{ filter: "drop-shadow(0 0 8px rgba(255,200,120,0.95))" }} />
          </svg>
        </section>
        <section className="step">
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <h2 style={{ fontSize: 16 }}>Height</h2>
            <span className="num" style={{ marginLeft: "auto", width: 170, textAlign: "right", whiteSpace: "nowrap", fontWeight: 600, color: "var(--accent-text)" }}>
              {Math.round(live.elevation)}° · {heightWord(live.elevation)}
            </span>
          </div>
          <svg
            className="ring"
            viewBox="0 0 320 130"
            role="slider"
            tabIndex={0}
            aria-label="Sun height above the horizon"
            aria-valuemin={0}
            aria-valuemax={90}
            aria-valuenow={Math.round(live.elevation)}
            style={{ borderRadius: 14, background: "var(--well)" }}
            onPointerDown={(e) => {
              if (sun.mode === "sketchup") return;
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = "arc";
              setState({ dragging: true });
              toFree({ elevation: arcAt(e) });
            }}
            onPointerMove={(e) => {
              if (drag.current !== "arc") return;
              const v = arcAt(e);
              frame(() => setSun({ elevation: v }));
            }}
            onPointerUp={end}
            onPointerCancel={end}
            onKeyDown={(e) => {
              const step = e.shiftKey ? 10 : 1;
              const d = e.key === "ArrowDown" || e.key === "ArrowLeft" ? -step : e.key === "ArrowUp" || e.key === "ArrowRight" ? step : 0;
              if (!d || sun.mode === "sketchup") return;
              e.preventDefault();
              toFree({ elevation: Math.max(0, Math.min(90, Math.round(el) + d)) });
            }}
          >
            <line x1="20" y1="112" x2="300" y2="112" strokeWidth="1.5" style={{ stroke: "var(--line3)" }} />
            <path d="M 250 112 A 100 100 0 0 0 150 12" fill="none" strokeWidth="1.5" strokeDasharray="4 6" style={{ stroke: "var(--line2)" }} />
            <path d={`M 250 112 A 100 100 0 0 0 ${ax.toFixed(1)} ${ay.toFixed(1)}`} fill="none" strokeWidth="3" strokeLinecap="round" style={{ stroke: "var(--accent)" }} />
            <rect x="134" y="84" width="32" height="28" style={{ fill: "var(--line2)", stroke: "var(--soft)" }} />
            <line x1={ax} y1={ay} x2="150" y2="98" strokeDasharray="4 4" style={{ stroke: "var(--accent)" }} />
            <text x="256" y="108" fontSize="10.5" style={{ fill: "var(--muted)" }} >0°</text>
            <text x="236" y="56" fontSize="10.5" style={{ fill: "var(--muted)" }} >30°</text>
            <text x="196" y="22" fontSize="10.5" style={{ fill: "var(--muted)" }} >60°</text>
            <text x="156" y="10" fontSize="10.5" style={{ fill: "var(--muted)" }} >90°</text>
            <circle cx={ax} cy={ay} r="9" fill="#ffd27a" style={{ filter: "drop-shadow(0 0 6px rgba(255,200,120,0.95))" }} />
          </svg>
        </section>
        <section className="step" style={{ opacity: sun.mode === "time" ? 1 : 0.45, gap: 8 }}>
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <h2 style={{ fontSize: 16 }}>Date and time</h2>
            <span style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--muted)" }}>Phnom Penh 11.56°N</span>
          </div>
          <div className="chips-row">
            {DATES.map(([d, l]) => (
              <button key={d} type="button" className="chip" aria-pressed={sun.mode === "time" && sun.dayOfYear === d} onClick={() => setSun({ mode: "time", dayOfYear: d })}>{l}</button>
            ))}
            <button type="button" className="chip" aria-pressed={sun.mode === "time" && !DATES.some(([d]) => d === sun.dayOfYear)} onClick={() => setSun({ mode: "time", dayOfYear: todayDoy() })}>Today</button>
          </div>
          <div className="chips-row">
            {TIMES.map((h) => (
              <button key={h} type="button" className="chip num" aria-pressed={sun.mode === "time" && Math.abs(hour - h) < 0.01} onClick={() => { setSun({ mode: "time" }); setState({ hour: h, lighting: "time" }); }}>{fmtHour(h)}</button>
            ))}
          </div>
          <p style={{ margin: 0, height: 18, fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {sun.mode === "time" ? "The sun follows this date and the dial's time." : "Free mode. Pick a time to let the clock move the sun again."}
          </p>
        </section>
        <div className="readouts">
          <div><small>Light comes from</small><b>{FROM_SHORT[sect]}</b></div>
          <div><small>Height</small><b className="num">{Math.round(live.elevation)}° · {heightWord(live.elevation)}</b></div>
          <div><small>Compass bearing</small><b className="num">{live.bearing !== undefined ? `${Math.round(live.bearing)}° · ${compass(live.bearing)}` : "Set north"}</b></div>
          <div><small>Shadows fall</small><b>{FALL_SHORT[(sect + 4) % 8]}</b></div>
        </div>
      </div>
      <Foot>
        <button
          type="button"
          className="cta sheen"
          onClick={() => {
            setSun({ exact: true });
            setState({ tab: "render" });
          }}
        >
          Use this sun
        </button>
        {sun.exact ? (
          <button type="button" className="linkish" onClick={() => setSun({ exact: false })}>Stop using the exact direction</button>
        ) : null}
      </Foot>
    </>
  );
}

function todayDoy(): number {
  const d = new Date();
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 1)) / 86400000) + 1;
}
