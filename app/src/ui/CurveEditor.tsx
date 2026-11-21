// Tone curve: drag points to bend brightness. Click the line to add a point, double-click a point to remove it.

import { useRef } from "react";
import { curveLut } from "../core/adjust";
import type { Curve } from "../core/adjust";

const S = 240, PAD = 10, IN = S - PAD * 2;
const px = (x: number) => PAD + x * IN;
const py = (y: number) => PAD + (1 - y) * IN;

export function CurveEditor({ curve, onChange }: { curve: Curve; onChange: (c: Curve) => void }) {
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<number | null>(null);
  const pts = [...curve].sort((a, b) => a[0] - b[0]);
  const lut = curveLut(pts);
  const path = Array.from({ length: 65 }, (_, i) => { const x = i / 64; return `${i ? "L" : "M"}${px(x).toFixed(1)} ${py(lut[Math.round(x * 255)] / 255).toFixed(1)}`; }).join("");
  const at = (e: React.PointerEvent): [number, number] => {
    const r = svg.current!.getBoundingClientRect();
    const k = S / r.width;
    return [Math.min(1, Math.max(0, ((e.clientX - r.left) * k - PAD) / IN)), Math.min(1, Math.max(0, 1 - ((e.clientY - r.top) * k - PAD) / IN))];
  };
  const move = (i: number, x: number, y: number) => {
    const next = pts.map((p) => [...p] as [number, number]);
    const lo = i === 0 ? 0 : next[i - 1][0] + 0.02, hi = i === next.length - 1 ? 1 : next[i + 1][0] - 0.02;
    next[i] = [i === 0 || i === next.length - 1 ? next[i][0] : Math.min(hi, Math.max(lo, x)), y];
    onChange(next);
  };
  return (
    <svg
      ref={svg}
      className="adj-curve"
      viewBox={`0 0 ${S} ${S}`}
      role="img"
      aria-label="Tone curve. Drag a point up to brighten, down to darken."
      onPointerDown={(e) => {
        const [x, y] = at(e);
        let hit = pts.findIndex((p) => Math.hypot(px(p[0]) - px(x), py(p[1]) - py(y)) < 14);
        if (hit < 0) {
          const next = [...pts, [x, lut[Math.round(x * 255)] / 255] as [number, number]].sort((a, b) => a[0] - b[0]);
          hit = next.findIndex((p) => p[0] === x);
          onChange(next);
        }
        drag.current = hit;
        svg.current?.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (drag.current === null) return;
        const [x, y] = at(e);
        move(drag.current, x, y);
      }}
      onPointerUp={() => { drag.current = null; }}
      onPointerCancel={() => { drag.current = null; }}
      onDoubleClick={(e) => {
        const r = svg.current!.getBoundingClientRect();
        const k = S / r.width;
        const mx = (e.clientX - r.left) * k, my = (e.clientY - r.top) * k;
        const i = pts.findIndex((p, j) => j > 0 && j < pts.length - 1 && Math.hypot(px(p[0]) - mx, py(p[1]) - my) < 14);
        if (i > 0) onChange(pts.filter((_, j) => j !== i));
      }}
    >
      {[0.25, 0.5, 0.75].map((t) => (
        <g key={t} stroke="currentColor" opacity={0.12}>
          <line x1={px(t)} x2={px(t)} y1={PAD} y2={S - PAD} />
          <line y1={py(t)} y2={py(t)} x1={PAD} x2={S - PAD} />
        </g>
      ))}
      <rect x={PAD} y={PAD} width={IN} height={IN} fill="none" stroke="currentColor" opacity={0.25} rx={6} />
      <line x1={px(0)} y1={py(0)} x2={px(1)} y2={py(1)} stroke="currentColor" opacity={0.2} strokeDasharray="3 4" />
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2.2} strokeLinecap="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={px(p[0])} cy={py(p[1])} r={6.5} fill="#fff" stroke="var(--accent)" strokeWidth={2} style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,.4))" }} />
      ))}
    </svg>
  );
}
