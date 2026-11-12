// Developer mode: unlocks the picture makers (contact sheets for looks and environments).
// The keyword only hides tools from everyday users; it is not a security check.

import { useSyncExternalStore } from "react";

const KEY = "drs2.dev";
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

let on = read();

export function isDev(): boolean {
  return on;
}

/** Turns developer mode on if the keyword is right. Returns whether it is on. */
export function unlockDev(word: string): boolean {
  if (word.trim() !== "DAVID") return false;
  setDev(true);
  return true;
}

export function setDev(v: boolean): void {
  on = v;
  try {
    if (v) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    /* this visit only */
  }
  for (const l of listeners) l();
}

export function useDev(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => on,
    () => on,
  );
}
