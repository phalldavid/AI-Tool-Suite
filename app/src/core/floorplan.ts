// 3D floor plan from a 2D plan (CAD export, PDF screenshot or iPad sketch).
// One base prompt locks the layout; each preset adds only camera and look.
// These presets live only in Plan mode, so they never reach normal renders.

export type CutHeight = 900 | 1200 | 1500;
export type FurnitureRule = "keep" | "furnish";
export type LabelRule = "remove" | "keep";

export interface PlanPreset {
  id: string;
  label: string;
  use: string;
  text: string;
}

export const PLAN_PRESETS: PlanPreset[] = [
  {
    id: "iso-modern",
    label: "Isometric, clean modern",
    use: "Condo and apartment sales sheets",
    text: "Camera: 45-degree isometric view from the south-east corner, orthographic, entire plan centred with even margin. Materials: white matte walls, light oak plank floors in living, dining and bedrooms, light grey 600 x 600 mm tiles in bathrooms, kitchen and balcony. Lighting: even neutral daylight about 5000K with soft contact shadows. Background: plain light beige, no ground texture.",
  },
  {
    id: "top-down",
    label: "Top-down 3D plan",
    use: "Brochures, unit-type pages, website plans",
    text: "Camera: exact top-down orthographic view, plan north at the top, no perspective. Materials as a clean modern apartment: white walls, light oak floors, light grey tiles in wet areas. Lighting: very soft ambient light with faint shadows so it reads like a coloured drawing. Wall cuts: solid off-white with a thin dark outline. Background: white.",
  },
  {
    id: "tropical",
    label: "Tropical warm (Cambodia)",
    use: "Boreys, villas, link houses, resort units",
    text: "Camera: isometric view at about 30 degrees elevation from the south-east corner, orthographic. Materials: polished light terrazzo floors, off-white lime-plaster walls, teak joinery and doors, rattan and natural linen furniture, grey stone tiles in wet areas, a few potted tropical plants placed next to existing furniture only. Lighting: warm 3500K interior light mixed with soft daylight. Background: soft terracotta-beige.",
  },
];

export interface PlanOptions {
  preset: string;
  cutHeight: CutHeight;
  furniture: FurnitureRule;
  labels: LabelRule;
  notes?: string;
}

export const DEFAULT_PLAN: PlanOptions = { preset: "iso-modern", cutHeight: 1200, furniture: "keep", labels: "remove" };

export function buildFloorplanPrompt(o: PlanOptions): string {
  const preset = PLAN_PRESETS.find((p) => p.id === o.preset) ?? PLAN_PRESETS[0];
  const furniture =
    o.furniture === "furnish"
      ? "keep the furniture drawn on the plan, and furnish empty rooms with simple furniture that suits each room's use"
      : "only the furniture drawn on the plan; leave rooms without drawn furniture empty";
  const labels = o.labels === "keep" ? "keep the room names as clean, small, horizontal text in the same places" : "remove all room labels and dimension text";
  const lines = [
    "3D FLOORPLAN FROM 2D PLAN",
    "The input is a 2D architectural floor plan. Build a 3D model of exactly this plan.",
    "Layout lock: keep every wall, wall thickness, room size, door position and swing, window position, stair, column and fixed fixture exactly as drawn. Do not add, remove, merge or move rooms or openings. Exterior walls thicker than interior walls, as drawn.",
    `Cut all walls horizontally at ${o.cutHeight} mm so every room is visible from above; show wall tops as a clean solid cut surface.`,
    `Furniture: ${furniture}. Furniture sized to real dimensions and placed where the plan shows it.`,
    `Room labels and dimension text: ${labels}.`,
    o.labels === "keep" ? "No people, no text other than the room names, no watermark." : "No people, no text at all, no watermark.",
    preset.text,
  ];
  const n = o.notes?.trim().replace(/\.$/, "");
  if (n) lines.push(`Additional notes: ${n}.`);
  return lines.join("\n");
}
