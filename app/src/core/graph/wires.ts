// Which wires are allowed, and a plain reason when one is refused.

import { NODE_DEFS, inputPort, outputPort } from "./nodes";
import { wouldLoop } from "./topo";
import { LIMITS } from "./types";
import type { Graph, PortRef, Wire, WireType } from "./types";

const CARRIES: Record<WireType, string> = {
  image: "an image",
  look: "look settings",
  prompt: "prompt text",
  result: "a result",
};

export type WireCheck = { ok: true } | { ok: false; reason: string };

/** Can `from` (an output port) be wired to `to` (an input port)? */
export function canConnect(graph: Pick<Graph, "nodes" | "wires">, from: PortRef, to: PortRef): WireCheck {
  const a = graph.nodes.find((n) => n.id === from.node);
  const b = graph.nodes.find((n) => n.id === to.node);
  if (!a || !b) return { ok: false, reason: "One of these nodes no longer exists." };
  if (a.id === b.id) return { ok: false, reason: "A node cannot be wired to itself." };
  const out = outputPort(a.kind, from.port);
  if (!out) return { ok: false, reason: `${NODE_DEFS[a.kind].label} has no output called "${from.port}".` };
  const inp = inputPort(b.kind, to.port);
  if (!inp) return { ok: false, reason: `${NODE_DEFS[b.kind].label} has no input called "${to.port}".` };
  if (out.type !== inp.type) {
    return {
      ok: false,
      reason: `${NODE_DEFS[a.kind].label} sends ${CARRIES[out.type]}, but this ${NODE_DEFS[b.kind].label} input takes ${CARRIES[inp.type]}.`,
    };
  }
  const into = graph.wires.filter((w) => w.to.node === to.node && w.to.port === to.port);
  if (into.some((w) => w.from.node === from.node && w.from.port === from.port)) {
    return { ok: false, reason: "These two are already wired." };
  }
  if (!inp.multi && into.length) {
    return { ok: false, reason: `"${inp.label}" already has a wire. Remove it first.` };
  }
  if (graph.wires.length >= LIMITS.wires) return { ok: false, reason: `A graph can have at most ${LIMITS.wires} wires.` };
  if (wouldLoop(graph, from.node, to.node)) return { ok: false, reason: "This wire would make a loop." };
  return { ok: true };
}

/** The graph with the new wire, or the reason it was refused. Never changes `graph`. */
export function connect(graph: Graph, from: PortRef, to: PortRef, id: string): { graph: Graph } | { reason: string } {
  const check = canConnect(graph, from, to);
  if (!check.ok) return { reason: check.reason };
  const wire: Wire = { id, from: { ...from }, to: { ...to } };
  return { graph: { ...graph, wires: [...graph.wires, wire] } };
}
