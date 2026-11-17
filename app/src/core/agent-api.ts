// A small, pure API over the prompt builder, so scripts and AI assistants
// (through the MCP server in scripts/mcp-server.mjs) can do what the panel
// does without clicking: list presets, read the options, and build a prompt
// from plain settings. Nothing here touches the page, so it is not part of
// the app bundle unless something imports it.

import { CONTEXT_GROUPS, contextText } from "./context";
import { filterLibrary, libraryItems, matchesWords, searchWords, type LibItem } from "./library";
import {
  buildRenderPrompt,
  DEFAULT_AVOID,
  findOption,
  fixtureSettingsLine,
  INTERIOR_RELIGHT,
  LIGHTING,
  URBAN_RELIGHT,
  type FixtureSettings,
} from "./prompt";
import type { Preset, ProjectType } from "./types";

// ---------- View framing ----------

export interface ViewKind {
  id: string;
  /** one line that goes into the prompt */
  text: string;
  /** 35 mm-equivalent lens used when the caller gives none */
  focalLengthMm: number;
}

/** Framing lines for common interior and exterior views. */
export const VIEW_KINDS: ViewKind[] = [
  { id: "wide", text: "Framing: wide view that shows the whole room and how its parts sit together.", focalLengthMm: 24 },
  { id: "entry", text: "Framing: view from the doorway looking into the room, the far wall centred.", focalLengthMm: 24 },
  { id: "corridor", text: "Framing: long, narrow view looking down the room, strong depth, both side walls visible.", focalLengthMm: 24 },
  { id: "detail", text: "Framing: closer view of the main features and fittings, keeping every surface as modelled.", focalLengthMm: 35 },
  { id: "vanity", text: "Framing: view of the vanity, basin, mirror and wall lights, kept as modelled.", focalLengthMm: 35 },
  { id: "shower", text: "Framing: view into the shower area, showing wall tiles, fittings and glass screen.", focalLengthMm: 28 },
  { id: "tub", text: "Framing: view of the bathtub and the wall behind it, kept as modelled.", focalLengthMm: 28 },
  { id: "street", text: "Framing: eye-level view from the street, the building centred.", focalLengthMm: 35 },
  { id: "aerial-high", text: "Framing: high oblique view looking down on the whole site.", focalLengthMm: 24 },
];

/** Guess the view kind from an image file name such as "EXP_B03-2 Vanity.jpg". */
export function inferView(fileName: string): string | undefined {
  const name = fileName.toLowerCase();
  for (const v of VIEW_KINDS) {
    if (name.includes(v.id)) return v.id;
  }
  if (/shower/.test(name)) return "shower";
  return undefined;
}

// ---------- Presets ----------

export interface PresetSummary {
  id: string;
  name: string;
  scene: ProjectType;
  lighting: string;
  environment: string;
}

function summary(x: LibItem): PresetSummary {
  return { id: x.id, name: x.name, scene: x.projectType, lighting: x.lighting, environment: x.environment };
}

/** Search the preset library. Every word must appear in the name or style text. */
export function listPresets(opts: { query?: string; scene?: ProjectType; limit?: number } = {}): { total: number; items: PresetSummary[] } {
  const words = searchWords(opts.query ?? "");
  const hits = libraryItems().filter((x) => {
    if (opts.scene && x.projectType !== opts.scene) return false;
    return !words.length || matchesWords(`${x.name} ${x.style}`, words);
  });
  const limit = Math.max(1, Math.min(opts.limit ?? 25, 200));
  return { total: hits.length, items: hits.slice(0, limit).map(summary) };
}

/** Find one preset by exact id, exact name, or search words (first match). */
export function resolvePreset(idOrName: string): LibItem | undefined {
  const all = libraryItems();
  const key = idOrName.trim().toLowerCase();
  const exact = all.find((x) => x.id === key) ?? all.find((x) => x.name.toLowerCase() === key);
  if (exact) return exact;
  const words = searchWords(key);
  if (!words.length) return undefined;
  return all.find((x) => matchesWords(`${x.name} ${x.id}`, words));
}

// ---------- Options ----------

export function listOptions() {
  return {
    scenes: ["exterior", "interior", "aerial", "sketch"] as ProjectType[],
    lighting: [...LIGHTING, ...INTERIOR_RELIGHT, ...URBAN_RELIGHT].map((o) => ({ id: o.id, label: o.label, sub: o.sub ?? "" })),
    lightingTimes: 'Use "time:HH:MM" for an exact time, for example "time:17:30".',
    environments: CONTEXT_GROUPS.flatMap((g) => g.items.map((c) => ({ id: c.id, label: c.label, group: g.label }))),
    views: VIEW_KINDS.map((v) => ({ id: v.id, focalLengthMm: v.focalLengthMm })),
    fixtures: "Interior: led (ceiling downlights), strip (cove LED), cabinet (cabinet LED), kelvin (2700 to 6500).",
    presetCount: libraryItems().length,
  };
}

// ---------- Build a prompt ----------

export interface PromptSettings {
  /** preset id, exact name, or search words, for example "int-bathroom-khmer" */
  preset: string;
  /** replaces the preset's lighting; an id from listOptions().lighting */
  lighting?: string;
  /** replaces the preset's surroundings; comma-separated context ids */
  environment?: string;
  /** your own words; they win over the preset when they disagree */
  notes?: string;
  /** extra materials or details added to the end of the preset's style */
  styleExtra?: string;
  /** one of VIEW_KINDS; sets the framing line and the default lens */
  view?: string;
  /** lens override, 35 mm equivalent */
  focalLengthMm?: number;
  /** interior light fixtures switched on */
  fixtures?: Partial<Pick<FixtureSettings, "led" | "strip" | "cabinet" | "kelvin">>;
  look?: "photo" | "cgi";
  /** things to avoid, comma separated; defaults to the app's list */
  avoid?: string;
}

export interface BuiltPrompt {
  ok: true;
  presetId: string;
  presetName: string;
  prompt: string;
  words: number;
}

export interface PromptError {
  ok: false;
  error: string;
}

export function buildPrompt(s: PromptSettings): BuiltPrompt | PromptError {
  const base = resolvePreset(s.preset ?? "");
  if (!base) return { ok: false, error: `No preset matches "${s.preset}". Use list_presets to search.` };

  if (s.lighting && !findOption([...LIGHTING, ...INTERIOR_RELIGHT, ...URBAN_RELIGHT], s.lighting) && !/^time:\d{1,2}:\d{2}$/.test(s.lighting)) {
    return { ok: false, error: `Unknown lighting "${s.lighting}". Use get_options to see the ids.` };
  }
  if (s.environment) {
    for (const id of s.environment.split(",").map((x) => x.trim()).filter(Boolean)) {
      if (!id.startsWith("custom:") && id !== "keep" && !contextText(id)) {
        return { ok: false, error: `Unknown environment "${id}". Use get_options to see the ids.` };
      }
    }
  }
  const view = s.view ? VIEW_KINDS.find((v) => v.id === s.view) : undefined;
  if (s.view && !view) return { ok: false, error: `Unknown view "${s.view}". Options: ${VIEW_KINDS.map((v) => v.id).join(", ")}.` };

  const style = s.styleExtra?.trim() ? `${base.style}, ${s.styleExtra.trim()}` : base.style;
  const preset: Preset = {
    id: base.id,
    name: base.name,
    projectType: base.projectType,
    lighting: s.lighting ?? base.lighting,
    environment: s.environment ?? base.environment,
    style,
  };

  const extras: string[] = [];
  if (s.fixtures) {
    const line = fixtureSettingsLine(preset.projectType, { exterior: null, led: false, strip: false, cabinet: false, kelvin: 3000, ...s.fixtures });
    if (line) extras.push(line);
  }
  if (view) extras.push(view.text);

  const focal = s.focalLengthMm ?? view?.focalLengthMm;
  const prompt = buildRenderPrompt({
    preset,
    notes: s.notes,
    facts: focal ? { focalLengthMm: focal } : undefined,
    hasLinePass: false,
    extras,
    look: s.look,
    avoid: s.avoid ?? DEFAULT_AVOID,
  });
  return { ok: true, presetId: preset.id, presetName: preset.name, prompt, words: prompt.split(/\s+/).filter(Boolean).length };
}

// ---------- Batch ----------

export interface BatchJob extends Omit<PromptSettings, "preset"> {
  /** image file name; used for output naming and, if no view is set, to guess the view */
  image: string;
  /** overrides the batch-wide preset */
  preset?: string;
}

export interface BatchResult {
  image: string;
  view?: string;
  result: BuiltPrompt | PromptError;
}

/** Build one prompt per image. Settings in `common` apply to every job. */
export function buildBatch(common: Omit<PromptSettings, "preset"> & { preset: string }, jobs: BatchJob[]): BatchResult[] {
  return jobs.map((job) => {
    const view = job.view ?? common.view ?? inferView(job.image);
    const settings: PromptSettings = { ...common, ...job, preset: job.preset ?? common.preset, view };
    return { image: job.image, view, result: buildPrompt(settings) };
  });
}

/** Presets that need no ids: a ready list for scene types, used by UIs and tests. */
export function presetsFor(scene: ProjectType, styleId = "all", subjectId = "all"): PresetSummary[] {
  return filterLibrary(scene, styleId, subjectId).map(summary);
}
