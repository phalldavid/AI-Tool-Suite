// The status lines the loader rotates through while a render runs. The built-in list lives in
// ui/loader/engine.ts; in developer mode you can add your own lines (and hide the built-in
// ones). Kept in this browser only.

import { useSyncExternalStore } from "react";
import { STATUS_WORDS } from "../ui/loader/engine";

const KEY = "drs2.slang";

/** What shows while the result appears. */
export const FINISHING = "Putting the cherry on top";

export interface SlangSettings {
  /** Extra lines, one per entry. */
  mine: string[];
  /** Leave the built-in lines out (only when there are lines of your own). */
  hideBuiltIn: boolean;
}

function read(): SlangSettings {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<SlangSettings> | null;
    return { mine: Array.isArray(v?.mine) ? v!.mine.filter((x) => typeof x === "string" && x.trim()) : [], hideBuiltIn: Boolean(v?.hideBuiltIn) };
  } catch {
    return { mine: [], hideBuiltIn: false };
  }
}

let state = read();
const listeners = new Set<() => void>();

export function setSlang(next: Partial<SlangSettings>): void {
  state = { ...state, ...next, mine: (next.mine ?? state.mine).map((x) => x.trim()).filter(Boolean) };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode: keep it for this visit */
  }
  listeners.forEach((l) => l());
}

export function useSlang(): SlangSettings {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

/** Lines in rotation: the built-in ones (unless hidden) plus your own, no repeats. */
export function slangLines(s: SlangSettings = state): string[] {
  const base = s.hideBuiltIn && s.mine.length ? [] : STATUS_WORDS;
  return [...new Set([...base, ...s.mine])];
}
