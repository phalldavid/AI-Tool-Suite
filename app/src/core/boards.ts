// Presentation boards. The model draws the pictures only; every word and number on
// the sheet is drawn by the app (lib/board-sheet.ts). The Sombok test showed why:
// asked to write labels, the model put "Floor Tile" under a gold swatch, repeated
// numbers and ignored the 3:2 sheet (docs/sombok-study). Here the model is told to
// leave all text out, the user places numbered pins, and the app lays the picture,
// pins, legend and title block onto a true A-series sheet.

import { nearestAspectRatio } from "./prompt";

export type SheetSize = "A0" | "A1" | "A2" | "A3";
export type Orientation = "landscape" | "portrait";

/** ISO 216 sizes in mm, landscape (long side first). */
export const SHEETS: Record<SheetSize, [number, number]> = {
  A0: [1189, 841],
  A1: [841, 594],
  A2: [594, 420],
  A3: [420, 297],
};

export const DEFAULT_SHEET: SheetSize = "A1";

export interface BoardPreset {
  id: string;
  label: string;
  /** one line under the label */
  sub: string;
  /** what the subject field asks for */
  subjectHint: string;
  /** the picture layout, written for the model; {subject} is filled in */
  layout: string;
  /** ready-made pin captions the user can start from */
  pins: string[];
}

export const BOARD_PRESETS: BoardPreset[] = [
  {
    id: "joinery",
    label: "Furniture and joinery",
    sub: "Front, side and top view with the material swatches",
    subjectHint: "e.g. bathroom vanity, TV cabinet, kitchen island",
    layout:
      "LEFT two thirds: three flat views of the {subject} exactly as it appears in the uploaded image: a front view, a side view and a top view, drawn with no perspective, side by side on one baseline, at the same scale. RIGHT third: a tidy grid of square material swatches, one for each material on the {subject} and the surfaces right behind it.",
    pins: ["Carcass", "Door and drawer fronts", "Countertop", "Handles", "Basin", "Tap"],
  },
  {
    id: "palette",
    label: "Material palette",
    sub: "The view plus a swatch for every material in it",
    subjectHint: "e.g. master bathroom, café interior, villa facade",
    layout:
      "LEFT half: the uploaded view of the {subject}, cropped clean, unchanged. RIGHT half: a neat grid of large square material swatches, 3 columns, one for each material visible in the view, each swatch a flat close-up of the real material with its true colour, grain and finish.",
    pins: ["Floor", "Walls", "Ceiling", "Joinery", "Metal finish", "Fabric"],
  },
  {
    id: "interior-concept",
    label: "Interior concept",
    sub: "Hero view, three detail close-ups and a palette strip",
    subjectHint: "e.g. living room, hotel lobby, restaurant",
    layout:
      "TOP two thirds: the uploaded view of the {subject} as the large hero image, unchanged. BOTTOM third: three equal close-up detail images of the same space (a material junction, a light fitting, a furniture detail), then a narrow strip of 6 square material swatches from the same space.",
    pins: ["Feature wall", "Lighting", "Furniture", "Floor finish", "Joinery detail"],
  },
  {
    id: "facade",
    label: "Facade study",
    sub: "Hero view, flat front elevation and two close-ups",
    subjectHint: "e.g. shophouse facade, villa front, office tower base",
    layout:
      "LEFT half: the uploaded view of the {subject} as the hero image, unchanged. RIGHT half, top: a flat front elevation of the same facade with no perspective, same openings and proportions. RIGHT half, bottom: two close-ups side by side, one of a window or screen detail and one of the entrance, plus a row of 5 square swatches of the facade materials.",
    pins: ["Roof", "Wall finish", "Window frame", "Screen / louvres", "Entrance", "Plinth"],
  },
  {
    id: "masterplan",
    label: "Masterplan sheet",
    sub: "Aerial hero, plan view and three street-level views",
    subjectHint: "e.g. borey masterplan, resort, campus",
    layout:
      "LEFT two thirds: the uploaded aerial view of the {subject}, unchanged, as the hero image. RIGHT third: a clean top-down plan view of the same layout above three small eye-level views stacked vertically: the main street, a public open space and the entrance.",
    pins: ["Main entrance", "Main road", "Clubhouse", "Park", "Retention pond", "Shophouse row"],
  },
  {
    id: "day-night",
    label: "Day and night",
    sub: "The same view at midday and at blue hour, side by side",
    subjectHint: "e.g. villa, café frontage, lobby",
    layout:
      "Two equal panels side by side showing the uploaded view of the {subject} from exactly the same camera: LEFT in clear midday daylight, RIGHT at blue hour with all lights switched on. Nothing else changes between the two panels.",
    pins: ["Facade lighting", "Interior glow", "Landscape lights"],
  },
];

export function findBoardPreset(id: string): BoardPreset {
  return BOARD_PRESETS.find((p) => p.id === id) ?? BOARD_PRESETS[0];
}

/** Sheet in mm with the orientation applied: [width, height]. */
export function sheetMm(size: SheetSize, orient: Orientation): [number, number] {
  const [a, b] = SHEETS[size];
  return orient === "landscape" ? [a, b] : [b, a];
}

export interface BoardLayout {
  /** sheet size in mm */
  w: number;
  h: number;
  margin: number;
  /** picture area in mm */
  pic: { x: number; y: number; w: number; h: number };
  /** legend and title band at the bottom, in mm */
  band: { x: number; y: number; w: number; h: number };
}

/** Margins and a bottom band for the legend and title block, in proportion to the sheet. */
export function boardLayout(size: SheetSize, orient: Orientation): BoardLayout {
  const [w, h] = sheetMm(size, orient);
  const short = Math.min(w, h);
  const margin = round(short * 0.035);
  const bandH = round(short * (orient === "landscape" ? 0.13 : 0.15));
  const gap = round(short * 0.02);
  const pic = { x: margin, y: margin, w: w - 2 * margin, h: h - 2 * margin - bandH - gap };
  const band = { x: margin, y: h - margin - bandH, w: w - 2 * margin, h: bandH };
  return { w, h, margin, pic, band };
}

/** The aspect ratio to ask the model for, so the picture fills its area on the sheet. */
export function boardAspect(size: SheetSize, orient: Orientation): string {
  const { pic } = boardLayout(size, orient);
  return nearestAspectRatio(pic.w, pic.h);
}

export interface BoardPromptInput {
  preset: BoardPreset;
  subject: string;
  orient: Orientation;
  /** extra wishes from the user */
  notes?: string;
}

export function buildBoardPrompt(i: BoardPromptInput): string {
  const subject = i.subject.trim() || "design";
  const lines = [
    `Based on the uploaded image, create ONE presentation board of the ${subject} on a single ${i.orient} sheet, with a clean off-white background and soft, even studio lighting.`,
    `LAYOUT: ${i.preset.layout.replace(/\{subject\}/g, subject)}`,
    "Keep clear, even white gutters between the panels and a little empty margin around the edge.",
    "RULES: Do not redesign anything. Keep every shape, proportion, colour and material exactly as in the uploaded image. Do not invent materials or objects that are not in the image.",
    "NO TEXT: no words, letters, numbers, titles, captions, labels, logos, watermarks, arrows or leader lines anywhere on the board. All text is added afterwards.",
  ];
  const n = i.notes?.trim();
  if (n) lines.push(`Also: ${n}${/[.!?។]$/.test(n) ? "" : "."}`);
  return lines.join("\n");
}

export interface BoardPin {
  /** position on the picture, 0..1 from the top left */
  x: number;
  y: number;
  text: string;
}

/** Pixels for a sheet at a print resolution, capped so the browser can hold the canvas. */
export function sheetPixels(size: SheetSize, orient: Orientation, dpi = 150, maxPixels = 40_000_000): { w: number; h: number; scale: number } {
  const [w, h] = sheetMm(size, orient);
  let pxPerMm = dpi / 25.4;
  const total = w * h * pxPerMm * pxPerMm;
  if (total > maxPixels) pxPerMm *= Math.sqrt(maxPixels / total);
  return { w: Math.round(w * pxPerMm), h: Math.round(h * pxPerMm), scale: pxPerMm };
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
