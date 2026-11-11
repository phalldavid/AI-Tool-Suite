// Prompts for "New view" in the Edit tab.
// My view: a SketchUp screenshot (Image 1) rendered with the look of a master render (Image 2).
// Move camera: only the master render, seen from a new camera position.

import { compass, heightWord } from "./sun";
import type { ProjectType } from "../core/types";

export interface SunWords {
  /** Compass bearing the sun shines from, if known. */
  bearing?: number;
  elevation: number;
  /** e.g. "late afternoon" */
  when?: string;
}

const COMPASS_WORDS: Record<string, string> = {
  N: "north", NNE: "north-north-east", NE: "north-east", ENE: "east-north-east",
  E: "east", ESE: "east-south-east", SE: "south-east", SSE: "south-south-east",
  S: "south", SSW: "south-south-west", SW: "south-west", WSW: "west-south-west",
  W: "west", WNW: "west-north-west", NW: "north-west", NNW: "north-north-west",
};

/** "sun from the west-south-west, low at about 14°, late afternoon" */
export function sunWords(s: SunWords): string {
  const el = Math.round(s.elevation);
  if (el < 0) return "the sun is below the horizon; warm artificial light only";
  const from = s.bearing === undefined ? "the same side as in Image 2" : `the ${COMPASS_WORDS[compass(s.bearing)]}`;
  return `sun from ${from}, ${heightWord(el)} at about ${el}°${s.when ? `, ${s.when}` : ""}`;
}

/** Part of the day for an hour on the dial. */
export function partOfDay(hour: number): string {
  return hour < 6.5 ? "dawn" : hour < 10 ? "morning" : hour < 14 ? "midday" : hour < 17.5 ? "late afternoon" : hour < 18.5 ? "sunset" : hour < 19.25 ? "blue hour" : "night";
}

export interface ShotPromptInput {
  type: ProjectType;
  sun: string;
  /** Lines from Additional Notes, already sentences. */
  notes: string[];
}

export function shotViewPrompt(p: ShotPromptInput): string {
  const lines = [
    "SAME LOOK, NEW VIEW",
    "Image 1 = NEW VIEW of the project, made in SketchUp. It sets all geometry, proportions, openings, object positions, camera position, lens and framing.",
    "Image 2 = MASTER RENDER of the same project. It sets the look: materials, colours, light, mood, planting and entourage.",
    "",
    "Lock Image 1 as a fixed 3D scene. Do not add, remove, move, resize or redesign anything. Keep the exact camera, perspective and crop. Keep every door, window and opening exactly where it is; do not create new ones.",
    "",
    "Render Image 1 as a photorealistic architectural photograph with the same look as Image 2.",
    "Image 1 is a raw SketchUp view. Its flat greys, default textures and placeholder colours are not final: Image 2 decides those materials. Real textures in Image 1 only help match each surface to the same surface in Image 2. If Image 1 shows a surface that Image 2 does not, give it the closest matching material from Image 2, so the set reads as one project.",
    "",
    `Light: same time of day, sky and mood as Image 2. The sun stays fixed relative to the building, not to the camera: ${p.sun}. Shadows must fall the way that sun position makes them fall in this new view.`,
    "Planting and people: same species, density and style as Image 2, placed naturally for this view. Do not copy them to the same spots in the frame.",
    "",
    "Remove all black SketchUp edge lines.",
  ];
  if (p.type === "interior") lines.push("Thick dark bands or cut walls at the frame edges are the section cut, not part of the space: show the real wall, floor or ceiling continuing out of frame there.");
  else lines.push("Replace the flat green ground plane and plain background with real ground, planting and sky matching Image 2.");
  lines.push(...p.notes);
  lines.push(
    "",
    "Camera: exactly as Image 1, straight verticals, no lens distortion.",
    "No text, no watermark, no CGI look.",
    "Priority if anything conflicts: geometry of Image 1 > camera of Image 1 > look of Image 2.",
  );
  return lines.join("\n");
}

export function cameraViewPrompt(cameraLine: string, sun: string, notes: string[]): string {
  return [
    "SAME BUILDING, NEW CAMERA",
    "Image 1 is an approved render of this building. Show this same building from a new camera position.",
    cameraLine,
    "Keep the design, materials, colours, sky, planting and light; only the viewpoint changes, so both images look like one photo shoot.",
    `The sun stays fixed relative to the building, not to the camera: ${sun}. Shadows must fall the way that sun position makes them fall in this new view.`,
    "Sides of the building that Image 1 does not show: keep them simple and consistent with the visible sides. Do not invent new features, openings or storeys.",
    ...notes,
    "Straight verticals, no lens distortion. No text, no watermark, no CGI look.",
  ].join("\n");
}
