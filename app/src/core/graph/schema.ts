// Strict reader for graph files. A graph file from outside is data, not
// instructions: unknown fields are dropped, sizes are limited, nothing in it runs.

import { findLibraryItem } from "../library";
import { CONTEXT_GROUPS } from "../context";
import { LIGHTING, parseDialTime } from "../prompt";
import { EXTERIOR_FITTINGS, INTERIOR_FITTINGS, KELVIN_OPTIONS, LEVELS } from "../../lib/fittings";
import type { FittingState } from "../../lib/fittings";
import { NODE_DEFS, isNodeKind } from "./nodes";
import { canConnect } from "./wires";
import { DEFAULT_VIEW, GRAPH_FORMAT, GRAPH_VERSION, LIMITS } from "./types";
import type { Graph, GraphNode, GraphView, NodeKind, SettingsByKind, Wire } from "./types";

export type ParseResult = { ok: true; graph: Graph; warnings: string[] } | { ok: false; error: string };

const ID = /^[A-Za-z0-9_-]{1,40}$/;

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Own property only, never something from the prototype chain. */
function get(o: Obj, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(o, key) ? o[key] : undefined;
}

export function isValidId(v: unknown): v is string {
  return typeof v === "string" && ID.test(v);
}

class Reader {
  warnings: string[] = [];
  private seen = new Set<string>();

  warn(msg: string): void {
    if (!this.seen.has(msg)) {
      this.seen.add(msg);
      this.warnings.push(msg);
    }
  }

  text(v: unknown, max: number, what: string): string {
    if (typeof v !== "string") return "";
    // Drop control characters except new lines and tabs.
    const clean = v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
    if (clean.length > max) {
      this.warn(`${what} was longer than ${max} characters and was cut.`);
      return clean.slice(0, max);
    }
    return clean;
  }

  num(v: unknown, min: number, max: number, fallback: number): number {
    return typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
  }
}

const LIGHT_IDS = new Set(["sketchup", ...LIGHTING.map((o) => o.id)]);
const CONTEXT_IDS = new Set(CONTEXT_GROUPS.flatMap((g) => g.items.map((c) => c.id)));
const FITTING_IDS = new Set([...INTERIOR_FITTINGS, ...EXTERIOR_FITTINGS].map((f) => f.id));
const KELVINS = new Set(KELVIN_OPTIONS.map((o) => o.k));

export function isLightingId(v: unknown): v is string {
  if (typeof v !== "string") return false;
  if (LIGHT_IDS.has(v)) return true;
  const t = parseDialTime(v);
  return t !== null && t < 24 && Number(v.slice(-2)) < 60;
}

function readFittings(r: Reader, v: unknown, base: FittingState): FittingState {
  const o = isObj(v) ? v : {};
  const types = Array.isArray(get(o, "types")) ? (get(o, "types") as unknown[]) : [];
  const kelvin = get(o, "kelvin");
  const level = get(o, "level");
  return {
    on: typeof get(o, "on") === "boolean" ? (get(o, "on") as boolean) : base.on,
    types: [...new Set(types.filter((t): t is string => typeof t === "string" && FITTING_IDS.has(t)))],
    other: r.text(get(o, "other"), 500, "A fittings note"),
    kelvin: typeof kelvin === "number" && KELVINS.has(kelvin) ? kelvin : base.kelvin,
    level: typeof level === "number" && Number.isInteger(level) && level >= 0 && level < LEVELS.length ? level : base.level,
  };
}

function readSettings<K extends NodeKind>(r: Reader, kind: K, raw: unknown): SettingsByKind[K] {
  const o = isObj(raw) ? raw : {};
  const d = NODE_DEFS[kind].defaults() as SettingsByKind[NodeKind];
  switch (kind) {
    case "image": {
      // Keep the file name only, never a folder path.
      const name = r.text(get(o, "name"), LIMITS.name, "An image name").split(/[\\/]/).pop() ?? "";
      return { name } as SettingsByKind[K];
    }
    case "look": {
      const id = get(o, "presetId");
      if (id === null || id === undefined) return { presetId: null } as SettingsByKind[K];
      if (typeof id === "string" && id.length <= LIMITS.name && findLibraryItem(id)) return { presetId: id } as SettingsByKind[K];
      r.warn("A Look node named a look that is not in the library; it was cleared.");
      return { presetId: null } as SettingsByKind[K];
    }
    case "light": {
      const dl = d as SettingsByKind["light"];
      const lighting = get(o, "lighting");
      const scene = get(o, "scene");
      if (lighting !== undefined && !isLightingId(lighting)) r.warn("A Light node had an unknown light; it was reset.");
      return {
        lighting: isLightingId(lighting) ? lighting : dl.lighting,
        scene: scene === "interior" || scene === "exterior" ? scene : "auto",
      } as SettingsByKind[K];
    }
    case "surroundings": {
      const list = Array.isArray(get(o, "contexts")) ? (get(o, "contexts") as unknown[]) : [];
      const out: string[] = [];
      for (const c of list) {
        if (typeof c !== "string") continue;
        if (CONTEXT_IDS.has(c)) out.push(c);
        else if (c.startsWith("custom:")) {
          // Commas separate picks in a look, so they cannot be inside one.
          const words = r.text(c.slice(7), LIMITS.name, "A surroundings note").replace(/,/g, " ").replace(/\s+/g, " ").trim();
          if (words) out.push(`custom:${words}`);
        } else r.warn("Unknown surroundings were dropped.");
      }
      const unique = [...new Set(out)];
      if (unique.length > LIMITS.contexts) r.warn(`Only the first ${LIMITS.contexts} surroundings were kept.`);
      return { contexts: unique.slice(0, LIMITS.contexts) } as SettingsByKind[K];
    }
    case "fittings": {
      const df = d as SettingsByKind["fittings"];
      const lock = get(o, "materialLock");
      return {
        fittings: readFittings(r, get(o, "fittings"), df.fittings),
        materialLock: typeof lock === "boolean" ? lock : null,
        notes: r.text(get(o, "notes"), LIMITS.text, "Notes"),
      } as SettingsByKind[K];
    }
    case "prompt": {
      const raw = get(o, "edits");
      const edits: Record<string, string> = {};
      if (isObj(raw)) {
        for (const key of Object.keys(raw).slice(0, LIMITS.images)) {
          const v = raw[key];
          if (isValidId(key) && typeof v === "string") edits[key] = r.text(v, LIMITS.text, "An edited prompt");
        }
      }
      return { edits } as SettingsByKind[K];
    }
    case "note":
      return { text: r.text(get(o, "text"), LIMITS.text, "A note") } as SettingsByKind[K];
  }
  return d as SettingsByKind[K];
}

function readView(r: Reader, v: unknown): GraphView {
  if (!isObj(v)) return { ...DEFAULT_VIEW };
  return {
    x: r.num(get(v, "x"), -1e6, 1e6, 0),
    y: r.num(get(v, "y"), -1e6, 1e6, 0),
    zoom: r.num(get(v, "zoom"), 0.1, 4, 1),
  };
}

/** Read a graph file (its text, or already parsed JSON). Never throws. */
export function parseGraph(input: unknown): ParseResult {
  let value = input;
  if (typeof input === "string") {
    if (input.length > LIMITS.fileChars) return { ok: false, error: "This graph file is too large." };
    try {
      value = JSON.parse(input);
    } catch {
      return { ok: false, error: "This file is not a graph: it is not valid JSON." };
    }
  }
  if (!isObj(value)) return { ok: false, error: "This file is not a graph." };
  if (get(value, "format") !== GRAPH_FORMAT) return { ok: false, error: "This file is not a David Render Studio graph." };
  const version = get(value, "version");
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) return { ok: false, error: "This graph file has no valid version." };
  if (version > GRAPH_VERSION) return { ok: false, error: "This graph was saved by a newer version of the app. Update the app to open it." };
  const rawNodes = get(value, "nodes");
  const rawWires = get(value, "wires") ?? [];
  if (!Array.isArray(rawNodes)) return { ok: false, error: "This graph file has no node list." };
  if (!Array.isArray(rawWires)) return { ok: false, error: "This graph file has a broken wire list." };
  if (rawNodes.length > LIMITS.nodes) return { ok: false, error: `This graph has ${rawNodes.length} nodes; the limit is ${LIMITS.nodes}.` };
  if (rawWires.length > LIMITS.wires) return { ok: false, error: `This graph has ${rawWires.length} wires; the limit is ${LIMITS.wires}.` };

  const r = new Reader();
  const nodes: GraphNode[] = [];
  const ids = new Set<string>();
  for (const raw of rawNodes) {
    if (!isObj(raw)) {
      r.warn("A broken node was dropped.");
      continue;
    }
    const id = get(raw, "id");
    const kind = get(raw, "kind");
    if (!isValidId(id)) {
      r.warn("A node without a valid id was dropped.");
      continue;
    }
    if (ids.has(id)) return { ok: false, error: `Two nodes share the id "${id}".` };
    if (!isNodeKind(kind)) {
      r.warn("Nodes of a kind this version does not know were dropped.");
      continue;
    }
    ids.add(id);
    nodes.push({
      id,
      kind,
      x: r.num(get(raw, "x"), -1e6, 1e6, 0),
      y: r.num(get(raw, "y"), -1e6, 1e6, 0),
      settings: readSettings(r, kind, get(raw, "settings")),
    } as GraphNode);
  }
  const images = nodes.filter((n) => n.kind === "image").length;
  if (images > LIMITS.images) return { ok: false, error: `This graph has ${images} images; the limit is ${LIMITS.images}.` };

  // Prompt edits only for images that are in this graph.
  for (const n of nodes) {
    if (n.kind !== "prompt") continue;
    const edits = (n.settings as SettingsByKind["prompt"]).edits;
    for (const key of Object.keys(edits)) {
      if (!nodes.some((m) => m.id === key && m.kind === "image")) delete edits[key];
    }
  }

  const wires: Wire[] = [];
  const wireIds = new Set<string>();
  for (const raw of rawWires) {
    const w = readWire(raw);
    if (!w || wireIds.has(w.id)) {
      r.warn("Broken wires were dropped.");
      continue;
    }
    const check = canConnect({ nodes, wires }, w.from, w.to);
    if (!check.ok) {
      r.warn(`A wire was dropped: ${check.reason}`);
      continue;
    }
    wireIds.add(w.id);
    wires.push(w);
  }

  return {
    ok: true,
    graph: {
      name: r.text(get(value, "name"), LIMITS.name, "The graph name").trim() || "Untitled graph",
      nodes,
      wires,
      view: readView(r, get(value, "view")),
    },
    warnings: r.warnings,
  };
}

function readWire(raw: unknown): Wire | null {
  if (!isObj(raw)) return null;
  const id = get(raw, "id");
  const from = get(raw, "from");
  const to = get(raw, "to");
  if (!isValidId(id) || !isObj(from) || !isObj(to)) return null;
  const fn = get(from, "node");
  const fp = get(from, "port");
  const tn = get(to, "node");
  const tp = get(to, "port");
  if (!isValidId(fn) || !isValidId(tn) || !isValidId(fp) || !isValidId(tp)) return null;
  return { id, from: { node: fn, port: fp }, to: { node: tn, port: tp } };
}
