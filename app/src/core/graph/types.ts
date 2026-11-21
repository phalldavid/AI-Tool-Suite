// Node graph for the Advanced tab: types only. A wire carries settings, not pixels.
// Pure data, no React and no DOM, so the engine runs under Node's test runner.

import type { FittingState } from "../../lib/fittings";
import type { LightScene } from "../../lib/lighting";

export const GRAPH_FORMAT = "drs-graph";
export const GRAPH_VERSION = 1;

/** What a wire carries. Only matching types connect. */
export type WireType = "image" | "look" | "prompt" | "result";

/** Node kinds. Render and Result arrived in stage 2. */
export type NodeKind = "image" | "look" | "light" | "surroundings" | "fittings" | "prompt" | "note" | "render" | "result" | "relight" | "view" | "edit" | "style" | "batch";

/** Nodes that make pictures (and cost money): Render, and the steps that work on a render. */
export const RUNNER_KINDS: NodeKind[] = ["render", "batch", "style", "relight", "view", "edit"];

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

/** Render: no settings of its own; the backend and model come from Settings. */
export type RenderSettings = Record<string, never>;

/** Result: shows what the Render node wired into it made. */
export type ResultSettings = Record<string, never>;

/** Relight a finished render (Edit tab, Relight). */
export interface RelightSettings {
  /** A relight id (time of day, interior or street presets) or a dial time "time:HH:MM". */
  lighting: string;
  /** "auto" follows the render's look. */
  scene: "auto" | LightScene;
}

/** A new camera on a finished render (Edit tab, New view, Move camera). */
export interface ViewSettings {
  /** Degrees around the building; + is to the right. */
  orbit: number;
  /** Looking down, 0 = eye level. */
  tilt: number;
  lensMm: number;
  distanceM: number;
}

/** A change in words for the whole picture. Painted spot edits stay on the Edit tab. */
export interface EditSettings {
  change: string;
}

/** Style copy: a screenshot made to look like a reference photo (Edit tab, Style copy). */
export interface StyleSettings {
  scene: LightScene;
  /** "reference" copies the light of the photo; otherwise a light id or dial time. */
  light: string;
}

/** Batch render: every picture wired in is rendered with this one master prompt. */
export interface BatchSettings {
  master: string;
}

export interface SettingsByKind {
  image: ImageSettings;
  look: LookSettings;
  light: LightSettings;
  surroundings: SurroundingsSettings;
  fittings: FittingsSettings;
  prompt: PromptSettings;
  note: NoteSettings;
  render: RenderSettings;
  result: ResultSettings;
  relight: RelightSettings;
  view: ViewSettings;
  edit: EditSettings;
  style: StyleSettings;
  batch: BatchSettings;
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
  /** Longest master prompt (the AI-written ones run to about 900 words). */
  master: 12000,
  /** Longest name or id-like string. */
  name: 200,
  contexts: 12,
  /** Largest graph file accepted, in characters. */
  fileChars: 2_000_000,
} as const;

export const DEFAULT_VIEW: GraphView = { x: 0, y: 0, zoom: 1 };
