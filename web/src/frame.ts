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
  { id: "16:9", label: "16:9", ratio: 16 / 9, hint: "Screens, video" },
  { id: "3:2", label: "3:2", ratio: 3 / 2, hint: "Camera photo" },
  { id: "4:3", label: "4:3", ratio: 4 / 3, hint: "Boards" },
  { id: "21:9", label: "21:9", ratio: 21 / 9, hint: "Panorama street" },
  { id: "1:1", label: "1:1", ratio: 1, hint: "Social square" },
  { id: "4:5", label: "4:5", ratio: 4 / 5, hint: "Social portrait" },
  { id: "3:4", label: "3:4", ratio: 3 / 4, hint: "Portrait board" },
  { id: "9:16", label: "9:16", ratio: 9 / 16, hint: "Stories, phone" },
];

export function findFrame(id: string): FrameOption {
  return FRAMES.find((f) => f.id === id) ?? FRAMES[0];
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
