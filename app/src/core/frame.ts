// Render frame: the aspect ratio the render will have. The same rule is used
// by the SketchUp overlay (frame.rb) so the crop matches what was shown.

import type { ImageData64 } from "./types";
import { canvasToImage, loadImage } from "./images";

export interface FrameOption {
  id: string;
  label: string;
  /** width / height; 0 = keep the viewport or image as it is */
  ratio: number;
  hint: string;
}

// Only ratios Gemini image models can output, so nothing is stretched.
export const FRAMES: FrameOption[] = [
  { id: "free", label: "View", ratio: 0, hint: "Whole viewport" },
  { id: "1:1", label: "1:1", ratio: 1, hint: "Social square" },
  { id: "16:9", label: "16:9", ratio: 16 / 9, hint: "Screens, video" },
  { id: "9:16", label: "9:16", ratio: 9 / 16, hint: "Stories, phone" },
  { id: "5:4", label: "5:4", ratio: 5 / 4, hint: "Print, boards" },
  { id: "4:5", label: "4:5", ratio: 4 / 5, hint: "Social portrait" },
  { id: "4:3", label: "4:3", ratio: 4 / 3, hint: "Boards" },
  { id: "3:4", label: "3:4", ratio: 3 / 4, hint: "Portrait board" },
  { id: "3:2", label: "3:2", ratio: 3 / 2, hint: "Camera photo" },
  { id: "21:9", label: "21:9", ratio: 21 / 9, hint: "Panorama street" },
];

/** The one row of frames on the stage, in landscape; swap flips them to portrait. */
export const FRAME_ROW = ["free", "1:1", "16:9", "5:4", "4:3"];

/** A listed frame, or any "W:H" ratio typed by the user. */
export function findFrame(id: string): FrameOption {
  const listed = FRAMES.find((f) => f.id === id);
  if (listed) return listed;
  const m = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(id);
  if (m && Number(m[1]) > 0 && Number(m[2]) > 0) {
    return { id, label: id, ratio: Number(m[1]) / Number(m[2]), hint: "Custom ratio" };
  }
  return FRAMES[0];
}

export function isListed(id: string): boolean {
  return FRAMES.some((f) => f.id === id);
}

/** 4:5 becomes 5:4. The whole view and squares stay as they are. */
export function swapFrameId(id: string): string {
  const m = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(id);
  if (!m || m[1] === m[2]) return id;
  return `${m[2]}:${m[1]}`;
}

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}

export interface PixelRatio {
  /** exact ratio in lowest terms, e.g. 5:4 for 2500 x 2000 */
  exact: string;
  /** a short ratio within 1% when the exact one has big numbers, e.g. 16:9 for 1921 x 1080 */
  simple: string;
  ratio: number;
}

/** Works out the aspect ratio of a pixel size. */
export function ratioFromPixels(width: number, height: number): PixelRatio | null {
  const w = Math.round(width);
  const hh = Math.round(height);
  if (!(w > 0 && hh > 0)) return null;
  const g = gcd(w, hh);
  const exact = `${w / g}:${hh / g}`;
  const ratio = w / hh;
  let simple = exact;
  if (w / g > 32 || hh / g > 32) {
    let best = Infinity;
    for (let b = 1; b <= 32; b++) {
      const a = Math.round(ratio * b);
      if (a < 1) continue;
      const err = Math.abs(a / b / ratio - 1);
      if (err < best - 1e-9) {
        best = err;
        const k = gcd(a, b);
        simple = `${a / k}:${b / k}`;
      }
      if (best < 0.002) break;
    }
    if (best > 0.01) simple = exact;
  }
  return { exact, simple, ratio };
}

/** Largest rectangle of `ratio` inside width x height, centred. */
export function frameRect(width: number, height: number, ratio: number): [number, number, number, number] {
  if (!ratio || ratio <= 0) return [0, 0, width, height];
  if (width / height > ratio) {
    const w = height * ratio;
    return [(width - w) / 2, 0, w, height];
  }
  const h = width / ratio;
  return [0, (height - h) / 2, width, h];
}

/** Crops an image to a pixel rectangle. */
export async function cropImage(img: ImageData64, rect: [number, number, number, number]): Promise<ImageData64> {
  const el = await loadImage(img);
  const [x, y, w, h] = rect.map((v) => Math.round(v));
  if (x === 0 && y === 0 && w === el.naturalWidth && h === el.naturalHeight) {
    return { ...img, width: w, height: h };
  }
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d")!.drawImage(el, x, y, w, h, 0, 0, w, h);
  return canvasToImage(c, img.mimeType === "image/png" ? "image/png" : "image/jpeg", 0.92);
}

/** Crops an uploaded image to the chosen ratio, centred. */
export async function cropToRatio(img: ImageData64, ratio: number): Promise<ImageData64> {
  if (!ratio) return img;
  const el = await loadImage(img);
  return cropImage(img, frameRect(el.naturalWidth, el.naturalHeight, ratio));
}
