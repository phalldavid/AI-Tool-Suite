// Stacked toasts (Sonner-style): newest on top, pause on hover, action button.

import { useSyncExternalStore } from "react";

export interface Toast {
  id: number;
  kind: "info" | "ok" | "error" | "warn";
  text: string;
  action?: { label: string; run: () => void };
  ms: number;
}

let toasts: Toast[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const timers = new Map<number, { left: number; started: number; t: number }>();

function emit(): void {
  for (const l of listeners) l();
}

export function dismiss(id: number): void {
  const t = timers.get(id);
  if (t) window.clearTimeout(t.t);
  timers.delete(id);
  toasts = toasts.filter((x) => x.id !== id);
  emit();
}

function arm(id: number, ms: number): void {
  const t = window.setTimeout(() => dismiss(id), ms);
  timers.set(id, { left: ms, started: Date.now(), t });
}

export function pause(id: number): void {
  const t = timers.get(id);
  if (!t) return;
  window.clearTimeout(t.t);
  t.left = Math.max(800, t.left - (Date.now() - t.started));
}

export function resume(id: number): void {
  const t = timers.get(id);
  if (!t) return;
  arm(id, t.left);
}

/** Shows a toast. Same text twice in a row only shows once (audit M-08). */
export function toast(text: string, kind: Toast["kind"] = "info", action?: Toast["action"]): number {
  const dup = toasts.find((x) => x.text === text);
  if (dup) return dup.id;
  const id = ++seq;
  const ms = kind === "error" ? 9000 : 4500;
  toasts = [...toasts, { id, kind, text, action, ms }].slice(-3);
  arm(id, ms);
  emit();
  return id;
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => toasts,
    () => toasts,
  );
}
