// Material Scan read straight from the SketchUp model: SketchUp reports the
// materials it can see in the view (plugin/ai_render_suite/materials.rb) and
// this turns them into "Surface: material" tags. No AI call, no cost.

import type { ProjectType } from "./types";

export interface ModelMaterial {
  /** SketchUp display name; empty for unpainted faces */
  name: string;
  color: string | null;
  alpha: number;
  texture: string | null;
  /** innermost named group or component, if any */
  object: string | null;
  facing: "up" | "down" | "side";
  aboveEye: boolean;
  /** share of the view, in % */
  coverage: number;
}

// Names SketchUp makes up, which say nothing about the material.
const GENERIC_MATERIAL = /^(?:material|color|colour|default|untitled|mat)?[\s_#-]*[a-z]?[\s_#-]*\d*$/i;
const GENERIC_OBJECT = /^(?:group|component|comp|layer|tag|untitled)?[\s_#-]*\d*$/i;

/** "[Wood_Floor_Oak_2]" -> "Wood floor oak". */
export function cleanName(name: string, keepNumber = false): string {
  const s = name
    .replace(/^\[|\]$/g, "")
    .replace(/[_]+/g, " ")
    .replace(keepNumber ? /$^/ : /\s*#?\d+$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Plain colour words for a hex colour, e.g. "#d9cbb0" -> "light beige". */
export function colourWord(hex: string): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return "neutral";
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => parseInt(x, 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let hue = 0;
  if (d) {
    if (max === r) hue = 60 * (((g - b) / d) % 6);
    else if (max === g) hue = 60 * ((b - r) / d + 2);
    else hue = 60 * ((r - g) / d + 4);
  }
  if (hue < 0) hue += 360;
  if (l < 0.12) return "black";
  if (l > 0.93) return "white";
  if (l > 0.86 && sat < 0.4) return "off-white";
  if (sat < 0.12) return l > 0.75 ? "off-white" : l > 0.55 ? "light grey" : l > 0.3 ? "grey" : "dark grey";
  let name: string;
  if (hue < 15 || hue >= 345) name = "red";
  else if (hue < 45) name = l < 0.45 ? "brown" : sat < 0.45 ? "beige" : "orange";
  else if (hue < 65) name = sat < 0.4 ? "beige" : "yellow";
  else if (hue < 165) name = "green";
  else if (hue < 195) name = "teal";
  else if (hue < 255) name = "blue";
  else if (hue < 290) name = "purple";
  else name = "pink";
  const tone = l > 0.72 ? "light " : l < 0.32 ? "dark " : "";
  return `${tone}${name}`;
}

function surfaceName(m: ModelMaterial, type: ProjectType): string {
  const obj = m.object ? cleanName(m.object, true) : "";
  if (obj && !GENERIC_OBJECT.test(obj)) return obj;
  if (type === "interior") return m.facing === "up" ? "Floor" : m.facing === "down" ? "Ceiling" : "Walls";
  if (type === "aerial") return m.facing === "side" ? "Building sides" : m.facing === "down" ? "Soffits" : "Roofs and ground";
  if (m.facing === "down") return "Soffits and ceilings";
  if (m.facing === "up") return m.aboveEye ? "Roof" : "Ground and paving";
  return "Walls and facade";
}

function materialText(m: ModelMaterial): string {
  const name = cleanName(m.name);
  const colour = m.color ? colourWord(m.color) : "";
  const parts: string[] = [];
  if (!name || GENERIC_MATERIAL.test(name)) parts.push(colour ? `${colour} surface (${m.color})` : "plain surface");
  else parts.push(colour && !m.texture ? `${name}, ${colour}` : name);
  if (m.texture) parts.push("textured");
  if (m.alpha < 0.5) parts.push("transparent");
  else if (m.alpha < 0.95) parts.push("translucent");
  return parts.join(", ");
}

/** Tag lines, biggest surfaces first; tiny bits (under 0.5% of the view) are left out. */
export function modelDnaTags(list: ModelMaterial[], type: ProjectType, max = 20): string[] {
  const merged = new Map<string, number>();
  for (const m of list) {
    if (!m.name && !m.color) continue; // unpainted default faces carry no material
    const line = `${surfaceName(m, type)}: ${materialText(m)}`;
    merged.set(line, (merged.get(line) ?? 0) + m.coverage);
  }
  return [...merged.entries()]
    .filter(([, c]) => c >= 0.5)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([line]) => line);
}
