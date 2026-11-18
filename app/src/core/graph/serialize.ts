// Graph to a plain JSON file the owner can read, back up and share.
// Holds file names and settings only: no image data and no API keys.

import { GRAPH_FORMAT, GRAPH_VERSION } from "./types";
import type { Graph } from "./types";

export function graphToJson(graph: Graph): object {
  return {
    format: GRAPH_FORMAT,
    version: GRAPH_VERSION,
    name: graph.name,
    view: { x: graph.view.x, y: graph.view.y, zoom: graph.view.zoom },
    nodes: graph.nodes.map((n) => ({ id: n.id, kind: n.kind, x: Math.round(n.x), y: Math.round(n.y), settings: n.settings })),
    wires: graph.wires.map((w) => ({ id: w.id, from: { node: w.from.node, port: w.from.port }, to: { node: w.to.node, port: w.to.port } })),
  };
}

export function serializeGraph(graph: Graph): string {
  return JSON.stringify(graphToJson(graph), null, 2) + "\n";
}

/** File name for a saved graph, from its name. */
export function graphFileName(graph: Graph): string {
  const base = graph.name.replace(/[^\p{L}\p{N} _-]+/gu, "").trim().replace(/\s+/g, "-") || "graph";
  return `${base.slice(0, 60)}.graph.json`;
}
