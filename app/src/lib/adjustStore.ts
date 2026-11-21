// Slider values of the Adjust tool, shared by the panel and the preview.

import { useSyncExternalStore } from "react";
import { NEUTRAL } from "../core/adjust";
import type { Adjust } from "../core/adjust";

let cur: Adjust = { ...NEUTRAL };
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export function getAdjust(): Adjust {
  return cur;
}
export function setAdjust(p: Partial<Adjust>): void {
  cur = { ...cur, ...p };
  emit();
}
export function resetAdjust(): void {
  cur = { ...NEUTRAL };
  emit();
}
export function useAdjust(): Adjust {
  return useSyncExternalStore((f) => (subs.add(f), () => void subs.delete(f)), () => cur);
}
