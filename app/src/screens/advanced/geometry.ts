// Where nodes and ports sit on the canvas. Ports are at fixed offsets from the
// node's top-left corner, so wires are drawn without measuring the page.

import { NODE_DEFS } from "../../core/graph";
import type { GraphNode, GraphView, NodeKind } from "../../core/graph";

export const HEADER_H = 38;
export const PORT_TOP = 54;
export const PORT_GAP = 30;

const WIDTH: Partial<Record<NodeKind, number>> = { prompt: 380, note: 240, fittings: 290 };

export function nodeWidth(kind: NodeKind): number {
  return WIDTH[kind] ?? 270;
}

/** Height of the ports band under the header. */
export function portsHeight(kind: NodeKind): number {
  const rows = Math.max(NODE_DEFS[kind].inputs.length, NODE_DEFS[kind].outputs.length);
  return rows ? rows * PORT_GAP + 10 : 0;
}

/** Port centre in canvas units. */
export function portPoint(node: Pick<GraphNode, "kind" | "x" | "y">, port: string, side: "in" | "out"): { x: number; y: number } {
  const list = side === "in" ? NODE_DEFS[node.kind].inputs : NODE_DEFS[node.kind].outputs;
  const i = Math.max(0, list.findIndex((p) => p.id === port));
  return { x: node.x + (side === "in" ? 0 : nodeWidth(node.kind)), y: node.y + PORT_TOP + i * PORT_GAP };
}

/** A smooth wire from an output (left to right) to an input. */
export function wirePath(a: { x: number; y: number }, b: { x: number; y: number }): string {
  const dx = Math.max(60, Math.abs(b.x - a.x) / 2);
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
}

export function screenToWorld(view: GraphView, sx: number, sy: number): { x: number; y: number } {
  return { x: (sx - view.x) / view.zoom, y: (sy - view.y) / view.zoom };
}

/** Zoom by `factor` keeping the point under (sx, sy) still. */
export function zoomAt(view: GraphView, sx: number, sy: number, factor: number): GraphView {
  const zoom = Math.min(2.5, Math.max(0.2, view.zoom * factor));
  const k = zoom / view.zoom;
  return { zoom, x: sx - (sx - view.x) * k, y: sy - (sy - view.y) * k };
}

/** A view that shows every node inside a w x h box. `heightOf` gives measured heights when known. */
export function fitView(nodes: Pick<GraphNode, "id" | "kind" | "x" | "y">[], w: number, h: number, heightOf: (id: string) => number = () => 260): GraphView {
  if (!nodes.length || w <= 0 || h <= 0) return { x: 40, y: 40, zoom: 1 };
  const minX = Math.min(...nodes.map((n) => n.x));
  const minY = Math.min(...nodes.map((n) => n.y));
  const maxX = Math.max(...nodes.map((n) => n.x + nodeWidth(n.kind)));
  const maxY = Math.max(...nodes.map((n) => n.y + heightOf(n.id)));
  const pad = 48;
  const zoom = Math.min(1.25, Math.max(0.2, Math.min((w - pad * 2) / (maxX - minX), (h - pad * 2) / (maxY - minY))));
  return { zoom, x: (w - (maxX - minX) * zoom) / 2 - minX * zoom, y: pad - minY * zoom };
}
