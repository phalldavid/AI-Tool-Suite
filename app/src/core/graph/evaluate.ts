// Runs a graph: walks the nodes in wire order and builds one prompt per image.
// Pure: no React, no DOM, no backend calls. A node is only worked out again when
// its own settings or something wired into it changed (cache by input hash).

import { findLibraryItem } from "../library";
import { joinContexts } from "../context";
import type { Preset } from "../types";
import type { Settings } from "../settings";
import { composeRenderPrompt } from "../render-prompt";
import { DEFAULT_FITTINGS } from "../../lib/fittings";
import type { FittingState } from "../../lib/fittings";
import type { LightScene } from "../../lib/lighting";
import { roomStarter } from "../../lib/room";
import { topoSort } from "./topo";
import type { Graph, GraphNode, SettingsByKind } from "./types";

/** Same id as DEFAULT_LOOK in actions.ts (the Render tab's first look). */
export const GRAPH_DEFAULT_LOOK = "ext-mansion-tropical";

/** Render tab settings the graph does not set itself. Take them from Settings. */
export type EvalDefaults = Pick<Settings, "dynamic" | "lineStrength" | "look" | "materialLock" | "boundaryLock" | "avoid"> & {
  /** Sentences from the Additional Notes chips, already resolved. */
  noteLines?: string[];
};

export function defaultsFromSettings(s: Settings, noteLines: string[] = []): EvalDefaults {
  return {
    dynamic: s.dynamic,
    lineStrength: s.lineStrength,
    look: s.look,
    materialLock: s.materialLock,
    boundaryLock: s.boundaryLock,
    avoid: s.avoid,
    noteLines,
  };
}

/** What an Image node sends. */
export interface ImageRef {
  nodeId: string;
  name: string;
}

/** Look settings on a wire. Each node downstream overrides what it sets. */
export interface LookPatch {
  presetId?: string;
  lighting?: string;
  /** null follows the look (interior look, interior light). */
  scene?: LightScene | null;
  contexts?: string[];
  fittings?: FittingState;
  materialLock?: boolean;
  notes?: string;
}

export interface PromptItem {
  imageNodeId: string;
  /** Image file name. */
  name: string;
  lookId: string;
  lookName: string;
  /** True when the look came from the file name (or the default), not a Look node. */
  guessed: boolean;
  /** The built text. */
  built: string;
  /** What to use: the user's edit if there is one, else the built text. */
  text: string;
  edited: boolean;
  /** Building-type words taken out of the look's style. */
  removed: string[];
}

/** One render to make: a prompt for one image, through one Render node. */
export interface RenderJob {
  renderNodeId: string;
  /** The Prompt node the text came from (one Render node can take several). */
  promptNodeId: string;
  imageNodeId: string;
  /** Image file name. */
  name: string;
  lookName: string;
  prompt: string;
  /** Hash of the prompt: a finished result with the same hash is not rendered (or paid for) again. */
  promptHash: string;
}

export type PortValue = ImageRef | LookPatch | PromptItem[] | RenderJob[];

/** Where a Render node keeps its result for one image through one Prompt node. */
export function resultKey(job: Pick<RenderJob, "renderNodeId" | "promptNodeId" | "imageNodeId">): string {
  return `${job.renderNodeId}|${job.promptNodeId}|${job.imageNodeId}`;
}

export interface NodeOutput {
  key: string;
  ports: Record<string, PortValue>;
}

export type EvalCache = Map<string, NodeOutput>;

export type EvalResult =
  | { ok: true; outputs: EvalCache; recomputed: string[] }
  | { ok: false; error: string };

// ---------- hashing ----------

function fnv(s: string, seed: number): string {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** Short, stable hash of a string (64 bits from two seeds). */
export function hashText(s: string): string {
  return fnv(s, 0x811c9dc5) + fnv(s, 0x01234567);
}

/** JSON with sorted keys, so the same settings always give the same hash. */
export function stableJson(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map(stableJson).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .sort()
    .filter((k) => o[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${stableJson(o[k])}`)
    .join(",")}}`;
}

// ---------- nodes ----------

function lookPatchOf(node: GraphNode, incoming: LookPatch | undefined): LookPatch {
  const base: LookPatch = { ...(incoming ?? {}) };
  switch (node.kind) {
    case "look": {
      const s = node.settings as SettingsByKind["look"];
      return s.presetId ? { presetId: s.presetId } : {};
    }
    case "light": {
      const s = node.settings as SettingsByKind["light"];
      return { ...base, lighting: s.lighting, scene: s.scene === "auto" ? null : s.scene };
    }
    case "surroundings": {
      const s = node.settings as SettingsByKind["surroundings"];
      return { ...base, contexts: [...s.contexts] };
    }
    case "fittings": {
      const s = node.settings as SettingsByKind["fittings"];
      const out: LookPatch = { ...base, fittings: { ...s.fittings, types: [...s.fittings.types] } };
      if (s.materialLock !== null) out.materialLock = s.materialLock;
      if (s.notes.trim()) out.notes = s.notes;
      return out;
    }
  }
  return base;
}

/** The look a single image gets: the wired one, else a room guess from its name, else the default. */
export function lookFor(name: string, patch: LookPatch): { preset: Preset; guessed: boolean } {
  const guessed = !patch.presetId;
  const id = patch.presetId ?? roomStarter(name) ?? GRAPH_DEFAULT_LOOK;
  const item = findLibraryItem(id) ?? findLibraryItem(GRAPH_DEFAULT_LOOK)!;
  return {
    guessed,
    preset: {
      id: item.id,
      name: item.name,
      projectType: item.projectType,
      lighting: patch.lighting ?? item.lighting,
      environment: patch.contexts ? joinContexts(patch.contexts) : item.environment,
      style: item.style,
    },
  };
}

/** The Render tab prompt for one image with these look settings. */
export function promptForImage(img: ImageRef, patch: LookPatch, d: EvalDefaults, edit?: string): PromptItem {
  const { preset, guessed } = lookFor(img.name, patch);
  const fittings: Record<LightScene, FittingState> = patch.fittings
    ? { interior: patch.fittings, exterior: patch.fittings }
    : { interior: DEFAULT_FITTINGS.interior, exterior: DEFAULT_FITTINGS.exterior };
  const built = composeRenderPrompt({
    preset,
    lightScene: patch.scene ?? null,
    fittings,
    dynamic: d.dynamic,
    sunLine: null,
    hasLinePass: false,
    lineStrength: d.lineStrength,
    look: d.look,
    materialLock: patch.materialLock ?? d.materialLock,
    boundaryLock: d.boundaryLock,
    avoid: d.avoid,
    noteLines: d.noteLines ?? [],
    notes: patch.notes ?? "",
  });
  const edited = typeof edit === "string" && edit.trim().length > 0;
  return {
    imageNodeId: img.nodeId,
    name: img.name,
    lookId: preset.id,
    lookName: preset.name,
    guessed,
    built: built.prompt,
    text: edited ? edit! : built.prompt,
    edited,
    removed: built.removed,
  };
}

// ---------- graph ----------

/**
 * Work out every node. Pass the `outputs` of the last run as `cache` so only
 * changed nodes are worked out again; `recomputed` lists them.
 */
export function evaluateGraph(graph: Graph, defaults: EvalDefaults, cache?: EvalCache): EvalResult {
  const order = topoSort(graph);
  if (!order) return { ok: false, error: "The wires make a loop." };
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const outputs: EvalCache = new Map();
  const recomputed: string[] = [];
  const defaultsKey = stableJson(defaults);

  for (const id of order) {
    const node = byId.get(id)!;
    const into = graph.wires.filter((w) => w.to.node === id);
    const inKeys = into.map((w) => [w.to.port, w.from.node, w.from.port, outputs.get(w.from.node)?.key ?? ""]);
    const key = hashText(stableJson({ kind: node.kind, settings: node.settings, in: inKeys, d: node.kind === "prompt" ? defaultsKey : "" }));
    const old = cache?.get(id);
    if (old && old.key === key) {
      outputs.set(id, old);
      continue;
    }
    recomputed.push(id);
    const input = (port: string) => into.filter((w) => w.to.port === port).map((w) => outputs.get(w.from.node)?.ports[w.from.port]);
    const ports: Record<string, PortValue> = {};
    switch (node.kind) {
      case "image":
        ports.image = { nodeId: id, name: (node.settings as SettingsByKind["image"]).name };
        break;
      case "look":
      case "light":
      case "surroundings":
      case "fittings":
        ports.look = lookPatchOf(node, input("look")[0] as LookPatch | undefined);
        break;
      case "prompt": {
        const patch = (input("look")[0] as LookPatch | undefined) ?? {};
        const edits = (node.settings as SettingsByKind["prompt"]).edits;
        const images = input("images").filter((v): v is ImageRef => Boolean(v && "nodeId" in v));
        ports.prompts = images.map((img) => promptForImage(img, patch, defaults, edits[img.nodeId]));
        break;
      }
      case "render": {
        ports.results = into
          .filter((w) => w.to.port === "prompts")
          .flatMap((w) => ((outputs.get(w.from.node)?.ports[w.from.port] as PromptItem[] | undefined) ?? []).map((p) => ({ p, from: w.from.node })))
          .map(({ p, from }) => ({
          renderNodeId: id,
          promptNodeId: from,
          imageNodeId: p.imageNodeId,
          name: p.name,
          lookName: p.lookName,
          prompt: p.text,
          promptHash: hashText(p.text),
        }));
        break;
      }
      case "result":
        // Not an output port: the jobs this node shows, for the canvas to read.
        ports.shown = (input("results")[0] as RenderJob[] | undefined) ?? [];
        break;
      case "note":
        break;
    }
    outputs.set(id, { key, ports });
  }
  return { ok: true, outputs, recomputed };
}

/** Every prompt in the graph, Prompt nodes in list order. */
export function allPrompts(graph: Graph, outputs: EvalCache): PromptItem[] {
  return graph.nodes.filter((n) => n.kind === "prompt").flatMap((n) => (outputs.get(n.id)?.ports.prompts as PromptItem[] | undefined) ?? []);
}

/** Every render job in the graph, Render nodes in list order. */
export function allJobs(graph: Graph, outputs: EvalCache): RenderJob[] {
  return graph.nodes.filter((n) => n.kind === "render").flatMap((n) => (outputs.get(n.id)?.ports.results as RenderJob[] | undefined) ?? []);
}
