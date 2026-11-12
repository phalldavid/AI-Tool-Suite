// The v1 sun dial colours, now on the real sun path for Phnom Penh: the arc is the sun's
// height through the day, drawn to scale. Drag along it; the trail, daylight area,
// arrow and readouts follow every frame. Fixed 320 px wide, so text never scales.

import { useMemo, useRef } from "react";
import { setState, useApp } from "../store";
import { solar } from "../lib/sun";
import { sunPhase } from "../core/prompt";

const DS = 5.5;
const DE = 19.5;
const W = 320;
const H = 184;
const CY = 140;
/** room above the highest sun so its glow never touches the top edge */
const TOP = 26;
const PAD = 22;

const SKY: Record<string, [string, string, string]> = {
  Dawn: ["#2c3560", "#e9967a", "#ffb36b"],
  Morning: ["#5f9bd6", "#f3d6a6", "#ffe2a3"],
  Midday: ["#2f86d8", "#bfe0f6", "#fff6d8"],
  Afternoon: ["#4a88c7", "#f2c98d", "#ffd27a"],
  "Golden hour": ["#5a5f8a", "#f0a050", "#ff9d3c"],
  Dusk: ["#2b2f5c", "#d9704a", "#ff7a45"],
  "Blue hour": ["#101a3d", "#3d5a99", "#c9d6ff"],
  Night: ["#05070f", "#1b2036", "#d9dde8"],
};

export function fmtHour(h: number): string {
  const m = Math.round(h * 60);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function xOf(h: number): number {
  return PAD + ((Math.max(DS, Math.min(DE, h)) - DS) / (DE - DS)) * (W - 2 * PAD);
}

/** The real sun height for Phnom Penh on this day, drawn to scale (90° = top). */
function yOf(elev: number): number {
  return CY - (Math.max(-12, elev) / 90) * (CY - TOP);
}

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

function curve(day: number, from: number, to: number): string {
  const pts: string[] = [];
  for (let h = from; h <= to + 1e-6; h += 0.125) {
    const { elevation } = solar(day, h);
    pts.push(`${xOf(h).toFixed(1)} ${yOf(elevation).toFixed(1)}`);
  }
  return pts.length ? `M ${pts.join(" L ")}` : "";
}

export function SunDial({ hour, onHour, id = "dial" }: { hour: number; onHour: (h: number) => void; id?: string }) {
  const drag = useRef(false);
  const raf = useRef(0);
  const phase = sunPhase(hour);
  const [top, bottom, sunC] = SKY[phase] ?? SKY.Night;
  const day = useApp((s) => s.sun.dayOfYear);
  const sunAt = solar(day, hour);
  const sx = xOf(hour);
  const sy = yOf(sunAt.elevation);
  const whole = useMemo(() => curve(day, DS, DE), [day]);
  const ticks = useMemo(() => [6, 9, 12, 15, 18].map((h) => ({ h, x: xOf(h), y: yOf(solar(day, h).elevation) })), [day]);
  const done = curve(day, DS, hour);
  const area = `${done} L ${sx.toFixed(1)} ${CY} L ${xOf(DS)} ${CY} Z`;
  // A small arrow just ahead of the sun shows which way it travels.
  const ah = Math.min(DE, hour + 0.6);
  const ax = xOf(ah);
  const ay = yOf(solar(day, ah).elevation);
  const ang = (Math.atan2(ay - sy, ax - sx) * 180) / Math.PI;
  const hourAt = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    return Math.round((DS + ((x - PAD) / (W - 2 * PAD)) * (DE - DS)) * 4) / 4;
  };
  return (
    <svg
      className="dial"
      viewBox={`0 0 ${W} ${H}`}
      role="slider"
      tabIndex={0}
      aria-label="Time of day. Drag the sun, or use the arrow keys"
      aria-valuemin={DS}
      aria-valuemax={DE}
      aria-valuenow={hour}
      aria-valuetext={`${fmtHour(hour)}, ${phase}`}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = true;
        setState({ dragging: true });
        onHour(Math.max(DS, Math.min(DE, hourAt(e))));
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        const h = Math.max(DS, Math.min(DE, hourAt(e)));
        cancelAnimationFrame(raf.current);
        raf.current = requestAnimationFrame(() => onHour(h));
      }}
      onPointerUp={() => {
        drag.current = false;
        setState({ dragging: false });
      }}
      onPointerCancel={() => {
        drag.current = false;
        setState({ dragging: false });
      }}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 1 : 0.25;
        const d = e.key === "ArrowLeft" || e.key === "ArrowDown" ? -step : e.key === "ArrowRight" || e.key === "ArrowUp" ? step : 0;
        if (!d) return;
        e.preventDefault();
        onHour(Math.max(DS, Math.min(DE, hour + d)));
      }}
    >
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={top} />
          <stop offset="100%" stopColor={bottom} />
        </linearGradient>
        <radialGradient id={`${id}-glow`}>
          <stop offset="0%" stopColor={sunC} stopOpacity="0.9" />
          <stop offset="100%" stopColor={sunC} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-trail`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={sunC} stopOpacity="0.15" />
          <stop offset="100%" stopColor={sunC} stopOpacity="1" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={W} height={CY} fill={`url(#${id}-sky)`} />
      <path d={area} fill={sunC} opacity={sunAt.elevation > 0 ? 0.16 : 0.06} />
      <rect x="0" y={CY} width={W} height={H - CY} style={{ fill: "var(--field)" }} />
      <path d={whole} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" strokeDasharray="3 5" />
      <path d={done} fill="none" stroke={`url(#${id}-trail)`} strokeWidth="3" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 4px ${sunC})` }} />
      <line x1="8" y1={CY} x2={W - 8} y2={CY} stroke="rgba(255,255,255,0.5)" />
      {ticks.map((t) => (
        <g key={t.h}>
          <circle cx={t.x} cy={t.y} r="2.4" fill="rgba(255,255,255,0.8)" />
          <text x={t.x} y={t.h === 12 ? t.y + 15 : t.y - 7} textAnchor="middle" fontSize="9.5" fill="rgba(255,255,255,0.85)">
            {t.h}:00
          </text>
        </g>
      ))}
      {hour < DE - 0.3 && sunAt.elevation > -6 ? (
        <path d="M -4 -4 L 3 0 L -4 4" transform={`translate(${(sx + ax) / 2} ${(sy + ay) / 2}) rotate(${ang})`} fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
      ) : null}
      <circle cx={sx} cy={sy} r="26" fill={`url(#${id}-glow)`} />
      <g transform={`translate(${sx} ${sy})`}>
        <g className="spin">
          <path d="M0 -17V-13M0 13V17M-17 0H-13M13 0H17M-12 -12L-9.2 -9.2M9.2 9.2L12 12M-12 12L-9.2 9.2M9.2 -9.2L12 -12" stroke={sunC} strokeWidth="2" strokeLinecap="round" />
        </g>
      </g>
      <circle cx={sx} cy={sy} r="9" fill={sunC} style={{ filter: "drop-shadow(0 0 6px rgba(255,200,120,0.9))" }} />
      <text x="12" y="20" textAnchor="start" fontSize="11.5" fontWeight="800" letterSpacing="1.6" fill="#fff" stroke="rgba(0,0,0,0.25)" strokeWidth="3" paintOrder="stroke">
        {phase.toUpperCase()}
      </text>
      <text x="12" y={CY + 17} fontSize="10" fontWeight="700" style={{ fill: "var(--muted)" }}>E</text>
      <text x={W - 12} y={CY + 17} textAnchor="end" fontSize="10" fontWeight="700" style={{ fill: "var(--muted)" }}>W</text>
      <text x={W / 2} y={CY + 18} textAnchor="middle" fontSize="11" fontWeight="600" className="num" style={{ fill: "var(--soft)" }}>
        {fmtHour(hour)} · {Math.round(sunAt.bearing)}° {COMPASS[Math.round(sunAt.bearing / 22.5) % 16]} · {Math.round(sunAt.elevation)}° high
      </text>
      <text x={W / 2} y={CY + 34} textAnchor="middle" fontSize="9.5" className="num" style={{ fill: "var(--muted)" }}>
        Phnom Penh · {new Date(Date.UTC(2026, 0, day)).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}
      </text>
    </svg>
  );
}
