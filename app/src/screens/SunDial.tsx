// The v1 sun dial colours on a soft plaster arch: the sun rides the curve of the arch
// from sunrise (left) to sunset (right). While you drag, the sun and its trail grow a
// little and settle back when you let go. Fixed 320 px wide, so text never scales.

import { useRef, useState } from "react";
import { setState } from "../store";
import { sunPhase } from "../core/prompt";

const DS = 5.5;
const DE = 19.5;
const W = 320;
const H = 158;
const CX = 160;
/** ground line */
const CY = 136;
/** where the arch's straight legs turn into the curve */
const SY = 110;
const RX = 126;
const RY = 84;

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
  return [CX + RX * Math.cos(a), SY - RY * Math.sin(a)];
}

const L = CX - RX;
const R = CX + RX;
const ARCH = `M ${L} ${CY} L ${L} ${SY} A ${RX} ${RY} 0 0 1 ${R} ${SY} L ${R} ${CY}`;
const TICKS = [6, 9, 12, 15, 18].map((h) => ({ h, p: pos(h) }));

export function SunDial({ hour, onHour, id = "dial" }: { hour: number; onHour: (h: number) => void; id?: string }) {
  const drag = useRef(false);
  const raf = useRef(0);
  const [active, setActive] = useState(false);
  const phase = sunPhase(hour);
  const [top, bottom, sunC] = SKY[phase] ?? SKY.Night;
  const [sx, sy] = pos(hour);
  const trail = `M ${L} ${SY} A ${RX} ${RY} 0 0 1 ${sx.toFixed(1)} ${sy.toFixed(1)}`;
  const hourAt = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const y = ((e.clientY - r.top) / r.height) * H;
    let a = Math.atan2((SY - y) / RY, (x - CX) / RX);
    if (a < 0) a = x < CX ? Math.PI : 0;
    return Math.round((DS + (1 - a / Math.PI) * (DE - DS)) * 4) / 4;
  };
  const end = () => {
    drag.current = false;
    setActive(false);
    setState({ dragging: false });
  };
  return (
    <svg
      className={`dial${active ? " active" : ""}`}
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
        setActive(true);
        setState({ dragging: true });
        onHour(hourAt(e));
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        const h = hourAt(e);
        cancelAnimationFrame(raf.current);
        raf.current = requestAnimationFrame(() => onHour(h));
      }}
      onPointerUp={end}
      onPointerCancel={end}
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
        <linearGradient id={`${id}-plaster`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0.04" />
        </linearGradient>
        <radialGradient id={`${id}-glow`}>
          <stop offset="0%" stopColor={sunC} stopOpacity="0.9" />
          <stop offset="100%" stopColor={sunC} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width={W} height={CY} fill={`url(#${id}-sky)`} />
      <path d={`${ARCH} Z`} fill={`url(#${id}-plaster)`} />
      <path d={ARCH} className="arch" fill="none" stroke="rgba(255,255,255,0.32)" strokeLinecap="round" strokeLinejoin="round" />
      <path d={trail} className="trail" fill="none" stroke={sunC} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 5px ${sunC})` }} />
      <rect x="0" y={CY} width={W} height={H - CY} style={{ fill: "var(--field)" }} />
      <line x1="8" y1={CY} x2={W - 8} y2={CY} stroke="rgba(255,255,255,0.45)" />
      {TICKS.map((t) => (
        <circle key={t.h} cx={t.p[0]} cy={t.p[1]} r="2.2" fill="rgba(255,255,255,0.75)" />
      ))}
      <text x={CX} y={SY - 16} textAnchor="middle" fontSize="13" fontWeight="800" letterSpacing="1.8" fill="#fff" stroke="rgba(0,0,0,0.25)" strokeWidth="3" paintOrder="stroke">
        {phase.toUpperCase()}
      </text>
      <text x={CX} y={SY + 2} textAnchor="middle" fontSize="11" fontWeight="600" fill="rgba(255,255,255,0.9)" className="num">
        {fmtHour(hour)}
      </text>
      <text x="12" y={CY + 16} fontSize="10" fontWeight="700" style={{ fill: "var(--muted)" }}>E</text>
      <text x={W - 12} y={CY + 16} textAnchor="end" fontSize="10" fontWeight="700" style={{ fill: "var(--muted)" }}>W</text>
      <g transform={`translate(${sx} ${sy})`}>
        <g className="sun">
          <circle r="26" fill={`url(#${id}-glow)`} />
          <g className="spin">
            <path d="M0 -17V-13M0 13V17M-17 0H-13M13 0H17M-12 -12L-9.2 -9.2M9.2 9.2L12 12M-12 12L-9.2 9.2M9.2 -9.2L12 -12" stroke={sunC} strokeWidth="2" strokeLinecap="round" />
          </g>
          <circle r="9" fill={sunC} style={{ filter: "drop-shadow(0 0 6px rgba(255,200,120,0.9))" }} />
        </g>
      </g>
    </svg>
  );
}
