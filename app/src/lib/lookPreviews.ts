// Style pictures made on this computer from the v1 contact sheets (ext, int, air),
// shown on look cards that have no shipped picture.

import { SHEETS, cutSheet, loadSheets, previewKey, saveSheet, sheetPrompt } from "../core/style-previews";
import type { CutSheet, SheetDef, SheetRecord } from "../core/style-previews";
import type { LibItem } from "../core/library";
import type { ImageData64 } from "../core/types";

export const LOOK_SHEETS: SheetDef[] = SHEETS;

let tiles: Record<string, string> = {};
let loaded = false;
const listeners = new Set<() => void>();

export async function loadLookTiles(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const all = await loadSheets();
    for (const def of SHEETS) {
      const r = all[def.id];
      if (r) def.tiles.forEach((t, i) => r.tiles[i] && !r.hidden.includes(i) && (tiles[t.key] = r.tiles[i]));
    }
  } catch {
    /* none */
  }
  for (const l of listeners) l();
}

export function onLookTiles(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function lookTile(x: LibItem): string | null {
  const key = previewKey(x.projectType, x.styleId);
  return key ? tiles[key] ?? null : null;
}

export function lookSheetThumbs(def: SheetDef): (string | null)[] {
  return def.tiles.map((t) => tiles[t.key] ?? null);
}

export function lookSheetPrompt(def: SheetDef): string {
  return sheetPrompt(def);
}

export async function saveLookSheet(def: SheetDef, sheet: ImageData64, credits?: number): Promise<CutSheet> {
  const cut = await cutSheet(sheet, def);
  const rec: SheetRecord = { id: def.id, createdAt: Date.now(), sheet, tiles: cut.tiles, hidden: [], issues: cut.check.issues ?? [], credits };
  await saveSheet(rec);
  def.tiles.forEach((t, i) => cut.tiles[i] && (tiles[t.key] = cut.tiles[i]));
  tiles = { ...tiles };
  for (const l of listeners) l();
  return cut;
}

export function lookMadeCount(): number {
  return Object.keys(tiles).length;
}

/** Same format as v1's "Export for the app": scripts/import-previews.mjs reads it. */
export function lookExport(): string {
  return JSON.stringify({ kind: "style-previews", model: "made in David Render Studio v2", createdAt: new Date().toISOString(), tiles });
}
