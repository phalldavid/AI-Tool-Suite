// The canvas's own state, kept out of the main app store so dragging and typing
// on the canvas never re-render the other tabs. Pictures stay in memory for this
// visit only; the graph (names and settings) is autosaved after each edit.

import { useSyncExternalStore } from "react";
import { breakRun, record, redo as redoStep, replacePresent, startUndo, starterGraph, undo as undoStep } from "../../core/graph";
import type { Graph, PortRef, Undo } from "../../core/graph";
import type { ImageData64 } from "../../core/types";
import { loadLastGraph, saveLastGraph } from "../../lib/advanced";

export interface Picture {
  /** Small JPEG data URL for the node. */
  thumb: string;
  /** The picture itself, kept for later stages (render). Never saved in the graph file. */
  full: ImageData64;
}

export interface Pending extends PortRef {
  side: "in" | "out";
}

export interface CanvasState {
  undo: Undo;
  selected: string[];
  selectedWire: string | null;
  pending: Pending | null;
  pictures: Record<string, Picture>;
  /** Canvas point where "Add node" puts the new node, and where the menu shows on screen; null when closed. */
  addAt: MenuAt | null;
  /** Right-click menu; null when closed. */
  menu: (MenuAt & { node: string | null; wire: string | null }) | null;
  /** Nodes copied with Ctrl C, as JSON of the graph slice. */
  copied: Graph | null;
  /** Finished renders this visit, by resultKey(job). History keeps them for good. */
  results: Record<string, GraphResult>;
  /** The run in progress or just finished; null before the first run. */
  run: RunState | null;
  /** The right-hand panel is open. */
  panel: boolean;
}

export interface GraphResult {
  promptHash: string;
  image: ImageData64;
  before: ImageData64;
  historyId?: string;
  at: number;
}

export type JobStatus = "waiting" | "rendering" | "done" | "failed" | "skipped" | "stopped";

export interface RunJobState {
  key: string;
  name: string;
  lookName: string;
  status: JobStatus;
  error?: string;
}

export interface RunState {
  status: "running" | "paused" | "finished" | "stopped";
  jobs: RunJobState[];
  /** "Test" in Test mode; otherwise the backend and model. */
  where: string;
  startedAt: number;
}

export interface MenuAt {
  /** canvas units */
  x: number;
  y: number;
  /** px inside the canvas box */
  sx: number;
  sy: number;
}

let state: CanvasState | null = null;
const listeners = new Set<() => void>();
let saveTimer = 0;

function init(): CanvasState {
  return { undo: startUndo(loadLastGraph() ?? starterGraph()), selected: [], selectedWire: null, pending: null, pictures: {}, addAt: null, menu: null, copied: null, results: {}, run: null, panel: readPanel() };
}

export function getCanvas(): CanvasState {
  if (!state) state = init();
  return state;
}

function set(patch: Partial<CanvasState>): void {
  state = { ...getCanvas(), ...patch };
  for (const l of listeners) l();
}

export function useCanvas<T>(pick: (s: CanvasState) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => pick(getCanvas()),
    () => pick(getCanvas()),
  );
}

function autosave(): void {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => saveLastGraph(getCanvas().undo.present), 500);
}

export function graph(): Graph {
  return getCanvas().undo.present;
}

/** Records an edit for undo. `key` joins a run of the same edit (typing) into one step. */
export function commit(g: Graph, key: string | null = null): void {
  const s = getCanvas();
  const ids = new Set(g.nodes.map((n) => n.id));
  set({
    undo: record(s.undo, g, key),
    selected: s.selected.filter((id) => ids.has(id)),
    selectedWire: s.selectedWire && g.wires.some((w) => w.id === s.selectedWire) ? s.selectedWire : null,
  });
  autosave();
}

/** Pan and zoom: kept and saved, but not an undo step. */
export function commitView(g: Graph): void {
  set({ undo: replacePresent(getCanvas().undo, g) });
  autosave();
}

export function undo(): void {
  set({ undo: undoStep(getCanvas().undo), pending: null });
  autosave();
}

export function redo(): void {
  set({ undo: redoStep(getCanvas().undo), pending: null });
  autosave();
}

export function endTypingRun(): void {
  set({ undo: breakRun(getCanvas().undo) });
}

export function select(ids: string[]): void {
  set({ selected: ids, selectedWire: null });
}

export function selectWire(id: string | null): void {
  set({ selectedWire: id, selected: id ? [] : getCanvas().selected });
}

export function setPending(p: Pending | null): void {
  set({ pending: p });
}

export function openAdd(at: MenuAt | null): void {
  set({ addAt: at, menu: null });
}

const PANEL = "drs2.graph.panel";

function readPanel(): boolean {
  try {
    return localStorage.getItem(PANEL) !== "0";
  } catch {
    return true;
  }
}

export function setPanel(open: boolean): void {
  set({ panel: open });
  try {
    localStorage.setItem(PANEL, open ? "1" : "0");
  } catch {
    /* this visit only */
  }
}

export function setRun(run: RunState | null): void {
  set({ run });
}

export function patchJob(key: string, patch: Partial<RunJobState>): void {
  const r = getCanvas().run;
  if (!r) return;
  set({ run: { ...r, jobs: r.jobs.map((j) => (j.key === key ? { ...j, ...patch } : j)) } });
}

export function setResult(key: string, res: GraphResult): void {
  set({ results: { ...getCanvas().results, [key]: res } });
}

export function openMenu(m: CanvasState["menu"]): void {
  set({ menu: m, addAt: null });
}

/** Ctrl C: keeps the selected nodes and the wires between them. */
export function copyNodes(ids: string[]): void {
  const g = getCanvas().undo.present;
  const set_ = new Set(ids);
  if (!set_.size) return;
  set({
    copied: {
      ...g,
      nodes: g.nodes.filter((n) => set_.has(n.id)),
      wires: g.wires.filter((w) => set_.has(w.from.node) && set_.has(w.to.node)),
    },
  });
}

/** Pictures follow copied Image nodes to their copies. */
export function sharePictures(from: string[], to: string[]): void {
  const pics = { ...getCanvas().pictures };
  from.forEach((id, i) => {
    if (pics[id] && to[i]) pics[to[i]] = pics[id];
  });
  set({ pictures: pics });
}

export function setPicture(nodeId: string, pic: Picture): void {
  set({ pictures: { ...getCanvas().pictures, [nodeId]: pic } });
}

/** Replace the whole graph (new or opened). Undo can bring the old one back. */
export function replaceGraph(g: Graph): void {
  commit(g);
  set({ selected: [], selectedWire: null, pending: null });
}
