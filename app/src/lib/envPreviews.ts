// Environment pictures from contact sheets, the same way the style previews were made:
// one image per sheet showing the same building in a grid of surroundings, cut into
// 4:3 thumbnails. Make a sheet in Gemini (copy the prompt, paste the picture back) or
// with Kie (Nano Banana 2.1 at 2K). Pictures stay on this computer until exported and
// baked into web/public/previews/env-<id>.webp by scripts/import-env-previews.py.

import { CONTEXT_GROUPS } from "../core/context";
import { cutSheet, loadSheets, saveSheet } from "../core/style-previews";
import type { CutSheet, SheetDef, SheetRecord } from "../core/style-previews";
import { previewFile } from "../core/preview-files";
import type { ImageData64 } from "../core/types";

export interface EnvSheet {
  id: string;
  label: string;
  cols: number;
  rows: number;
  ratio: string;
  /** what every panel shows; one line per row when the rows differ */
  subject: string[];
  ids: string[];
}

const HOUSE = "the SAME modern two-storey tropical house (white render, timber screens, deep flat roof overhangs) from the SAME eye-level camera, 1.6 m high, 35 mm lens";

export const ENV_SHEETS: EnvSheet[] = [
  {
    id: "env-a",
    label: "Streets and estates",
    cols: 4,
    rows: 3,
    ratio: "16:9",
    subject: [HOUSE],
    ids: ["pp-street", "bkk1", "boulevard", "market", "newdistrict", "borey", "borey-gate", "villa-row", "borey-park", "courtyard", "khmer-village", "pagoda"],
  },
  {
    id: "env-b",
    label: "Landscapes and places",
    cols: 4,
    rows: 3,
    ratio: "16:9",
    subject: [HOUSE],
    ids: ["tropical-garden", "rural", "riverside", "lake", "hills", "beach", "minimal-garden", "bokor", "quay", "koh-pich", "siem-reap", "kampot"],
  },
  {
    id: "env-c",
    label: "Places, window views, masterplan",
    cols: 4,
    rows: 3,
    ratio: "16:9",
    subject: [
      `Row 1: ${HOUSE}.`,
      "Row 2: the SAME modern living room with one large floor-to-ceiling window, same camera; only the view through the window changes.",
      "Row 3: the SAME small residential estate seen from the SAME drone position, 45 degrees down; only the surrounding land changes.",
    ],
    ids: ["angkor", "sihanoukville", "pp-metro", "mondulkiri", "view-garden", "view-city", "view-river", "view-pool", "mp-farmland", "mp-suburb", "mp-river", "mp-city"],
  },
];

const ITEMS = new Map(CONTEXT_GROUPS.flatMap((g) => g.items.map((i) => [i.id, i] as const)));

export function envSheetPrompt(s: EnvSheet): string {
  const n = s.cols * s.rows;
  const list = s.ids.map((id, i) => `${i + 1}. ${ITEMS.get(id)?.label ?? id}: ${ITEMS.get(id)?.text ?? id}.`).join("\n");
  return [
    `A single image divided into a clean ${s.cols} x ${s.rows} grid of ${n} equal panels (${s.cols} columns, ${s.rows} rows), separated by thin pure white gutters. No text, labels, numbers, logos or watermarks.`,
    "",
    s.subject.length === 1 ? `Every panel shows ${s.subject[0]}. Keep the building and camera identical in all ${n} panels. Only the surroundings change.` : s.subject.join("\n"),
    "",
    "Realistic photographic rendering, professional architecture photography, soft late-morning daylight, accurate materials and soft shadows. Cambodian setting.",
    "",
    "Panels, left to right, top to bottom:",
    list,
  ].join("\n");
}

function asDef(s: EnvSheet): SheetDef {
  return { id: s.id as SheetDef["id"], label: s.label, projectType: "exterior", cols: s.cols, rows: s.rows, ratio: s.ratio, subject: s.subject.join(" "), tiles: s.ids.map((id) => ({ key: `env:${id}`, label: ITEMS.get(id)?.label ?? id, text: ITEMS.get(id)?.text ?? id })) };
}

export async function cutEnvSheet(img: ImageData64, s: EnvSheet): Promise<CutSheet> {
  return cutSheet(img, asDef(s));
}

let tiles: Record<string, string> = {};
let loaded = false;
const listeners = new Set<() => void>();

/** Loads saved sheets once. */
export async function loadEnvTiles(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const all = await loadSheets();
    for (const s of ENV_SHEETS) {
      const r = all[s.id];
      if (r) r.tiles.forEach((t, i) => (tiles[s.ids[i]] = t));
    }
  } catch {
    /* none saved */
  }
  for (const l of listeners) l();
}

export function onEnvTiles(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function saveEnvSheet(s: EnvSheet, sheet: ImageData64, cut: CutSheet, credits?: number): Promise<void> {
  const rec: SheetRecord = { id: s.id as SheetDef["id"], createdAt: Date.now(), sheet, tiles: cut.tiles, hidden: [], issues: cut.check.issues ?? [], credits };
  await saveSheet(rec);
  cut.tiles.forEach((t, i) => (tiles[s.ids[i]] = t));
  tiles = { ...tiles };
  for (const l of listeners) l();
}

/** The picture for an environment card: shipped with the app, else made on this computer. */
export function envPicture(id: string): string | null {
  return previewFile(`env-${id}`) ?? tiles[id] ?? null;
}

export function envMadeCount(): number {
  return ENV_SHEETS.flatMap((s) => s.ids).filter((id) => tiles[id] || previewFile(`env-${id}`)).length;
}

/** JSON for scripts/import-env-previews.py, which writes the .webp files. */
export function envExport(): string {
  return JSON.stringify({ kind: "env-previews", createdAt: new Date().toISOString(), tiles }, null, 0);
}
