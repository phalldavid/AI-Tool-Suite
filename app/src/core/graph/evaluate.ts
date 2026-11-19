// Runs a graph: walks the nodes in wire order and builds one prompt per image.
// Pure: no React, no DOM, no backend calls. A node is only worked out again when
// its own settings or something wired into it changed (cache by input hash).

import { findLibraryItem } from "../library";
import { joinContexts } from "../context";
import type { Preset } from "../types";
import type { Settings } from "../settings";
import { composeRenderPrompt, sceneFor } from "../render-prompt";
import { newViewPrompt, relightPrompt, wordsEditPrompt } from "../edit-prompts";
import { styleCopyPrompt } from "../../lib/lighting";
import { DEFAULT_FITTINGS } from "../../lib/fittings";
import type { FittingState } from "../../lib/fittings";
import type { LightScene } from "../../lib/lighting";
import { roomStarter } from "../../lib/room";
import { topoSort } from "./topo";
import { RUNNER_KINDS } from "./types";
import { INTERIOR_RELIGHT, LIGHTING, URBAN_RELIGHT, lightingText, parseDialTime } from "../prompt";
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
  /** Interior or exterior lighting, as the prompt used it. */
  scene: LightScene;
}

/** What a job does, and so which model it uses and how History files it. */
export type JobKind = "render" | "style" | "relight" | "view" | "edit";

/**
 * One picture to make. A render works on an Image node's picture; a chain step
 * (relight, new view, edit) works on the result of the job before it.
 */
export interface RenderJob {
  kind: JobKind;
  /** The node that makes this picture. */
  renderNodeId: string;
  /** Render: the Prompt node the text came from. Chain step: the source job's key. Style copy: the reference Image node. */
  promptNodeId: string;
  /** The Image node it all started from (for its name). */
  imageNodeId: string;
  /** Chain steps: the result this one works on. */
  sourceKey?: string;
  /** Style copy: the reference photo's Image node. */
  refImageNodeId?: string;
  /** Interior or exterior. */
  scene: LightScene;
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
    scene: sceneFor(preset, patch.scene ?? null),
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
          .map(({ p, from }): RenderJob => ({
            kind: "render",
            renderNodeId: id,
            promptNodeId: from,
            imageNodeId: p.imageNodeId,
            scene: p.scene,
            name: p.name,
            lookName: p.lookName,
            prompt: p.text,
            promptHash: hashText(p.text),
          }));
        break;
      }
      case "relight":
      case "view":
      case "edit": {
        const ups = into.filter((w) => w.to.port === "results").flatMap((w) => (outputs.get(w.from.node)?.ports[w.from.port] as RenderJob[] | undefined) ?? []);
        ports.results = ups.flatMap((u) => {
          const step = chainStep(node, u.scene);
          if (!step) return [];
          const src = resultKey(u);
          return [
            {
              kind: node.kind as JobKind,
              renderNodeId: id,
              promptNodeId: src,
              imageNodeId: u.imageNodeId,
              sourceKey: src,
              scene: u.scene,
              name: u.name,
              lookName: `${u.lookName} → ${step.label}`,
              prompt: step.prompt,
              // A new source picture means a new result, so the source's hash is part of this one.
              promptHash: hashText(`${step.prompt}|${u.promptHash}`),
            },
          ];
        });
        break;
      }
      case "style": {
        const s = node.settings as SettingsByKind["style"];
        const ref = (input("reference")[0] as ImageRef | undefined) ?? null;
        const imgs = input("images").filter((v): v is ImageRef => Boolean(v && "nodeId" in v));
        // The final text adds the picture's own shape when it renders (styleCopyPrompt's base).
        const dial = s.light === "reference" ? null : (lightingText(s.light) ?? "").replace(/\.$/, "").toLowerCase() || null;
        const prompt = styleCopyPrompt({ scene: s.scene, dialLight: dial });
        ports.results = ref
          ? imgs.map((img): RenderJob => ({
              kind: "style",
              renderNodeId: id,
              promptNodeId: ref.nodeId,
              imageNodeId: img.nodeId,
              refImageNodeId: ref.nodeId,
              scene: s.scene,
              name: img.name,
              lookName: `Style copy of ${ref.name || "the reference"}`,
              prompt,
              promptHash: hashText(`${prompt}|${ref.name}`),
            }))
          : [];
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

/** Every job in the graph, in wire order: a step always comes after the job it works on. */
export function allJobs(graph: Graph, outputs: EvalCache): RenderJob[] {
  const order = topoSort(graph) ?? graph.nodes.map((n) => n.id);
  const kinds = new Map(graph.nodes.map((n) => [n.id, n.kind]));
  return order.filter((id) => RUNNER_KINDS.includes(kinds.get(id)!)).flatMap((id) => (outputs.get(id)?.ports.results as RenderJob[] | undefined) ?? []);
}

const RELIGHT_LABELS = new Map([...LIGHTING, ...INTERIOR_RELIGHT, ...URBAN_RELIGHT].map((o) => [o.id, o.label]));

/** The prompt and a short label for a chain step, or null when it has nothing to do. */
function chainStep(node: GraphNode, scene: LightScene): { prompt: string; label: string } | null {
  if (node.kind === "relight") {
    const s = node.settings as SettingsByKind["relight"];
    const sc = s.scene === "auto" ? scene : s.scene;
    const dial = parseDialTime(s.lighting);
    return { prompt: relightPrompt(s.lighting, sc), label: `Relight, ${dial !== null ? s.lighting.slice(5) : RELIGHT_LABELS.get(s.lighting) ?? s.lighting}` };
  }
  if (node.kind === "view") {
    const s = node.settings as SettingsByKind["view"];
    return { prompt: newViewPrompt(s, scene === "interior"), label: `New view ${s.orbit > 0 ? "+" : ""}${s.orbit}°` };
  }
  if (node.kind === "edit") {
    const s = node.settings as SettingsByKind["edit"];
    const change = s.change.trim();
    return change ? { prompt: wordsEditPrompt(change), label: "Edit" } : null;
  }
  return null;
}
