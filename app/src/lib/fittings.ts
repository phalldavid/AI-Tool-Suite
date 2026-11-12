// Light fittings for the render prompt: which ones, colour temperature, brightness, on or off.

import type { LightScene } from "./lighting";

export interface Fitting {
  id: string;
  label: string;
  /** words for the prompt */
  text: string;
  icon: string;
}

export const INTERIOR_FITTINGS: Fitting[] = [
  { id: "ceiling", label: "Ceiling light", text: "recessed ceiling downlights", icon: "bulb" },
  { id: "cabinet", label: "Cabinet light", text: "under-cabinet and shelf LED lights", icon: "grid" },
  { id: "strip", label: "LED strip", text: "concealed linear LED strips", icon: "minus" },
  { id: "cove", label: "Cove light", text: "indirect cove lighting washing the ceiling", icon: "layers" },
  { id: "pendant", label: "Pendant", text: "decorative pendant lights", icon: "bulb" },
  { id: "wall", label: "Wall light", text: "wall sconces", icon: "house" },
];

export const EXTERIOR_FITTINGS: Fitting[] = [
  { id: "facade", label: "Facade wash", text: "soft facade wash lights grazing the walls", icon: "house" },
  { id: "soffit", label: "Soffit downlights", text: "downlights in the roof eaves and soffits", icon: "bulb" },
  { id: "landscape", label: "Landscape uplights", text: "uplights under the trees and planting", icon: "sprout" },
  { id: "path", label: "Pathway lights", text: "low bollard and step lights along the paths", icon: "map" },
  { id: "wallx", label: "Wall lights", text: "exterior wall lights beside the doors", icon: "bulb" },
  { id: "water", label: "Pool and water", text: "underwater lights in the pool and water features", icon: "cloud" },
];

export const KELVIN_OPTIONS = [
  { k: 2700, label: "Warm white", sw: "#ffb46b" },
  { k: 3000, label: "Soft white", sw: "#ffc98f" },
  { k: 4000, label: "Neutral white", sw: "#ffe9d0" },
  { k: 5000, label: "Cool white", sw: "#f2f2ff" },
  { k: 6500, label: "Daylight", sw: "#d8e4ff" },
];

export const LEVELS = ["Subtle", "Medium", "Bright"];

export interface FittingState {
  on: boolean;
  types: string[];
  other: string;
  kelvin: number;
  level: number;
}

export const DEFAULT_FITTINGS: Record<LightScene, FittingState> = {
  interior: { on: true, types: [], other: "", kelvin: 3000, level: 1 },
  exterior: { on: true, types: [], other: "", kelvin: 2700, level: 1 },
};

export function fittingsFor(scene: LightScene): Fitting[] {
  return scene === "interior" ? INTERIOR_FITTINGS : EXTERIOR_FITTINGS;
}

/** The prompt sentence, or null when nothing is chosen. */
export function fittingsLine(scene: LightScene, f: FittingState): string | null {
  if (!f.on) return "All artificial light fittings are switched off; light comes only from the sky and the sun.";
  const list = fittingsFor(scene).filter((x) => f.types.includes(x.id)).map((x) => x.text);
  if (f.other.trim()) list.push(f.other.trim());
  if (!list.length) return null;
  const k = KELVIN_OPTIONS.find((o) => o.k === f.kelvin);
  const level = ["subtle, low", "medium", "bright"][f.level] ?? "medium";
  const tail =
    scene === "interior"
      ? "Realistic light spill, indirect bounce and soft falloff on the walls, floor and ceiling."
      : "Realistic glow on the facade and planting, soft pools of light on the ground.";
  return `Artificial lighting, switched on at ${level} brightness, ${f.kelvin}K ${k ? k.label.toLowerCase() : ""}: ${list.join(", ")}. ${tail}`.replace(/\s+:/, ":");
}

const KEY = "drs2.fittings";

export function loadFittings(): Record<LightScene, FittingState> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (raw && raw.interior && raw.exterior) return { interior: { ...DEFAULT_FITTINGS.interior, ...raw.interior }, exterior: { ...DEFAULT_FITTINGS.exterior, ...raw.exterior } };
  } catch {
    /* defaults */
  }
  return { interior: { ...DEFAULT_FITTINGS.interior }, exterior: { ...DEFAULT_FITTINGS.exterior } };
}

export function saveFittings(f: Record<LightScene, FittingState>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(f));
  } catch {
    /* not saved */
  }
}
