// Evaluation order (topological sort) and loop checks.

import type { Graph } from "./types";

/**
 * Node ids in an order where every node comes after the nodes that feed it.
 * Null when the wires make a loop. Ties keep the order the nodes are listed in,
 * so the result is stable.
 */
export function topoSort(graph: Pick<Graph, "nodes" | "wires">): string[] | null {
  const ids = graph.nodes.map((n) => n.id);
  const known = new Set(ids);
  const indeg = new Map<string, number>(ids.map((id) => [id, 0]));
  const next = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const w of graph.wires) {
    if (!known.has(w.from.node) || !known.has(w.to.node)) continue;
    next.get(w.from.node)!.push(w.to.node);
    indeg.set(w.to.node, indeg.get(w.to.node)! + 1);
  }
  const order: string[] = [];
  const ready = ids.filter((id) => indeg.get(id) === 0);
  while (ready.length) {
    const id = ready.shift()!;
    order.push(id);
    for (const to of next.get(id)!) {
      const d = indeg.get(to)! - 1;
      indeg.set(to, d);
      if (d === 0) ready.push(to);
    }
  }
  return order.length === ids.length ? order : null;
}

/** True when a new wire from `from` to `to` would close a loop. */
export function wouldLoop(graph: Pick<Graph, "wires">, from: string, to: string): boolean {
  if (from === to) return true;
  // A loop appears when `from` can already be reached from `to`.
  const seen = new Set<string>();
  const stack = [to];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === from) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const w of graph.wires) if (w.from.node === id) stack.push(w.to.node);
  }
  return false;
}
