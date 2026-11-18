// Node graph for the Advanced tab: types only. A wire carries settings, not pixels.
// Pure data, no React and no DOM, so the engine runs under Node's test runner.

import type { FittingState } from "../../lib/fittings";
import type { LightScene } from "../../lib/lighting";

export const GRAPH_FORMAT = "drs-graph";
export const GRAPH_VERSION = 1;

/** What a wire carries. Only matching types connect. */
export type WireType = "image" | "look" | "prompt" | "result";

/** Node kinds in stage 1. Render and Result come in stage 2. */
export type NodeKind = "image" | "look" | "light" | "surroundings" | "fittings" | "prompt" | "note";

export interface ImageSettings {
  /** File name of the picture; the picture itself stays in memory, not in the file. */
  name: string;
}

export interface LookSettings {
  /** Library look id, or null when none is picked yet. */
  presetId: string | null;
}

export interface LightSettings {
  /** A lighting card id (LIGHTING in core/prompt.ts) or a dial time "time:HH:MM". */
  lighting: string;
  /** "auto" follows the look. */
  scene: "auto" | LightScene;
}

export interface SurroundingsSettings {
  /** Site context ids from core/context.ts; "custom:..." is the user's own words. Empty keeps the model's surroundings. */
  contexts: string[];
}

export interface FittingsSettings {
  fittings: FittingState;
  /** null leaves the material lock as it comes in. */
  materialLock: boolean | null;
  /** Additional Notes free text. */
  notes: string;
}

export interface PromptSettings {
  /** The user's own wording, by Image node id. Replaces the built text for that image. */
  edits: Record<string, string>;
}

export interface NoteSettings {
  text: string;
}

export interface SettingsByKind {
  image: ImageSettings;
  look: LookSettings;
  light: LightSettings;
  surroundings: SurroundingsSettings;
  fittings: FittingsSettings;
  prompt: PromptSettings;
  note: NoteSettings;
}

export interface GraphNode<K extends NodeKind = NodeKind> {
  id: string;
  kind: K;
  /** Canvas position in px. */
  x: number;
  y: number;
  settings: SettingsByKind[K];
}

export interface PortRef {
  node: string;
  port: string;
}

export interface Wire {
  id: string;
  from: PortRef;
  to: PortRef;
}

export interface GraphView {
  x: number;
  y: number;
  zoom: number;
}

export interface Graph {
  name: string;
  nodes: GraphNode[];
  wires: Wire[];
  view: GraphView;
}

/** Limits for a graph, checked on load and before adding. */
export const LIMITS = {
  nodes: 200,
  wires: 600,
  images: 30,
  /** Longest free text (notes, prompt edits). */
  text: 4000,
  /** Longest name or id-like string. */
  name: 200,
  contexts: 12,
  /** Largest graph file accepted, in characters. */
  fileChars: 2_000_000,
} as const;

export const DEFAULT_VIEW: GraphView = { x: 0, y: 0, zoom: 1 };
