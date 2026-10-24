// Scene Scan: the AI looks at the image, says what it shows (exterior villa,
// interior bathroom, aerial borey...) and which style it is closest to, then
// the app picks the matching template and adds what it saw to the prompt.
// The user checks the result before anything changes.

import { AERIAL_TYPES, EXT_STYLES, EXT_TYPES, findLibraryItem, INT_STYLES, ROOMS, type LibItem } from "./library";
import type { Preset, ProjectType } from "./types";

export interface SceneScan {
  scene: ProjectType;
  /** building type, room or development type id from the library */
  subject: string;
  /** style id from the library */
  style: string;
  /** what the AI sees, written as prompt text */
  details: string;
}

const ids = (xs: { id: string; label: string }[]) => xs.map((x) => `${x.id} (${x.label})`).join(", ");

export function scenePrompt(): string {
  return [
    "You are an architectural visualiser. Look at this image and say what it shows.",
    'Answer with JSON only, no other text: {"scene": "...", "subject": "...", "style": "...", "details": "..."}',
    '- scene: "exterior" (a building from outside at eye level), "interior" (a room), "aerial" (a site or district from above) or "sketch" (a hand drawing or line drawing).',
    `- subject for exterior, one of: ${ids(EXT_TYPES)}.`,
    `- subject for interior, one of: ${ids(ROOMS)}.`,
    `- subject for aerial, one of: ${ids(AERIAL_TYPES)}.`,
    `- style for exterior, one of: ${ids(EXT_STYLES)}.`,
    `- style for interior, one of: ${ids(INT_STYLES)}.`,
    '- style for aerial or sketch: "default".',
    "- Pick the closest id even when nothing fits exactly. Use the id only, without the label in brackets.",
    "- details: one or two sentences in plain builder's words about what is really in the image that the render should keep: main materials and colours, key furniture or fixtures, roof and window types, planting. No camera or lighting words, no style names.",
  ].join("\n");
}

/** Reads the AI's answer; tolerant of code fences, labels in brackets and stray text. */
export function parseScene(text: string): SceneScan | null {
  const m = /\{[\s\S]*\}/.exec(text);
  if (!m) return null;
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(m[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
  const clean = (v: unknown) => (typeof v === "string" ? v.replace(/\(.*?\)/g, "").trim().toLowerCase() : "");
  const scene = clean(raw.scene) as ProjectType;
  if (!["exterior", "interior", "aerial", "sketch"].includes(scene)) return null;
  const pickId = (v: string, list: { id: string; label: string }[]) =>
    list.find((x) => x.id === v)?.id ?? list.find((x) => x.label.toLowerCase() === v)?.id ?? list.find((x) => v && (x.id.includes(v) || v.includes(x.id)))?.id ?? "";
  const subjects = scene === "exterior" ? EXT_TYPES : scene === "interior" ? ROOMS : scene === "aerial" ? AERIAL_TYPES : [];
  const styles = scene === "exterior" ? EXT_STYLES : scene === "interior" ? INT_STYLES : [];
  const details = typeof raw.details === "string" ? raw.details.trim().replace(/\s+/g, " ") : "";
  return {
    scene,
    subject: pickId(clean(raw.subject), subjects) || subjects[0]?.id || "",
    style: pickId(clean(raw.style), styles) || styles[0]?.id || "default",
    details,
  };
}

/** The library template the scan points to, if there is one. */
export function sceneTemplate(s: SceneScan): LibItem | undefined {
  if (s.scene === "exterior") return findLibraryItem(`ext-${s.subject}-${s.style}`);
  if (s.scene === "interior") return findLibraryItem(`int-${s.subject}-${s.style}`);
  if (s.scene === "aerial") return findLibraryItem(`air-${s.subject}-default`);
  return undefined;
}

/** The preset a scan sets: the matching template plus what the AI saw. */
export function scenePreset(s: SceneScan, current: Preset): Preset {
  const tpl = sceneTemplate(s);
  const base: Preset = tpl
    ? { id: tpl.id, name: tpl.name, projectType: tpl.projectType, lighting: tpl.lighting, environment: tpl.environment, style: tpl.style, builtIn: true }
    : { ...current, projectType: s.scene };
  return s.details ? { ...base, style: `${base.style}${base.style ? "; " : ""}as in the image: ${s.details.replace(/\.$/, "")}` } : base;
}

/** "Interior · Bathroom · Scandinavian" for the result card. */
export function sceneLabel(s: SceneScan): string {
  const subjects = s.scene === "exterior" ? EXT_TYPES : s.scene === "interior" ? ROOMS : AERIAL_TYPES;
  const styles = s.scene === "exterior" ? EXT_STYLES : INT_STYLES;
  const parts = [s.scene[0].toUpperCase() + s.scene.slice(1), subjects.find((x) => x.id === s.subject)?.label, styles.find((x) => x.id === s.style)?.label];
  return parts.filter(Boolean).join(" · ");
}

/** A preset that adds no style, lighting or surroundings: the prompt keeps only your own words. */
export function nonePreset(type: ProjectType): Preset {
  return { id: "none", name: "None", projectType: type, lighting: "", environment: "keep", style: "", builtIn: true };
}
