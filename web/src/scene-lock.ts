// SceneLock: the same room, materials and light as a master render, seen
// from a new SketchUp camera. Image 1 is the new view (shape and camera),
// Image 2 the master render (look). The look is written out as named slots
// so every view of a project gets the same words, and the sun line is
// worked out per camera from SketchUp's shadow settings.

import { LOCK_IMAGE_1, MATCH_PRIORITY } from "./style-match";
import type { ImageData64, SceneFacts } from "./types";

/** The mode's name in the app. Not final yet, so it lives in one place. */
export const SCENE_LOCK_NAME = "SceneLock";

export type LockKind = "exterior" | "interior" | "bathroom";

export interface LockSlot {
  id: string;
  label: string;
  /** what the AI should describe for this slot */
  ask: string;
}

export const EXTERIOR_SLOTS: LockSlot[] = [
  { id: "facade", label: "Facade", ask: "main wall material, finish and colour" },
  { id: "screens", label: "Screens", ask: "louvers, fins, screens or balustrades: material, size, colour" },
  { id: "roof", label: "Roof", ask: "roof material and colour" },
  { id: "glazing", label: "Glazing", ask: "glass type, frame colour, reflections" },
  { id: "ground", label: "Ground", ask: "paving, driveway, lawn, boundary walls" },
  { id: "time", label: "Time and light", ask: "time of day, sun strength and light colour" },
  { id: "sky", label: "Sky", ask: "sky and clouds" },
  { id: "planting", label: "Planting", ask: "trees, palms, shrubs and ground cover" },
  { id: "people", label: "People and cars", ask: "how many people and vehicles, and what they do" },
];

export const INTERIOR_SLOTS: LockSlot[] = [
  { id: "floor", label: "Floor", ask: "floor material, colour and finish" },
  { id: "walls", label: "Walls", ask: "wall finishes and colours, feature walls" },
  { id: "ceiling", label: "Ceiling", ask: "ceiling material, colour, coves or bulkheads" },
  { id: "joinery", label: "Joinery", ask: "cabinets, doors and built-ins: material and colour" },
  { id: "worktops", label: "Worktops", ask: "counters, tabletops, vanity tops" },
  { id: "fabrics", label: "Fabrics", ask: "sofa, curtains, rugs, bedding" },
  { id: "lamps", label: "Lamps", ask: "light fittings and whether they are on, colour temperature" },
  { id: "time", label: "Time and light", ask: "daylight or night, light colour and softness" },
  { id: "outside", label: "View outside", ask: "what is seen through windows" },
];

export const BATHROOM_SLOTS: LockSlot[] = [
  { id: "floor", label: "Floor", ask: "floor tiles in the dry zone and in the wet (shower) zone: material, size, colour" },
  { id: "walls", label: "Walls", ask: "wall tiles or finishes, and where each one goes" },
  { id: "ceiling", label: "Ceiling", ask: "ceiling finish and cornice" },
  { id: "vanity", label: "Vanity", ask: "vanity cabinet material and colour" },
  { id: "worktop", label: "Countertop", ask: "countertop material and colour" },
  { id: "basin", label: "Basin", ask: "basin shape, material and colour" },
  { id: "metal", label: "Metal finish", ask: "taps, mirror frame, sconces and fittings: finish (brass, chrome, black)" },
  { id: "glass", label: "Glass screen", ask: "shower screen: clear, fluted or tinted glass, frame" },
  { id: "bath", label: "Bath", ask: "bathtub shape and material, if any" },
  { id: "curtain", label: "Curtain", ask: "window curtain or blind: fabric and colour" },
  { id: "grille", label: "Window grille", ask: "window grille or frame: material and colour" },
  { id: "lamps", label: "Lights", ask: "downlights, sconces, LED strips: on or off, colour temperature" },
];

export const LOCK_KINDS: { id: LockKind; label: string; icon: string }[] = [
  { id: "exterior", label: "Exterior", icon: "exterior" },
  { id: "interior", label: "Interior", icon: "interior" },
  { id: "bathroom", label: "Bathroom", icon: "mirror" },
];

export function slotsFor(kind: LockKind): LockSlot[] {
  return kind === "bathroom" ? BATHROOM_SLOTS : kind === "interior" ? INTERIOR_SLOTS : EXTERIOR_SLOTS;
}

export interface SceneLock {
  /** Image 2, shrunk to keep settings small. */
  master: ImageData64 | null;
  /** History id of the master, when it came from History. */
  masterId?: string;
  kind: LockKind;
  slots: Record<string, string>;
}

export const EMPTY_LOCK: SceneLock = { master: null, kind: "exterior", slots: {} };

export function slotReadPrompt(kind: LockKind): string {
  const keys = slotsFor(kind)
    .map((s) => `  "${s.id}": ${s.ask}`)
    .join(",\n");
  return `This is a finished architectural ${kind === "exterior" ? "exterior" : "interior"} render. Describe how it looks so the same look can be repeated in other views of the same project. Be specific and short (under 15 words each), name real materials and colours.
Return JSON only, using these keys:
{
${keys}
}
Write "none" for anything not visible.`;
}

/** Reads the slot JSON; null when it has no usable JSON. */
export function parseSlots(text: string, kind: LockKind): Record<string, string> | null {
  const m = /\{[\s\S]*\}/.exec(text);
  if (!m) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(m[0]);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const out: Record<string, string> = {};
  for (const s of slotsFor(kind)) {
    const v = (raw as Record<string, unknown>)[s.id];
    if (typeof v === "string" && v.trim() && !/^none\.?$/i.test(v.trim())) out[s.id] = v.trim().replace(/\.$/, "");
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Where the sun sits for this camera, from SketchUp: sunToCameraDeg is 0
 * when the sun is straight ahead of the camera, 90 to the right, 180 behind.
 */
export function sunLine(facts?: SceneFacts): string | null {
  const a = facts?.sunToCameraDeg;
  const el = facts?.sunElevationDeg;
  if (typeof a !== "number" || typeof el !== "number") return null;
  if (el <= 0) return "Sun: below the horizon in this view; light it as dusk or night, not direct sun.";
  const abs = Math.abs(a);
  const side = a > 0 ? "right" : "left";
  const where =
    abs < 25 ? "ahead of the camera, so the building is backlit with long shadows towards the camera"
    : abs < 70 ? `ahead and to the ${side}, so shadows fall towards the camera and to the ${side === "right" ? "left" : "right"}`
    : abs < 110 ? `from the ${side}, so shadows fall across the frame to the ${side === "right" ? "left" : "right"}`
    : abs < 155 ? `behind the camera on the ${side}, so the facing walls are lit and shadows fall away to the ${side === "right" ? "left" : "right"}`
    : "behind the camera, so the facing walls are evenly lit and shadows fall away from the camera";
  const height = el < 15 ? "very low" : el < 35 ? "low" : el < 60 ? "mid height" : "high overhead";
  return `Sun in this view: ${where}; the sun is ${height} (about ${Math.round(el)} degrees). This overrides the sun side seen in Image 2.`;
}

export function lensLine(facts?: SceneFacts): string {
  if (facts?.perspective === false) return "Camera: parallel projection exactly as Image 1, straight verticals.";
  const mm = facts?.focalLengthMm;
  return `Camera: exactly as Image 1${mm ? `, ${mm} mm lens` : ""}, straight verticals, no lens distortion.`;
}

export function buildSceneLockPrompt(lock: SceneLock, facts?: SceneFacts, notes = ""): string {
  const slots = slotsFor(lock.kind)
    .filter((s) => lock.slots[s.id]?.trim())
    .map((s) => `- ${s.label}: ${lock.slots[s.id].trim().replace(/\.$/, "")}`);
  const lines = [
    "SAME LOOK, NEW VIEW",
    "Image 1 = NEW VIEW of the project, made in SketchUp. It defines all geometry, proportions, openings, object positions, camera position, lens and framing.",
    "Image 2 = MASTER RENDER of the same project. It defines the look: materials, colours, light, mood, planting and entourage.",
    LOCK_IMAGE_1,
    "Render Image 1 as a photorealistic architectural photograph with exactly the same look as Image 2.",
    "Image 1 is a raw SketchUp view. Its flat greys, default textures and placeholder colours are not final: Image 2 decides those materials. Real textures in Image 1 only help match each surface to the same surface in Image 2.",
    "Remove all black SketchUp edge lines. Flat bright green panels are glass. Thick dark bands or cut walls at the frame edges are the section cut, not part of the space: show the real wall, floor or ceiling continuing out of frame there.",
  ];
  if (lock.kind === "exterior") lines.push("Replace the flat green ground plane and plain background with the real ground, planting and sky of Image 2.");
  else lines.push("Keep every light fitting modelled in Image 1 where it is; switch them on or off as in Image 2.");
  if (slots.length) lines.push("Use these materials and settings, matching Image 2:", ...slots);
  const sun = sunLine(facts);
  if (sun) lines.push(sun);
  lines.push(
    "If Image 1 shows a surface that Image 2 does not, give it the closest matching material from Image 2, so the set reads as one project.",
    lensLine(facts),
  );
  const n = notes.trim().replace(/\.$/, "");
  if (n) lines.push(`Also: ${n}.`);
  lines.push("No text, no watermark, no CGI look.", MATCH_PRIORITY);
  return lines.join("\n");
}
