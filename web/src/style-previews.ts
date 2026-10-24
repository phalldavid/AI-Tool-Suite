// Style previews from contact sheets. Instead of one render per style, the
// model is asked for ONE image that shows the same building (or room) in a
// grid of styles. The app finds the white gutters between tiles, cuts the
// sheet into thumbnails and uses them as template card pictures. Three
// sheets cover all 32 styles for about 18 Kie credits on Nano Banana 2.1 2K.
//
// Thumbnails made on this computer are kept in IndexedDB. A set exported
// from here can be turned into preview-pack.ts (scripts/import-previews.mjs)
// so every user sees it without spending anything.

import { AERIAL_LOOKS, EXT_STYLES, INT_STYLES } from "./library";
import { PREVIEW_PACK } from "./preview-pack";
import type { ImageData64, ProjectType } from "./types";

/** Model and size used for every sheet, so the cost is known up front. */
export const SHEET_MODEL = "nano-banana-2-1";
export const SHEET_RESOLUTION = "2K" as const;

export interface SheetTile {
  /** "ext:modern", "int:japandi", "air:golden" */
  key: string;
  label: string;
  /** what the tile should look like, in builder's words */
  text: string;
}

export interface SheetDef {
  id: "ext" | "int" | "air";
  label: string;
  projectType: ProjectType;
  cols: number;
  rows: number;
  /** aspect ratio asked for; with these grids every tile comes out 4:3 */
  ratio: string;
  subject: string;
  tiles: SheetTile[];
}

const short = (text: string) => text.split(",").slice(0, 4).join(",").trim();

export const SHEETS: SheetDef[] = [
  {
    id: "ext",
    label: "Exterior styles",
    projectType: "exterior",
    cols: 4,
    rows: 3,
    ratio: "16:9",
    subject:
      "the SAME two-storey detached villa from the SAME camera position: eye level 1.5 m high, 35 mm lens, straight vertical lines, seen from the street at a slight angle, a front garden, a gated driveway on the right, one tree on the left, soft afternoon sun",
    tiles: EXT_STYLES.map((s) => ({ key: `ext:${s.id}`, label: s.label, text: short(s.text) })),
  },
  {
    id: "int",
    label: "Interior styles",
    projectType: "interior",
    cols: 4,
    rows: 4,
    ratio: "4:3",
    subject:
      "the SAME living room from the SAME camera position: eye level 1.5 m high, 35 mm lens, straight vertical lines, a 4.5 x 6 m room, a large window on the left wall, a sofa facing the camera, a coffee table, a rug and one floor lamp, soft late-morning daylight from the left window",
    tiles: INT_STYLES.map((s) => ({ key: `int:${s.id}`, label: s.label, text: short(s.text) })),
  },
  {
    id: "air",
    label: "Aerial light",
    projectType: "aerial",
    cols: 2,
    rows: 2,
    ratio: "4:3",
    subject:
      "the SAME gated borey estate from the SAME drone position, 45 degrees down: rows of link houses, shophouses along the main road, villas, a central park and a clubhouse",
    tiles: AERIAL_LOOKS.map((l) => ({
      key: `air:${l.id}`,
      label: l.label,
      text: { default: "clear midday sun", golden: "warm low golden-hour sun with long shadows", blue: "blue hour just after sunset with street and window lights on", overcast: "soft overcast sky, no hard shadows" }[l.id] ?? l.label,
    })),
  },
];

export function findSheet(id: string): SheetDef | undefined {
  return SHEETS.find((s) => s.id === id);
}

// The wording follows a 3 x 3 test David ran (2026-10-24) that kept the same
// room, camera and window in every panel: one fixed scene block, then one
// numbered line per style.
export function sheetPrompt(s: SheetDef): string {
  const n = s.cols * s.rows;
  const list = s.tiles.map((t, i) => `${i + 1}. ${t.label}: ${t.text}.`).join("\n");
  return [
    `A single image divided into a clean ${s.cols} x ${s.rows} grid of ${n} equal panels (${s.cols} columns, ${s.rows} rows), separated by thin pure white gutters. No text, labels, numbers, logos or watermarks.`,
    "",
    `Every panel shows ${s.subject}. Keep the layout, massing, openings and camera identical in all ${n} panels. Only the design style, materials and colours change${s.id === "air" ? ", and the light" : ""}.`,
    "",
    "Realistic photographic rendering, professional architecture photography, accurate materials and soft shadows.",
    "",
    "Panels, left to right, top to bottom:",
    list,
  ].join("\n");
}

// ---------- Finding the grid ----------

/** Pixels from a canvas or a test: width, height and RGBA bytes. */
export interface Pixels {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}

/** For each column (axis "x") or row ("y"), how gutter-like it is: 1 = all white.
 * The prompt asks for pure white gutters; a pale sky is rarely that white in every tile. */
export function whiteProfile(px: Pixels, axis: "x" | "y"): number[] {
  const { width: w, height: h, data } = px;
  const len = axis === "x" ? w : h;
  const across = axis === "x" ? h : w;
  const out = new Array<number>(len).fill(0);
  for (let i = 0; i < len; i++) {
    let white = 0;
    for (let j = 0; j < across; j++) {
      const x = axis === "x" ? i : j;
      const y = axis === "x" ? j : i;
      const k = (y * w + x) * 4;
      if (data[k] > 236 && data[k + 1] > 236 && data[k + 2] > 236) white++;
    }
    out[i] = white / across;
  }
  return out;
}

/**
 * Where to cut along one axis: [start, end) of each tile. Looks for a gutter
 * near each expected line (within 6% of the length). `found` counts the inner
 * gutters that were really there; the rest fall back to an even split.
 */
export function findCuts(profile: number[], parts: number): { spans: [number, number][]; found: number } {
  const len = profile.length;
  // 0.85, not 1: JPEG blur and a pale ceiling beside a gutter both eat into it.
  const isGutter = (i: number) => profile[i] >= 0.85;
  // Outer border: skip white at both ends, but never more than 8%.
  let a = 0;
  while (a < len * 0.08 && isGutter(a)) a++;
  let b = len;
  while (b > len * 0.92 && isGutter(b - 1)) b--;
  const inner = b - a;
  const window = Math.max(2, Math.round(len * 0.06));
  const lines: [number, number][] = [];
  let found = 0;
  for (let p = 1; p < parts; p++) {
    const expect = Math.round(a + (inner * p) / parts);
    // The gutter run closest to where it should be.
    let best: [number, number] | null = null;
    let i = Math.max(a, expect - window);
    const stop = Math.min(b, expect + window);
    while (i < stop) {
      if (!isGutter(i)) {
        i++;
        continue;
      }
      let j = i;
      while (j < b && isGutter(j)) j++;
      // A gutter is thin; a long white run is sky or a wall, not a gutter.
      if (j - i <= len * 0.05) {
        const mid = (i + j) / 2;
        if (!best || Math.abs(mid - expect) < Math.abs((best[0] + best[1]) / 2 - expect)) best = [i, j];
      }
      i = j;
    }
    if (best) {
      lines.push(best);
      found++;
    } else {
      lines.push([expect, expect]);
    }
  }
  const spans: [number, number][] = [];
  let start = a;
  for (const [g0, g1] of lines) {
    spans.push([start, g0]);
    start = g1;
  }
  spans.push([start, b]);
  return { spans, found };
}

export interface SheetCheck {
  ok: boolean;
  /** the tile rectangles in sheet pixels: x, y, w, h */
  rects: [number, number, number, number][];
  /** plain words on what looked wrong, empty when fine */
  issues: string[];
}

/** Finds the tiles on a sheet and says whether the grid looks right. */
export function checkSheet(px: Pixels, cols: number, rows: number): SheetCheck {
  const xs = findCuts(whiteProfile(px, "x"), cols);
  const ys = findCuts(whiteProfile(px, "y"), rows);
  const issues: string[] = [];
  const missX = cols - 1 - xs.found;
  const missY = rows - 1 - ys.found;
  if (missX || missY) {
    issues.push(`${missX + missY} of ${cols + rows - 2} grid lines were not clear, so those tiles were cut evenly. Check that no tile is cut through a building.`);
  }
  const widths = xs.spans.map(([s, e]) => e - s);
  const heights = ys.spans.map(([s, e]) => e - s);
  const uneven = (v: number[]) => Math.max(...v) > Math.min(...v) * 1.35;
  if (uneven(widths) || uneven(heights)) issues.push("The tiles are not the same size. The model may have drawn a different grid.");
  const rects: [number, number, number, number][] = [];
  for (const [y0, y1] of ys.spans) for (const [x0, x1] of xs.spans) rects.push([x0, y0, x1 - x0, y1 - y0]);
  return { ok: issues.length === 0, rects, issues };
}

// ---------- Cutting (browser only) ----------

const TILE_WIDTH = 480;

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("The preview sheet could not be read."));
    el.src = src;
  });
}

export interface CutSheet {
  check: SheetCheck;
  /** one JPEG data URL per tile, in tile order */
  tiles: string[];
}

/** Checks a sheet and cuts it into 4:3 thumbnails about 480 px wide. */
export async function cutSheet(sheet: ImageData64, def: SheetDef): Promise<CutSheet> {
  const img = await loadImg(`data:${sheet.mimeType};base64,${sheet.data}`);
  const full = document.createElement("canvas");
  full.width = img.naturalWidth;
  full.height = img.naturalHeight;
  const ctx = full.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  // The grid search runs on a smaller copy: same answer, far fewer pixels.
  const scale = Math.min(1, 800 / full.width);
  const small = document.createElement("canvas");
  small.width = Math.round(full.width * scale);
  small.height = Math.round(full.height * scale);
  const sctx = small.getContext("2d", { willReadFrequently: true })!;
  sctx.drawImage(full, 0, 0, small.width, small.height);
  const px = sctx.getImageData(0, 0, small.width, small.height);
  const found = checkSheet(px, def.cols, def.rows);
  const rects = found.rects.map(([x, y, w, h]) => [x / scale, y / scale, w / scale, h / scale] as [number, number, number, number]);
  const tiles = rects.map(([x, y, w, h]) => {
    // Trim 2% so no gutter shows, then crop the middle to 4:3.
    const tx = x + w * 0.02;
    const ty = y + h * 0.02;
    let tw = w * 0.96;
    let th = h * 0.96;
    let ox = 0;
    let oy = 0;
    if (tw / th > 4 / 3) {
      ox = (tw - (th * 4) / 3) / 2;
      tw = (th * 4) / 3;
    } else {
      oy = (th - (tw * 3) / 4) / 2;
      th = (tw * 3) / 4;
    }
    const c = document.createElement("canvas");
    c.width = TILE_WIDTH;
    c.height = Math.round((TILE_WIDTH * 3) / 4);
    c.getContext("2d")!.drawImage(full, tx + ox, ty + oy, tw, th, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.82);
  });
  return { check: { ...found, rects }, tiles };
}

// ---------- Keeping them ----------

export interface SheetRecord {
  id: SheetDef["id"];
  createdAt: number;
  sheet: ImageData64;
  tiles: string[];
  /** tiles the user marked as wrong; their cards keep the colour board */
  hidden: number[];
  issues: string[];
  credits?: number;
}

const DB_NAME = "ai-render-suite-previews";
const STORE = "sheets";
let memory: Record<string, SheetRecord> = {};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadSheets(): Promise<Record<string, SheetRecord>> {
  try {
    const all = await withStore<SheetRecord[]>("readonly", (s) => s.getAll() as IDBRequest<SheetRecord[]>);
    return Object.fromEntries(all.map((r) => [r.id, r]));
  } catch {
    return { ...memory };
  }
}

export async function saveSheet(r: SheetRecord): Promise<void> {
  try {
    await withStore("readwrite", (s) => s.put(r));
  } catch {
    memory = { ...memory, [r.id]: r };
  }
}

export async function removeSheet(id: string): Promise<void> {
  try {
    await withStore("readwrite", (s) => s.delete(id));
  } catch {
    const { [id]: _gone, ...rest } = memory;
    memory = rest;
  }
}

/** Tile key to picture: the shipped pack first, then sheets made here on top. */
export function previewMap(sheets: Record<string, SheetRecord>): Map<string, string> {
  const out = new Map<string, string>(Object.entries(PREVIEW_PACK));
  for (const def of SHEETS) {
    const r = sheets[def.id];
    if (!r) continue;
    def.tiles.forEach((t, i) => {
      if (r.tiles[i] && !r.hidden.includes(i)) out.set(t.key, r.tiles[i]);
    });
  }
  return out;
}

/** The preview key a template card uses, or null (featured, sketch, mine). */
export function previewKey(projectType: ProjectType, styleId: string): string | null {
  if (projectType === "exterior" && EXT_STYLES.some((s) => s.id === styleId)) return `ext:${styleId}`;
  if (projectType === "interior" && INT_STYLES.some((s) => s.id === styleId)) return `int:${styleId}`;
  if (projectType === "aerial" && AERIAL_LOOKS.some((l) => l.id === styleId)) return `air:${styleId}`;
  return null;
}

/** The file you send back so the set can ship with the app. */
export function exportJson(sheets: Record<string, SheetRecord>): string {
  const tiles: Record<string, string> = {};
  for (const def of SHEETS) {
    const r = sheets[def.id];
    if (!r) continue;
    def.tiles.forEach((t, i) => {
      if (r.tiles[i] && !r.hidden.includes(i)) tiles[t.key] = r.tiles[i];
    });
  }
  return JSON.stringify({ app: "david-render-studio", kind: "style-previews", version: 1, model: SHEET_MODEL, createdAt: new Date().toISOString(), tiles });
}
