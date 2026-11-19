// Deadline Mode: one press, one call, no analysis step. Learned from Sombok
// (docs/sombok-study): their preset is a fixed text block the model reads with the
// image. Ours gates exterior-only blocks by scene, keeps the user's time and light
// settings, and can take the free material list read from SketchUp.

import type { ProjectType } from "./types";
import { MATERIAL_LOCK, BOUNDARY_LOCK, PLACEHOLDER_RULE, geometryLines } from "./prompt";

export interface S2RInput {
  type: ProjectType;
  hasLinePass: boolean;
  lineStrength: number;
  /** Lines from the Time, Sun, light and dynamic controls, already built. */
  extras: string[];
  /** Material list read from SketchUp (free); empty = use the material lock. */
  materials?: string[];
  notes?: string;
  avoid?: string;
}

export function buildDeadlineMode(i: S2RInput): string {
  const outside = i.type === "exterior" || i.type === "aerial";
  const L: string[] = [
    "Turn this SketchUp view into a real photograph taken with a professional DSLR. Keep the geometry and the textures.",
    "Camera lock: same camera position, angle, lens and framing as the input.",
    "Geometry lock: do not move, add, remove or resize any building element, opening, furniture or object.",
  ];
  if (i.hasLinePass) L.push(...geometryLines(i.lineStrength));
  L.push(MATERIAL_LOCK, BOUNDARY_LOCK);
  if (i.materials?.length) L.push(`Material list (keep these):\n${i.materials.map((m) => `- ${m}`).join("\n")}`);
  if (outside) {
    L.push("Hardscape: make paving, kerbs, steps and ground surfaces real, with joints, slight wear and wet-season staining where natural.");
    L.push("Planting: turn SketchUp trees and green areas into real tropical planting, lawn and soil in the same positions.");
    L.push(PLACEHOLDER_RULE);
  }
  L.push(...i.extras);
  L.push("Glass: real glass with true reflections and see-through depth, never flat, grey or invisible. Artificial light: neutral-warm LED, high colour rendering, soft natural falloff.");
  L.push("Photo look: natural lens, correct exposure, straight verticals, accurate white balance and colour, like a professional architectural photographer.");
  const n = i.notes?.trim();
  if (n) L.push(`Additional notes (highest priority): ${n}`);
  const a = i.avoid?.trim();
  if (a) L.push(`Avoid: ${a}.`);
  return L.join("\n");
}
