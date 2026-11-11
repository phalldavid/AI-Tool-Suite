// Drag handle between panels. Pointer or arrow keys; double-click resets.

import { useRef, useState } from "react";
import { setState } from "../store";

export function Splitter({ dir, label, value, onSize, onDone, onReset, step = 16 }: {
  dir: "v" | "h";
  label: string;
  value: number;
  /** New size from the pointer position, given the parent's box. */
  onSize: (pos: { x: number; y: number }, box: DOMRect) => void;
  onDone: () => void;
  onReset: () => void;
  step?: number;
}) {
  const box = useRef<DOMRect | null>(null);
  const raf = useRef(0);
  const [on, setOn] = useState(false);
  return (
    <div
      className={`splitter ${dir}${on ? " on" : ""}`}
      role="separator"
      tabIndex={0}
      aria-orientation={dir === "v" ? "vertical" : "horizontal"}
      aria-label={`${label}. Drag, or use the arrow keys. Double-click to reset.`}
      aria-valuenow={Math.round(value)}
      onPointerDown={(e) => {
        e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        box.current = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
        setOn(true);
        setState({ dragging: true });
      }}
      onPointerMove={(e) => {
        if (!box.current) return;
        const pos = { x: e.clientX, y: e.clientY };
        cancelAnimationFrame(raf.current);
        raf.current = requestAnimationFrame(() => box.current && onSize(pos, box.current));
      }}
      onPointerUp={() => {
        if (!box.current) return;
        box.current = null;
        setOn(false);
        setState({ dragging: false });
        onDone();
      }}
      onPointerCancel={() => {
        box.current = null;
        setOn(false);
        setState({ dragging: false });
      }}
      onDoubleClick={onReset}
      onKeyDown={(e) => {
        const big = e.shiftKey ? step * 4 : step;
        const r = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
        const el = e.currentTarget.getBoundingClientRect();
        const cx = el.left + el.width / 2;
        const cy = el.top + el.height / 2;
        let pos: { x: number; y: number } | null = null;
        if (dir === "v" && e.key === "ArrowLeft") pos = { x: cx - big, y: cy };
        if (dir === "v" && e.key === "ArrowRight") pos = { x: cx + big, y: cy };
        if (dir === "h" && e.key === "ArrowUp") pos = { x: cx, y: cy - big };
        if (dir === "h" && e.key === "ArrowDown") pos = { x: cx, y: cy + big };
        if (e.key === "Enter") {
          e.preventDefault();
          return onReset();
        }
        if (!pos) return;
        e.preventDefault();
        onSize(pos, r);
        onDone();
      }}
    >
      <span />
    </div>
  );
}
