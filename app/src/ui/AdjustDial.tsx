// The Adjust dial (like the iPhone Photos edit screen): a ruler that slides under a fixed
// orange centre line. Touch it and the ticks near the line grow; let go and they settle.

import { useEffect, useRef } from "react";
import { feel } from "../lib/feel";

const NS = "http://www.w3.org/2000/svg";
const CX = 150, CY = 40, PX = 6.4; // 100 ticks across the range, 6.4 px apart (in a 300 wide view)

export function AdjustDial(props: { label: string; min: number; max: number; step: number; value: number; text: string; onChange: (v: number) => void }) {
  const { min, max, step } = props;
  const svg = useRef<SVGSVGElement>(null);
  const ticks = useRef<{ n: number; maj: boolean; el: SVGLineElement }[]>([]);
  const mid = useRef<SVGLineElement | null>(null);
  const val = useRef(props.value);
  const g = useRef({ now: 0, to: 0, raf: 0 });
  const drag = useRef<{ x: number; v: number; k: number } | null>(null);
  val.current = props.value;
  const per = (max - min) / 100; // value per tick
  const clampStep = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));

  const draw = () => {
    const u0 = (val.current - min) / per;
    const zero = (0 - min) / per;
    for (const t of ticks.current) {
      const x = CX + (t.n - u0) * PX;
      const dx = Math.abs(x - CX);
      const fade = Math.max(0, 1 - Math.pow(dx / 150, 2));
      const grow = g.current.now * Math.exp(-Math.pow(dx / 38, 2));
      const half = (t.maj ? 11 : 7) + grow * (t.maj ? 9 : 8);
      const e = t.el;
      e.setAttribute("x1", String(x)); e.setAttribute("x2", String(x));
      e.setAttribute("y1", String(CY - half)); e.setAttribute("y2", String(CY + half));
      e.setAttribute("stroke", Math.abs(t.n - zero) < 1e-6 ? "var(--accent)" : "currentColor");
      e.setAttribute("stroke-width", String((t.maj ? 1.6 : 1.1) + grow * 0.9));
      e.setAttribute("opacity", String(Math.min(1, fade * ((t.maj ? 0.8 : 0.42) + grow * 0.5))));
    }
    const m = mid.current;
    if (m) {
      const h = 20 + g.current.now * 14;
      m.setAttribute("y1", String(CY - h)); m.setAttribute("y2", String(CY + h));
      m.setAttribute("stroke-width", String(2.2 + g.current.now * 1.4));
    }
  };

  const animate = () => {
    const s = g.current;
    s.now += (s.to - s.now) * 0.22;
    if (Math.abs(s.to - s.now) < 0.01) s.now = s.to;
    draw();
    s.raf = s.now !== s.to ? requestAnimationFrame(animate) : 0;
  };
  const kick = (to: number) => {
    g.current.to = to;
    if (!g.current.raf) g.current.raf = requestAnimationFrame(animate);
  };

  useEffect(() => {
    const root = svg.current;
    if (!root) return;
    root.replaceChildren();
    ticks.current = [];
    for (let n = 0; n <= 100; n++) {
      const el = document.createElementNS(NS, "line");
      el.setAttribute("stroke-linecap", "round");
      root.appendChild(el);
      ticks.current.push({ n, maj: n % 5 === 0, el });
    }
    const m = document.createElementNS(NS, "line");
    m.setAttribute("x1", String(CX)); m.setAttribute("x2", String(CX));
    m.setAttribute("stroke", "var(--accent)"); m.setAttribute("stroke-linecap", "round");
    root.appendChild(m);
    mid.current = m;
    draw();
    return () => { cancelAnimationFrame(g.current.raf); g.current.raf = 0; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [min, max]);
  useEffect(draw, [props.value]);

  const set = (v: number) => {
    const n = clampStep(v);
    if ((val.current < 0 && n >= 0) || (val.current > 0 && n <= 0)) feel("tap");
    if (n !== val.current) props.onChange(n);
  };

  return (
    <svg
      ref={svg}
      className="adj-dial"
      viewBox="0 0 300 80"
      role="slider"
      tabIndex={0}
      aria-label={props.label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={props.value}
      aria-valuetext={props.text}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, v: val.current, k: 300 / e.currentTarget.getBoundingClientRect().width };
        kick(1);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (d) set(d.v - ((e.clientX - d.x) * d.k / PX) * per);
      }}
      onPointerUp={() => { drag.current = null; kick(0); }}
      onPointerCancel={() => { drag.current = null; kick(0); }}
      onFocus={() => kick(0)}
      onDoubleClick={() => set(0)}
      onKeyDown={(e) => {
        const big = e.shiftKey ? 10 : 1;
        if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); set(val.current + step * big); }
        else if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); set(val.current - step * big); }
        else if (e.key === "Home" || e.key === "0") { e.preventDefault(); set(0); }
      }}
    />
  );
}
