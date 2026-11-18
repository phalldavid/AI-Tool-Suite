// The Advanced tab (node canvas): its on/off switch and the autosaved last graph.
// localStorage is only a convenience here: every read and write is in try/catch,
// and the tab works when it throws or is empty. The real copy of a graph is the
// .graph.json file the owner saves.

import { useSyncExternalStore } from "react";
import { parseGraph, serializeGraph } from "../core/graph";
import type { Graph } from "../core/graph";
import { useDev } from "./dev";

const FLAG = "drs2.advanced";
const LAST = "drs2.graph.last";
const listeners = new Set<() => void>();

function readFlag(): boolean {
  try {
    return localStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
}

let on = readFlag();

/** The switch in Settings, Developer. The tab also needs developer mode on. */
export function advancedSwitch(): boolean {
  return on;
}

export function setAdvancedSwitch(v: boolean): void {
  on = v;
  try {
    if (v) localStorage.setItem(FLAG, "1");
    else localStorage.removeItem(FLAG);
  } catch {
    /* this visit only */
  }
  for (const l of listeners) l();
}

export function useAdvancedSwitch(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => on,
    () => on,
  );
}

/** True when the Advanced tab should show: developer mode on and its own switch on. */
export function useAdvancedTab(): boolean {
  const dev = useDev();
  return useAdvancedSwitch() && dev;
}

/** The last graph, checked like any outside file. Null when there is none or it is broken. */
export function loadLastGraph(): Graph | null {
  try {
    const raw = localStorage.getItem(LAST);
    if (!raw) return null;
    const r = parseGraph(raw);
    return r.ok ? r.graph : null;
  } catch {
    return null;
  }
}

export function saveLastGraph(graph: Graph): boolean {
  try {
    localStorage.setItem(LAST, serializeGraph(graph));
    return true;
  } catch {
    return false;
  }
}
