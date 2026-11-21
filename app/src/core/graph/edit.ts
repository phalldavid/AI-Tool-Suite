// Canvas edits as pure functions: each takes a graph and returns a new one
// (or a plain reason why not). The canvas keeps every result for undo.

import { NODE_DEFS, makeNode } from "./nodes";
import { connect } from "./wires";
import { inputPort, outputPort } from "./nodes";
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
  return connect(graph, from, to, nextId(graph, "w"), true);
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
  { kind: "render", words: "render run image ai make generate" },
  { kind: "batch", words: "batch render all images one master prompt same prompt many" },
  { kind: "result", words: "result output picture before after" },
  { kind: "relight", words: "relight light time night day sky change light" },
  { kind: "view", words: "new view camera angle orbit multi view move" },
  { kind: "edit", words: "edit change words fix add remove" },
  { kind: "style", words: "style copy reference photo match mood" },
];

/** Kinds that match every word; ones whose name matches come first, so Enter picks what you typed. */
export function searchAddMenu(query: string): NodeKind[] {
  const q = query.toLowerCase().trim();
  const words = q.split(/\s+/).filter(Boolean);
  const score = (label: string) => (!q ? 0 : label.startsWith(q) ? 3 : label.includes(q) ? 2 : words.every((w) => label.includes(w)) ? 1 : 0);
  return ADD_MENU.map((m, i) => ({ m, i, label: NODE_DEFS[m.kind].label.toLowerCase() }))
    .filter(({ m, label }) => words.every((w) => `${label} ${m.words}`.includes(w)))
    .sort((a, b) => score(b.label) - score(a.label) || a.i - b.i)
    .map(({ m }) => m.kind);
}

/**
 * Copies nodes (Ctrl D). Wires between the copied nodes are copied too. With
 * `keepInputs`, wires coming in from other nodes are copied as well, where the
 * input takes another wire. Returns the new ids in the same order.
 */
export function duplicateNodes(graph: Graph, ids: string[], dx = 40, dy = 40, keepInputs = false): { graph: Graph; ids: string[] } | { reason: string } {
  const src = graph.nodes.filter((n) => ids.includes(n.id));
  if (!src.length) return { graph, ids: [] };
  if (graph.nodes.length + src.length > LIMITS.nodes) return { reason: `A graph can have at most ${LIMITS.nodes} nodes.` };
  const imgs = src.filter((n) => n.kind === "image").length;
  if (imgs && graph.nodes.filter((n) => n.kind === "image").length + imgs > LIMITS.images) return { reason: `A graph can have at most ${LIMITS.images} images.` };
  let g = graph;
  const map = new Map<string, string>();
  for (const n of src) {
    const id = nextId(g, n.kind);
    map.set(n.id, id);
    const settings = JSON.parse(JSON.stringify(n.settings)) as GraphNode["settings"];
    g = { ...g, nodes: [...g.nodes, { ...n, id, x: Math.round(n.x + dx), y: Math.round(n.y + dy), settings } as GraphNode] };
  }
  // Prompt edits follow copied images to their copies.
  g = {
    ...g,
    nodes: g.nodes.map((n) => {
      if (n.kind !== "prompt" || ![...map.values()].includes(n.id)) return n;
      const edits = (n.settings as SettingsByKind["prompt"]).edits;
      return { ...n, settings: { edits: Object.fromEntries(Object.entries(edits).map(([k, v]) => [map.get(k) ?? k, v])) } };
    }),
  };
  for (const w of graph.wires) {
    const from = map.get(w.from.node);
    const to = map.get(w.to.node);
    if (to && (from || keepInputs)) {
      const r = connect(g, { node: from ?? w.from.node, port: w.from.port }, { node: to, port: w.to.port }, nextId(g, "w"));
      if ("graph" in r) g = r.graph;
    }
  }
  return { graph: g, ids: src.map((n) => map.get(n.id)!) };
}

/** Wires touching these nodes, for "Disconnect". */
export function wiresOf(graph: Graph, ids: string[]): string[] {
  const set = new Set(ids);
  return graph.wires.filter((w) => set.has(w.from.node) || set.has(w.to.node)).map((w) => w.id);
}

/**
 * Ctrl V: puts copied nodes (and the wires between them) into the graph, with
 * new ids, their top-left corner at (x, y). Returns old and new ids in order.
 */
export function pasteNodes(graph: Graph, slice: Pick<Graph, "nodes" | "wires">, x: number, y: number): { graph: Graph; from: string[]; ids: string[] } | { reason: string } {
  if (!slice.nodes.length) return { graph, from: [], ids: [] };
  if (graph.nodes.length + slice.nodes.length > LIMITS.nodes) return { reason: `A graph can have at most ${LIMITS.nodes} nodes.` };
  const imgs = slice.nodes.filter((n) => n.kind === "image").length;
  if (imgs && graph.nodes.filter((n) => n.kind === "image").length + imgs > LIMITS.images) return { reason: `A graph can have at most ${LIMITS.images} images.` };
  const minX = Math.min(...slice.nodes.map((n) => n.x));
  const minY = Math.min(...slice.nodes.map((n) => n.y));
  let g = graph;
  const map = new Map<string, string>();
  for (const n of slice.nodes) {
    const id = nextId(g, n.kind);
    map.set(n.id, id);
    const settings = JSON.parse(JSON.stringify(n.settings)) as GraphNode["settings"];
    if (n.kind === "prompt") {
      const edits = (settings as SettingsByKind["prompt"]).edits;
      (settings as SettingsByKind["prompt"]).edits = Object.fromEntries(Object.entries(edits).filter(([k]) => slice.nodes.some((m) => m.id === k)));
    }
    g = { ...g, nodes: [...g.nodes, { ...n, id, x: Math.round(x + n.x - minX), y: Math.round(y + n.y - minY), settings } as GraphNode] };
  }
  g = {
    ...g,
    nodes: g.nodes.map((n) => {
      if (n.kind !== "prompt" || ![...map.values()].includes(n.id)) return n;
      const edits = (n.settings as SettingsByKind["prompt"]).edits;
      return { ...n, settings: { edits: Object.fromEntries(Object.entries(edits).map(([k, v]) => [map.get(k) ?? k, v])) } };
    }),
  };
  for (const w of slice.wires) {
    const from = map.get(w.from.node);
    const to = map.get(w.to.node);
    if (!from || !to) continue;
    const r = connect(g, { node: from, port: w.from.port }, { node: to, port: w.to.port }, nextId(g, "w"));
    if ("graph" in r) g = r.graph;
  }
  return { graph: g, from: slice.nodes.map((n) => n.id), ids: slice.nodes.map((n) => map.get(n.id)!) };
}

/** Drop a loose node onto a wire: the wire is cut and re-plugged through the node (Blender's "auto-offset" insert).
 *  The node needs a free input that takes what the wire carries and an output the wire's target accepts. */
export function insertOnWire(graph: Graph, nodeId: string, wireId: string): EditResult {
  const node = graph.nodes.find((n) => n.id === nodeId);
  const w = graph.wires.find((x) => x.id === wireId);
  if (!node || !w) return { reason: "That wire or node no longer exists." };
  if (graph.wires.some((x) => x.from.node === nodeId || x.to.node === nodeId)) return { reason: "Only a node with no wires can be dropped onto a wire." };
  const src = graph.nodes.find((n) => n.id === w.from.node);
  const dst = graph.nodes.find((n) => n.id === w.to.node);
  if (!src || !dst) return { reason: "That wire no longer exists." };
  const carries = outputPort(src.kind, w.from.port)?.type;
  const base = removeWires(graph, [wireId]);
  for (const inp of NODE_DEFS[node.kind].inputs) {
    if (inp.type !== carries) continue;
    for (const out of NODE_DEFS[node.kind].outputs) {
      const a = connect(base, w.from, { node: nodeId, port: inp.id }, nextId(base, "w"), true);
      if ("reason" in a) continue;
      const b = connect(a.graph, { node: nodeId, port: out.id }, w.to, nextId(a.graph, "w"), true);
      if ("graph" in b) return b;
    }
  }
  return { reason: `${NODE_DEFS[node.kind].label} does not fit on this wire.` };
}
