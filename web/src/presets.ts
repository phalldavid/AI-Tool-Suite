// Named render presets. Built-in ones ship with the app; user presets are
// saved through the host (browser storage or SketchUp preferences).

import type { Preset } from "./types";

export const BUILT_IN_PRESETS: Preset[] = [
  {
    id: "borey-villa-dusk",
    name: "Borey villa, blue hour",
    projectType: "exterior",
    lighting: "blue-hour",
    environment: "borey",
    style:
      "two-storey reinforced concrete villa, smooth white render, dark grey aluminium window frames, clear glass, flat concrete roof with deep overhangs, timber vertical louvers on the west side, concrete paver driveway",
  },
  {
    id: "shophouse-row-day",
    name: "Shophouse row, morning",
    projectType: "exterior",
    lighting: "morning",
    environment: "pp-street",
    style:
      "row of four-storey shophouses, painted render facades in muted colours, steel roller shutters at ground floor, balconies with simple steel railings, air-conditioning units, signage boards left blank",
  },
  {
    id: "new-khmer-civic",
    name: "New Khmer civic building",
    projectType: "exterior",
    lighting: "afternoon",
    environment: "tropical-garden",
    style:
      "board-formed exposed concrete, deep sun-shading fins, raised ground floor on pilotis, large sheltered verandas, laterite stone plinth, reflecting pool in front",
  },
  {
    id: "condo-tower-noon",
    name: "Condo tower, midday",
    projectType: "exterior",
    lighting: "noon",
    environment: "pp-street",
    style:
      "high-rise residential tower, low-iron glass with light grey tint, white aluminium fins, recessed balconies with planters, podium with retail at street level",
  },
  {
    id: "resort-pavilion",
    name: "Resort pavilion, coast",
    projectType: "exterior",
    lighting: "afternoon",
    environment: "beach",
    style:
      "open-sided timber pavilion, tropical hardwood columns and beams, steep clay tile roof, polished concrete floor, rattan furniture, linen curtains",
  },
  {
    id: "masterplan-aerial",
    name: "Masterplan aerial",
    projectType: "aerial",
    lighting: "morning",
    environment: "keep",
    style:
      "landscaped masterplan, asphalt roads with white markings, concrete footpaths, street trees along every road, retention pond with planted edges, low-rise housing with grey and terracotta roofs",
  },
  {
    id: "living-room-warm",
    name: "Living room, warm timber",
    projectType: "interior",
    lighting: "interior-day",
    environment: "keep",
    style:
      "light oak timber floor, off-white painted walls, walnut joinery with flush handles, linen sofa, terrazzo coffee table, ceiling fan, sheer curtains",
  },
  {
    id: "condo-lobby-evening",
    name: "Condo lobby, evening",
    projectType: "interior",
    lighting: "interior-evening",
    environment: "keep",
    style:
      "double-height lobby, honed travertine floor, fluted timber wall panels, brushed brass details, cove lighting at 2700K, large indoor plants",
  },
  {
    id: "cafe-industrial",
    name: "Cafe, concrete and timber",
    projectType: "interior",
    lighting: "interior-day",
    environment: "keep",
    style:
      "polished concrete floor, exposed concrete ceiling with black steel trusses, recycled timber counter, cement tiles behind the bar, pendant lights, rattan chairs",
  },
  {
    id: "sketch-to-photo",
    name: "iPad sketch to photo",
    projectType: "sketch",
    lighting: "morning",
    environment: "tropical-garden",
    style:
      "materials as suggested by the sketch: white render, timber, glass and local stone; keep every line of the sketch as a real built edge",
  },
];

export function newPresetId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${slug || "preset"}-${Date.now().toString(36)}`;
}

/** Checks an imported JSON value and returns the presets that are valid. */
export function parsePresetFile(value: unknown): Preset[] {
  const list = Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as { presets?: unknown }).presets)
      ? (value as { presets: unknown[] }).presets
      : [];
  const types = ["exterior", "interior", "aerial", "sketch"];
  const out: Preset[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const p = raw as Record<string, unknown>;
    if (typeof p.name !== "string" || !types.includes(p.projectType as string)) continue;
    out.push({
      id: typeof p.id === "string" ? p.id : newPresetId(p.name),
      name: p.name,
      projectType: p.projectType as Preset["projectType"],
      lighting: typeof p.lighting === "string" ? p.lighting : "morning",
      environment: typeof p.environment === "string" ? p.environment : "keep",
      style: typeof p.style === "string" ? p.style : "",
    });
  }
  return out;
}
