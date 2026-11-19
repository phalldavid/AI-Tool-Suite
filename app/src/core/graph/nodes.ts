// Node definitions: ports and default settings for each kind.

import { DEFAULT_FITTINGS } from "../../lib/fittings";
import type { GraphNode, NodeKind, SettingsByKind, WireType } from "./types";

export interface PortDef {
  id: string;
  type: WireType;
  /** Plain name, for screen readers and the "why refused" message. */
  label: string;
  /** An input port that takes more than one wire. Output ports always fan out. */
  multi?: boolean;
}

export interface NodeDef<K extends NodeKind = NodeKind> {
  kind: K;
  label: string;
  inputs: PortDef[];
  outputs: PortDef[];
  defaults: () => SettingsByKind[K];
}

const lookIn: PortDef = { id: "look", type: "look", label: "Look settings in" };
const resultsIn: PortDef = { id: "results", type: "result", label: "Results in" };
const resultsOut: PortDef = { id: "results", type: "result", label: "Results out" };
const lookOut: PortDef = { id: "look", type: "look", label: "Look settings out" };

export const NODE_DEFS: { [K in NodeKind]: NodeDef<K> } = {
  image: {
    kind: "image",
    label: "Image",
    inputs: [],
    outputs: [{ id: "image", type: "image", label: "Image out" }],
    defaults: () => ({ name: "" }),
  },
  look: {
    kind: "look",
    label: "Look",
    inputs: [],
    outputs: [lookOut],
    defaults: () => ({ presetId: null }),
  },
  light: {
    kind: "light",
    label: "Light",
    inputs: [lookIn],
    outputs: [lookOut],
    defaults: () => ({ lighting: "morning", scene: "auto" }),
  },
  surroundings: {
    kind: "surroundings",
    label: "Surroundings",
    inputs: [lookIn],
    outputs: [lookOut],
    defaults: () => ({ contexts: [] }),
  },
  fittings: {
    kind: "fittings",
    label: "Fittings and notes",
    inputs: [lookIn],
    outputs: [lookOut],
    defaults: () => ({ fittings: { ...DEFAULT_FITTINGS.interior, types: [] }, materialLock: null, notes: "" }),
  },
  prompt: {
    kind: "prompt",
    label: "Prompt",
    inputs: [
      { id: "images", type: "image", label: "Images in", multi: true },
      { id: "look", type: "look", label: "Look settings in" },
    ],
    outputs: [{ id: "prompts", type: "prompt", label: "Prompt text out" }],
    defaults: () => ({ edits: {} }),
  },
  note: {
    kind: "note",
    label: "Note",
    inputs: [],
    outputs: [],
    defaults: () => ({ text: "" }),
  },
  render: {
    kind: "render",
    label: "Render",
    inputs: [{ id: "prompts", type: "prompt", label: "Prompt text in", multi: true }],
    outputs: [{ id: "results", type: "result", label: "Results out" }],
    defaults: () => ({}),
  },
  result: {
    kind: "result",
    label: "Result",
    inputs: [{ id: "results", type: "result", label: "Results in" }],
    outputs: [],
    defaults: () => ({}),
  },
  relight: {
    kind: "relight",
    label: "Relight",
    inputs: [resultsIn],
    outputs: [resultsOut],
    defaults: () => ({ lighting: "blue-hour", scene: "auto" }),
  },
  view: {
    kind: "view",
    label: "New view",
    inputs: [resultsIn],
    outputs: [resultsOut],
    defaults: () => ({ orbit: 35, tilt: 15, lensMm: 35, distanceM: 35 }),
  },
  edit: {
    kind: "edit",
    label: "Edit",
    inputs: [resultsIn],
    outputs: [resultsOut],
    defaults: () => ({ change: "" }),
  },
  style: {
    kind: "style",
    label: "Style copy",
    inputs: [
      { id: "images", type: "image", label: "Images in", multi: true },
      { id: "reference", type: "image", label: "Reference photo in" },
    ],
    outputs: [resultsOut],
    defaults: () => ({ scene: "exterior", light: "reference" }),
  },
};

export const NODE_KINDS = Object.keys(NODE_DEFS) as NodeKind[];

export function isNodeKind(v: unknown): v is NodeKind {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(NODE_DEFS, v);
}

export function inputPort(kind: NodeKind, port: string): PortDef | undefined {
  return NODE_DEFS[kind].inputs.find((p) => p.id === port);
}

export function outputPort(kind: NodeKind, port: string): PortDef | undefined {
  return NODE_DEFS[kind].outputs.find((p) => p.id === port);
}

/** A new node with default settings. */
export function makeNode<K extends NodeKind>(kind: K, id: string, x = 0, y = 0): GraphNode<K> {
  return { id, kind, x, y, settings: NODE_DEFS[kind].defaults() } as GraphNode<K>;
}
