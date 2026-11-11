// Move camera (Edit tab, New view): orbit, tilt, lens and distance around the building.

import { useMemo, useRef } from "react";
import { setState, useApp } from "../store";
import type { CameraMove } from "../lib/camera";
import { cameraHeight, fieldOfView, tiltWord } from "../lib/camera";

const CX = 160;
const CY = 160;
const R = 120;
const rad = Math.PI / 180;


function wire(m: CameraMove) {
  const p = m.tilt * rad;
  const y = m.orbit * rad;
  const D = m.distanceM;
  const pos = [D * Math.cos(p) * Math.sin(y), 1.6 + D * Math.sin(p), D * Math.cos(p) * Math.cos(y)];
  const tgt = [0, 3, 0];
  const sub = (a: number[], b: number[]) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const crs = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const nrm = (a: number[]) => {
    const l = Math.hypot(a[0], a[1], a[2]);
    return [a[0] / l, a[1] / l, a[2] / l];
  };
  const f = nrm(sub(tgt, pos));
  const r = nrm(crs(f, [0, 1, 0]));
  const u = crs(r, f);
  const foc = (m.lensMm / 36) * 400;
  const P = (q: number[]) => {
    const v = sub(q, pos);
    const z = Math.max(0.5, dot(v, f));
    return [200 + (dot(v, r) / z) * foc, 160 - (dot(v, u) / z) * foc];
  };
  const seg = (a: number[], b: number[]) => {
    const A = P(a);
    const B = P(b);
    return `M${A[0].toFixed(1)} ${A[1].toFixed(1)}L${B[0].toFixed(1)} ${B[1].toFixed(1)}`;
  };
  const w = 8, d = 5, h = 7;
  const v = [[-w, 0, -d], [w, 0, -d], [w, 0, d], [-w, 0, d], [-w, h, -d], [w, h, -d], [w, h, d], [-w, h, d]];
  const E = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
  const poly = (pts: number[][]) => pts.map((q, i) => { const Q = P(q); return `${i ? "L" : "M"}${Q[0].toFixed(1)} ${Q[1].toFixed(1)}`; }).join("") + "Z";
  let grid = "";
  for (let g = -20; g <= 20; g += 5) grid += seg([g, 0, -20], [g, 0, 20]) + seg([-20, 0, g], [20, 0, g]);
  return { edges: E.map(([a, b]) => seg(v[a], v[b])).join(""), front: poly([v[3], v[2], v[6], v[7]]), grid };
}

/** Wireframe of the building from the new camera. */
export function CameraPreview() {
  const cam = useApp((s) => s.camera);
  const w = useMemo(() => wire(cam), [cam]);
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet" role="img" aria-label={`Wireframe from the new camera: ${tiltWord(cam.tilt)}`}>
      <rect width="400" height="300" style={{ fill: "var(--field)" }} />
      <path d={w.grid} stroke="rgba(160,150,140,0.18)" strokeWidth="1" />
      <path d={w.edges} fill="none" style={{ stroke: "var(--soft)" }} strokeWidth="1.6" strokeLinejoin="round" />
      <path d={w.front} style={{ fill: "color-mix(in srgb, var(--accent) 14%, transparent)", stroke: "var(--accent)" }} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

/** Orbit ring, tilt arc, lens and distance. */
export function CameraControls() {
  const cam = useApp((s) => s.camera);
  const drag = useRef<null | "ring" | "arc">(null);
  const raf = useRef(0);
  const alpha = 180 - cam.orbit;
  const camX = CX + R * Math.sin(alpha * rad);
  const camY = CY - R * Math.cos(alpha * rad);
  const hfov = fieldOfView(cam.lensMm);
  const dir = Math.atan2(CY - camY, CX - camX);
  const L = 150;
  const c1 = [camX + L * Math.cos(dir - (hfov / 2) * rad), camY + L * Math.sin(dir - (hfov / 2) * rad)];
  const c2 = [camX + L * Math.cos(dir + (hfov / 2) * rad), camY + L * Math.sin(dir + (hfov / 2) * rad)];
  const tX = 170 - 110 * Math.cos(cam.tilt * rad);
  const tY = 120 - 110 * Math.sin(cam.tilt * rad);
  const set = (patch: Partial<CameraMove>) => setState((x) => ({ camera: { ...x.camera, ...patch } }));
  const frame = (fn: () => void) => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(fn);
  };
  const ringAt = (e: React.PointerEvent<SVGSVGElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - b.left) / b.width) * 320;
    const y = ((e.clientY - b.top) / b.height) * 320;
    const a = (Math.atan2(x - CX, CY - y) / rad + 360) % 360;
    const step = e.shiftKey ? 1 : 5;
    let o = Math.round((180 - a) / step) * step;
    if (o > 180) o -= 360;
    if (o < -180) o += 360;
    return { o, d: Math.hypot(x - CX, y - CY), x, y };
  };
  const tiltAt = (e: React.PointerEvent<SVGSVGElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - b.left) / b.width) * 320;
    const y = ((e.clientY - b.top) / b.height) * 140;
    return Math.round(Math.max(0, Math.min(85, (Math.atan2(120 - y, 170 - x) * 180) / Math.PI)));
  };
  const end = () => {
    drag.current = null;
    setState({ dragging: false });
  };
  const h = cameraHeight(cam);
  const side = cam.orbit === 0 ? "Same as master" : `${Math.abs(cam.orbit)}° to the ${cam.orbit > 0 ? "right" : "left"}`;
  const tiltShort = cam.tilt <= 5 ? "Eye level" : cam.tilt < 20 ? "Slightly up" : cam.tilt < 45 ? "Three-quarter" : cam.tilt < 75 ? "Aerial" : "Top-down";
  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <section className="step">
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <h2 style={{ fontSize: 16 }}>Orbit</h2>
            <span className="num" style={{ marginLeft: "auto", width: 170, textAlign: "right", whiteSpace: "nowrap", fontWeight: 600, color: "var(--accent-text)" }}>{side}</span>
          </div>
          <svg
            className="ring"
            viewBox="0 0 320 320"
            role="slider"
            tabIndex={0}
            aria-label="Camera position around the building. Arrow keys move 5 degrees, Shift for 1"
            aria-valuemin={-180}
            aria-valuemax={180}
            aria-valuenow={cam.orbit}
            aria-valuetext={side}
            onPointerDown={(e) => {
              const p = ringAt(e);
              if (!(Math.hypot(p.x - camX, p.y - camY) < 28 || (p.d >= 50 && p.d <= 152))) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = "ring";
              setState({ dragging: true });
              set({ orbit: p.o });
            }}
            onPointerMove={(e) => {
              if (drag.current !== "ring") return;
              const p = ringAt(e);
              if (p.d < 30) return;
              frame(() => set({ orbit: p.o }));
            }}
            onPointerUp={end}
            onPointerCancel={end}
            onKeyDown={(e) => {
              const st = e.shiftKey ? 1 : 5;
              const d = e.key === "ArrowLeft" ? -st : e.key === "ArrowRight" ? st : 0;
              if (!d) return;
              e.preventDefault();
              set({ orbit: Math.max(-180, Math.min(180, cam.orbit + d)) });
            }}
          >
            <circle cx="160" cy="160" r="150" style={{ fill: "var(--well)" }} />
            <g className="spin-slow" style={{ transformOrigin: "160px 160px" }}>
              <circle cx="160" cy="160" r="142" fill="none" stroke="rgba(63,111,115,0.45)" strokeDasharray="2 10" />
            </g>
            <circle cx="160" cy="160" r="120" fill="none" style={{ stroke: "var(--line2)" }} strokeWidth="1.5" />
            <polygon points={`${camX.toFixed(1)},${camY.toFixed(1)} ${c1.map((n) => n.toFixed(1)).join(",")} ${c2.map((n) => n.toFixed(1)).join(",")}`} style={{ fill: "color-mix(in srgb, var(--accent) 12%, transparent)", stroke: "color-mix(in srgb, var(--accent) 45%, transparent)" }} />
            <rect x="128" y="140" width="64" height="40" rx="4" style={{ fill: "var(--line2)", stroke: "var(--soft)" }} />
            <line x1="128" y1="180" x2="192" y2="180" style={{ stroke: "var(--accent)" }} strokeWidth="3" />
            <text x="160" y="26" textAnchor="middle" fontSize="11" style={{ fill: "var(--muted)" }}>Back</text>
            <text x="300" y="164" textAnchor="end" fontSize="11" style={{ fill: "var(--muted)" }}>Right</text>
            <text x="20" y="164" fontSize="11" style={{ fill: "var(--muted)" }}>Left</text>
            <g transform="translate(160 280)" opacity="0.45">
              <rect x="-10" y="-7" width="20" height="14" rx="3" style={{ fill: "var(--soft)" }} />
            </g>
            <text x="160" y="308" textAnchor="middle" fontSize="10.5" style={{ fill: "var(--muted)" }}>Master</text>
            <g transform={`translate(${camX} ${camY}) rotate(${alpha - 180})`}>
              <circle r="22" className="glow" style={{ fill: "var(--accent)" }} opacity="0.18" />
              <rect x="-12" y="-8" width="24" height="16" rx="3" style={{ fill: "var(--text)" }} />
              <circle r="4.5" style={{ fill: "var(--panel)" }} />
            </g>
          </svg>
        </section>
        <section className="step">
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <h2 style={{ fontSize: 16 }}>Tilt</h2>
            <span className="num" style={{ marginLeft: "auto", width: 190, textAlign: "right", whiteSpace: "nowrap", fontWeight: 600, color: "var(--accent-text)" }}>{cam.tilt}° · {tiltShort}</span>
          </div>
          <svg
            className="ring"
            viewBox="0 0 320 140"
            role="slider"
            tabIndex={0}
            aria-label="Camera tilt, from eye level to top-down"
            aria-valuemin={0}
            aria-valuemax={85}
            aria-valuenow={cam.tilt}
            style={{ borderRadius: 14, background: "var(--well)" }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = "arc";
              setState({ dragging: true });
              set({ tilt: tiltAt(e) });
            }}
            onPointerMove={(e) => {
              if (drag.current !== "arc") return;
              const t = tiltAt(e);
              frame(() => set({ tilt: t }));
            }}
            onPointerUp={end}
            onPointerCancel={end}
            onKeyDown={(e) => {
              const st = e.shiftKey ? 10 : 2;
              const d = e.key === "ArrowDown" || e.key === "ArrowLeft" ? -st : e.key === "ArrowUp" || e.key === "ArrowRight" ? st : 0;
              if (!d) return;
              e.preventDefault();
              set({ tilt: Math.max(0, Math.min(85, cam.tilt + d)) });
            }}
          >
            <line x1="20" y1="120" x2="300" y2="120" style={{ stroke: "var(--line3)" }} strokeWidth="1.5" />
            <path d="M 60 120 A 110 110 0 0 1 170 10" fill="none" style={{ stroke: "var(--line2)" }} strokeWidth="1.5" strokeDasharray="4 6" />
            <rect x="150" y="92" width="40" height="28" style={{ fill: "var(--line2)", stroke: "var(--soft)" }} />
            <line x1={tX} y1={tY} x2="170" y2="104" style={{ stroke: "var(--accent)" }} strokeDasharray="4 4" />
            <text x="30" y="114" fontSize="10.5" style={{ fill: "var(--muted)" }}>eye level</text>
            <text x="178" y="20" fontSize="10.5" style={{ fill: "var(--muted)" }}>top-down</text>
            <g transform={`translate(${tX} ${tY})`}>
              <rect x="-10" y="-7" width="20" height="14" rx="3" style={{ fill: "var(--text)" }} />
              <circle r="3.5" style={{ fill: "var(--panel)" }} />
            </g>
          </svg>
        </section>
        <section className="step">
          <h2 style={{ fontSize: 16 }}>Lens</h2>
          <div className="chips-row">
            {[24, 35, 50, 85].map((l) => (
              <button key={l} type="button" className="chip" aria-pressed={cam.lensMm === l} onClick={() => set({ lensMm: l })}>{l} mm</button>
            ))}
          </div>
          <h2 style={{ fontSize: 16, marginTop: 6 }}>Distance</h2>
          <div className="chips-row">
            {[[20, "Close · 20 m"], [35, "Medium · 35 m"], [60, "Far · 60 m"], [150, "Aerial · 150 m"]].map(([d, l]) => (
              <button key={d} type="button" className="chip" aria-pressed={cam.distanceM === d} onClick={() => set({ distanceM: d as number })}>{l}</button>
            ))}
          </div>
        </section>
        <div className="readouts">
          <div><small>Orbit</small><b>{side}</b></div>
          <div><small>Tilt</small><b className="num">{cam.tilt}° · {tiltShort}</b></div>
          <div><small>Lens</small><b className="num">{cam.lensMm} mm · {Math.round(hfov)}° view</b></div>
          <div><small>Camera height</small><b className="num">about {h < 10 ? h.toFixed(1) : Math.round(h)} m</b></div>
        </div>
      </div>
    </>
  );
}
