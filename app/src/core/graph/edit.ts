// Canvas edits as pure functions: each takes a graph and returns a new one
// (or a plain reason why not). The canvas keeps every result for undo.

import { NODE_DEFS, makeNode } from "./nodes";
import { connect } from "./wires";
import { DEFAULT_VIEW, LIMITS } from "./types";
import type { Graph, GraphNode, GraphView, NodeKind, PortRef, SettingsByKind } from "./types";

export type EditResult = { graph: Graph } | { reason: string };

export function emptyGraph(name = "Untitled graph"): Graph {
  return { name, nodes: [], wires: [], view: { ...DEFAULT_VIEW } };
}

/** A short id not used in the graph yet, e.g. "look3". */
export function nextId(graph: Pick<Graph, "nodes" | "wires">, prefix: string): string {
  const used = new Set([...graph.nodes.map((n) => n.id), ...graph.wires.map((w) => w.id)]);
  for (let i = 1; ; i++) if (!used.has(`${prefix}${i}`)) return `${prefix}${i}`;
}

/** Why a node of this kind cannot be added, or null when it can. */
export function cannotAdd(graph: Graph, kind: NodeKind, count = 1): string | null {
  if (graph.nodes.length + count > LIMITS.nodes) return `A graph can have at most ${LIMITS.nodes} nodes.`;
  if (kind === "image" && graph.nodes.filter((n) => n.kind === "image").length + count > LIMITS.images) {
    return `A graph can have at most ${LIMITS.images} images.`;
  }
  return null;
}

export function addNode<K extends NodeKind>(graph: Graph, kind: K, x: number, y: number, settings?: Partial<SettingsByKind[K]>): EditResult & { id?: string } {
  const why = cannotAdd(graph, kind);
  if (why) return { reason: why };
  const id = nextId(graph, kind);
  const node = makeNode(kind, id, Math.round(x), Math.round(y));
  if (settings) node.settings = { ...node.settings, ...settings };
  return { graph: { ...graph, nodes: [...graph.nodes, node as GraphNode] }, id };
}

/** Removes nodes and every wire touching them. */
export function removeNodes(graph: Graph, ids: string[]): Graph {
  const gone = new Set(ids);
  return {
    ...graph,
    nodes: graph.nodes
      .filter((n) => !gone.has(n.id))
      .map((n) => {
        // A Prompt node forgets its edits for images that are gone.
        if (n.kind !== "prompt") return n;
        const edits = (n.settings as SettingsByKind["prompt"]).edits;
        if (!Object.keys(edits).some((k) => gone.has(k))) return n;
        const kept = Object.fromEntries(Object.entries(edits).filter(([k]) => !gone.has(k)));
        return { ...n, settings: { edits: kept } };
      }),
    wires: graph.wires.filter((w) => !gone.has(w.from.node) && !gone.has(w.to.node)),
  };
}

export function moveNodes(graph: Graph, ids: string[], dx: number, dy: number): Graph {
  if (!dx && !dy) return graph;
  const set = new Set(ids);
  return { ...graph, nodes: graph.nodes.map((n) => (set.has(n.id) ? { ...n, x: Math.round(n.x + dx), y: Math.round(n.y + dy) } : n)) };
}

export function updateSettings<K extends NodeKind>(graph: Graph, id: string, patch: Partial<SettingsByKind[K]>): Graph {
  return { ...graph, nodes: graph.nodes.map((n) => (n.id === id ? ({ ...n, settings: { ...n.settings, ...patch } } as GraphNode) : n)) };
}

export function wire(graph: Graph, from: PortRef, to: PortRef): EditResult {
  return connect(graph, from, to, nextId(graph, "w"));
}

export function removeWires(graph: Graph, ids: string[]): Graph {
  const gone = new Set(ids);
  return { ...graph, wires: graph.wires.filter((w) => !gone.has(w.id)) };
}

/** Wires going into one input port. */
export function wiresInto(graph: Graph, to: PortRef): string[] {
  return graph.wires.filter((w) => w.to.node === to.node && w.to.port === to.port).map((w) => w.id);
}

export function setView(graph: Graph, view: GraphView): Graph {
  return { ...graph, view: { x: view.x, y: view.y, zoom: Math.min(4, Math.max(0.1, view.zoom)) } };
}

export function rename(graph: Graph, name: string): Graph {
  return { ...graph, name: name.slice(0, LIMITS.name) };
}

/** Image nodes are laid out in columns of this many, this far apart. */
export const IMAGE_GRID = { rows: 4, dx: 290, dy: 330 } as const;

/**
 * Adds one Image node per file name, in columns of four going left from (x, y),
 * and wires each to the only Prompt node when there is exactly one. Stops at the image limit.
 */
export function addImages(graph: Graph, names: string[], x: number, y: number): { graph: Graph; added: string[]; wired: boolean; skipped: number } {
  let g = graph;
  const added: string[] = [];
  for (const name of names) {
    const i = added.length;
    const col = Math.floor(i / IMAGE_GRID.rows);
    const r = addNode(g, "image", x - col * IMAGE_GRID.dx, y + (i % IMAGE_GRID.rows) * IMAGE_GRID.dy, { name });
    if ("reason" in r) break;
    g = r.graph;
    added.push(r.id!);
  }
  const prompts = g.nodes.filter((n) => n.kind === "prompt");
  let wired = false;
  if (prompts.length === 1) {
    for (const id of added) {
      const r = wire(g, { node: id, port: "image" }, { node: prompts[0].id, port: "images" });
      if ("graph" in r) {
        g = r.graph;
        wired = true;
      }
    }
  }
  return { graph: g, added, wired, skipped: names.length - added.length };
}

/** Kinds offered in "Add node", with words to find them by. */
export const ADD_MENU: { kind: NodeKind; words: string }[] = [
  { kind: "image", words: "image picture screenshot view photo" },
  { kind: "look", words: "look style preset material" },
  { kind: "light", words: "light time sun sky day night" },
  { kind: "surroundings", words: "surroundings environment context site street garden" },
  { kind: "fittings", words: "fittings lamps lights notes material lock" },
  { kind: "prompt", words: "prompt text output copy" },
  { kind: "note", words: "note comment text reminder" },
];

export function searchAddMenu(query: string): NodeKind[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return ADD_MENU.filter((m) => {
    const hay = `${NODE_DEFS[m.kind].label.toLowerCase()} ${m.words}`;
    return words.every((w) => hay.includes(w));
  }).map((m) => m.kind);
}

/**
 * The starter graph for a new canvas: one Look, one Light and one Prompt,
 * wired, ready for images.
 */
export function starterGraph(): Graph {
  let g = emptyGraph("One look, many images");
  const add = <K extends NodeKind>(kind: K, x: number, y: number, s?: Partial<SettingsByKind[K]>) => {
    const r = addNode(g, kind, x, y, s);
    if ("graph" in r) g = r.graph;
    return r.id!;
  };
  const look = add("look", 340, 40);
  const light = add("light", 640, 40);
  const prompt = add("prompt", 940, 40);
  add("note", 40, 40, { text: "Drop screenshots on the canvas. Each image gets its own prompt with this look and light." });
  for (const [f, t] of [
    [look, light],
    [light, prompt],
  ]) {
    const r = wire(g, { node: f, port: "look" }, { node: t, port: "look" });
    if ("graph" in r) g = r.graph;
  }
  return g;
}
