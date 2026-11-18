// Undo and redo for canvas edits. Graphs are never changed in place, so each
// step is just the graph as it was.

import type { Graph } from "./types";

export interface Undo {
  past: Graph[];
  present: Graph;
  future: Graph[];
  /** Edits with the same key in a row (typing, arrow-key moves) make one undo step. */
  lastKey: string | null;
}

export const UNDO_LIMIT = 100;

export function startUndo(graph: Graph): Undo {
  return { past: [], present: graph, future: [], lastKey: null };
}

/** Records a new graph. `key` joins it to the previous step when the key is the same. */
export function record(u: Undo, graph: Graph, key: string | null = null): Undo {
  if (graph === u.present) return u;
  if (key !== null && key === u.lastKey && u.past.length) {
    return { past: u.past, present: graph, future: [], lastKey: key };
  }
  const past = [...u.past, u.present].slice(-UNDO_LIMIT);
  return { past, present: graph, future: [], lastKey: key };
}

/** Changes that should not be undone one by one (pan and zoom). */
export function replacePresent(u: Undo, graph: Graph): Undo {
  return { ...u, present: graph };
}

export function undo(u: Undo): Undo {
  if (!u.past.length) return u;
  const prev = u.past[u.past.length - 1];
  // Keep the current view: undo is for content, not for where you are looking.
  return { past: u.past.slice(0, -1), present: { ...prev, view: u.present.view }, future: [u.present, ...u.future], lastKey: null };
}

export function redo(u: Undo): Undo {
  if (!u.future.length) return u;
  const [next, ...rest] = u.future;
  return { past: [...u.past, u.present], present: { ...next, view: u.present.view }, future: rest, lastKey: null };
}

/** Ends a run of joined edits, so the next edit is its own step. */
export function breakRun(u: Undo): Undo {
  return u.lastKey === null ? u : { ...u, lastKey: null };
}
