// The v1 sun dial, same maths and colours: drag the sun along the arc.
// Fixed 320 px wide, so text never scales. Updates once per frame while dragging.

import { useRef } from "react";
import { setState } from "../store";
import { sunPhase } from "../core/prompt";

const DS = 5.5;
const DE = 19.5;
const W = 320;
const H = 150;
const CX = 160;
const CY = 118;
const R = 112;

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

function pos(h: number): [number, number] {
  const k = (Math.max(DS, Math.min(DE, h)) - DS) / (DE - DS);
  const a = Math.PI * (1 - k);
  return [CX + R * Math.cos(a), CY - R * Math.sin(a)];
}

const TICKS = [6, 9, 12, 15, 18].map((h) => {
  const [x, y] = pos(h);
  return { h, x, y, ly: h === 12 ? y + 16 : y - 8 };
});

export function SunDial({ hour, onHour, id = "dial" }: { hour: number; onHour: (h: number) => void; id?: string }) {
  const drag = useRef(false);
  const raf = useRef(0);
  const phase = sunPhase(hour);
  const [top, bottom, sunC] = SKY[phase] ?? SKY.Night;
  const [sx, sy] = pos(hour);
  const hourAt = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const y = ((e.clientY - r.top) / r.height) * H;
    let a = Math.atan2(CY - y, x - CX);
    if (a < 0) a = x < CX ? Math.PI : 0;
    return Math.round((DS + (1 - a / Math.PI) * (DE - DS)) * 4) / 4;
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
        onHour(hourAt(e));
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        const h = hourAt(e);
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
      </defs>
      <rect x="0" y="0" width={W} height={CY} fill={`url(#${id}-sky)`} />
      <rect x="0" y={CY} width={W} height={H - CY} style={{ fill: "var(--field)" }} />
      <path d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" strokeDasharray="3 5" />
      <line x1="8" y1={CY} x2={W - 8} y2={CY} stroke="rgba(255,255,255,0.45)" />
      {TICKS.map((t) => (
        <g key={t.h}>
          <circle cx={t.x} cy={t.y} r="2.6" fill="rgba(255,255,255,0.8)" />
          <text x={t.x} y={t.ly} textAnchor="middle" fontSize="9.5" fill="rgba(255,255,255,0.8)">
            {t.h}:00
          </text>
        </g>
      ))}
      <text x="12" y={CY + 16} fontSize="10" fontWeight="700" style={{ fill: "var(--muted)" }} >E</text>
      <text x={W - 12} y={CY + 16} textAnchor="end" fontSize="10" fontWeight="700" style={{ fill: "var(--muted)" }} >W</text>
      <circle cx={sx} cy={sy} r="26" fill={`url(#${id}-glow)`} />
      <g transform={`translate(${sx} ${sy})`}>
        <g className="spin">
          <path d="M0 -17V-13M0 13V17M-17 0H-13M13 0H17M-12 -12L-9.2 -9.2M9.2 9.2L12 12M-12 12L-9.2 9.2M9.2 -9.2L12 -12" stroke={sunC} strokeWidth="2" strokeLinecap="round" />
        </g>
      </g>
      <circle cx={sx} cy={sy} r="9" fill={sunC} style={{ filter: "drop-shadow(0 0 6px rgba(255,200,120,0.9))" }} />
      <text x={CX} y={CY - 34} textAnchor="middle" fontSize="13" fontWeight="800" letterSpacing="1.8" fill="#fff" stroke="rgba(0,0,0,0.25)" strokeWidth="3" paintOrder="stroke">
        {phase.toUpperCase()}
      </text>
      <text x={CX} y={CY - 16} textAnchor="middle" fontSize="11" fontWeight="600" fill="rgba(255,255,255,0.9)" className="num">
        {fmtHour(hour)}
      </text>
    </svg>
  );
}
