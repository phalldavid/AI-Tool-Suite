// The Render tab's prompt, as a pure function of its settings. No store, no React,
// no localStorage: the caller resolves those first. The Render tab (actions.ts
// buildPrompt) and the node graph both call this, so the same settings always give
// the same text.

import { buildRenderPrompt } from "./prompt";
import { buildDeadlineMode } from "./deadline-mode";
import type { RenderLook } from "./prompt";
import type { Preset, SceneFacts } from "./types";
import type { DynValues } from "./dynamic";
import { countSet, dynamicLines } from "./dynamic";
import { splitTypology } from "../lib/typology";
import { lightingGuidance, withOverride } from "../lib/lighting";
import type { LightScene } from "../lib/lighting";
import { fittingsLine } from "../lib/fittings";
import type { FittingState } from "../lib/fittings";

export interface RenderTabInput {
  /** The look, with `lighting` already resolved to a light id (a card id or "time:HH:MM"). */
  preset: Preset;
  /** Interior or exterior lighting: the user's switch, or null to follow the look. */
  lightScene: LightScene | null;
  fittings: Record<LightScene, FittingState>;
  dynamic: Record<string, DynValues>;
  /** The exact sun line from the Sun screen, or null when it is not used. */
  sunLine: string | null;
  facts?: SceneFacts;
  hasLinePass: boolean;
  lineStrength: number;
  look: RenderLook;
  materialLock: boolean;
  boundaryLock: boolean;
  avoid: string;
  /** Sentences from the Additional Notes chips, already resolved. */
  noteLines: string[];
  /** Additional Notes free text. */
  notes: string;
}

export interface ComposedPrompt {
  prompt: string;
  /** Building-type words taken out of the look's style. */
  removed: string[];
}

/** Interior or exterior lighting: the switch, else what the look says. */
export function sceneFor(preset: Preset, lightScene: LightScene | null): LightScene {
  return lightScene ?? (preset.projectType === "interior" ? "interior" : "exterior");
}

export function composeRenderPrompt(i: RenderTabInput): ComposedPrompt {
  const split = splitTypology(i.preset.style);
  const preset: Preset = { ...i.preset, style: split.style };
  const scene = sceneFor(i.preset, i.lightScene);
  const fit = fittingsLine(scene, i.fittings[scene]);
  const extras: string[] = [...dynamicLines(i.dynamic), lightingGuidance(scene), ...(fit ? [fit] : [])];
  let fromSun = countSet(i.dynamic.time) > 0;
  if (i.sunLine) {
    extras.push(i.sunLine);
    fromSun = true;
  }
  const prompt = buildRenderPrompt({
    preset,
    notes: "",
    facts: i.facts,
    hasLinePass: i.hasLinePass,
    extras,
    lineStrength: i.lineStrength,
    look: i.look,
    materialLock: i.materialLock,
    boundaryLock: i.boundaryLock,
    lightingFromDynamic: fromSun,
    avoid: i.avoid,
  });
  return { prompt: withOverride(prompt, i.noteLines, i.notes), removed: split.removed };
}

/** Deadline Mode: same time, sun and light lines, fixed universal blocks around them. */
export function composeDeadlineMode(i: RenderTabInput, materials?: string[]): ComposedPrompt {
  const scene = sceneFor(i.preset, i.lightScene);
  const fit = fittingsLine(scene, i.fittings[scene]);
  const extras: string[] = [...dynamicLines(i.dynamic), lightingGuidance(scene), ...(fit ? [fit] : [])];
  if (i.sunLine) extras.push(i.sunLine);
  const notes = [...i.noteLines, i.notes.trim()].filter(Boolean).join(" ");
  const prompt = buildDeadlineMode({ type: i.preset.projectType, hasLinePass: i.hasLinePass, lineStrength: i.lineStrength, extras, notes, avoid: i.avoid, materials });
  return { prompt, removed: [] };
}
