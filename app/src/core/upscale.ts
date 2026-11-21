// Upscale with an image model: the picture goes back through the same models the app already
// uses, with a prompt that locks the design. The models only take a fixed list of aspect ratios,
// so the picture is padded to the nearest one before it is sent and the padding is cropped away
// afterwards. That keeps the original aspect ratio exactly.

export type UpscaleStrength = "faithful" | "enhance";

const LOCK =
  "Keep the same camera, framing and composition. Do not add, remove, move or redraw any building part, window, door, column, railing, roof line, sign, object, person, plant or vehicle. Keep every colour, the light and the sky as they are. Keep any text exactly as it is and never invent new text; if something is too blurry to read, leave it as soft shapes instead of guessing.";

const PADDING = "If the picture has a soft blurred border at its edges, it is only padding: ignore it.";

/** The prompt for upscaling. Faithful sharpens and adds fine texture only; Enhance may also make materials look more real. */
export function upscalePrompt(strength: UpscaleStrength): string {
  if (strength === "enhance") {
    return `Upscale this image to a higher resolution and make it look like a sharp, high quality photograph of the same design. Improve the realism of materials (stone, tiles, plaster, timber, glass, metal, foliage, water) with fine, believable detail. ${LOCK} ${PADDING} The result must look like the same picture taken with a much better camera.`;
  }
  return `Upscale this image to a higher resolution. Make it sharper and add fine surface detail that fits what is already there: material texture, edges, leaves, glass reflections. ${LOCK} ${PADDING} The result must look like the same picture taken with a sharper camera.`;
}

export interface PadPlan {
  /** Size of the padded canvas. */
  width: number;
  height: number;
  /** Where the original sits on it. */
  x: number;
  y: number;
  /** Original size. */
  srcW: number;
  srcH: number;
  /** The original's box on the padded canvas, as fractions (0 to 1). */
  crop: { x: number; y: number; w: number; h: number };
  /** True when no padding is needed. */
  none: boolean;
}

/** How to pad a width x height picture so its ratio is exactly "W:H" (for example "16:9"). */
export function padPlan(width: number, height: number, ratio: string): PadPlan {
  const [rw, rh] = ratio.split(":").map(Number);
  const r = rw / rh;
  const own = width / height;
  let W = width;
  let H = height;
  if (Math.abs(own / r - 1) < 0.002) return { width, height, x: 0, y: 0, srcW: width, srcH: height, crop: { x: 0, y: 0, w: 1, h: 1 }, none: true };
  if (r > own) W = Math.round(height * r);
  else H = Math.round(width / r);
  const x = Math.round((W - width) / 2);
  const y = Math.round((H - height) / 2);
  return { width: W, height: H, x, y, srcW: width, srcH: height, crop: { x: x / W, y: y / H, w: width / W, h: height / H }, none: false };
}

/** The pixel box to cut from a result of the given size, using the fractions from padPlan. */
export function cropBox(resW: number, resH: number, crop: PadPlan["crop"]): { x: number; y: number; w: number; h: number } {
  const x = Math.round(crop.x * resW);
  const y = Math.round(crop.y * resH);
  const w = Math.min(resW - x, Math.round(crop.w * resW));
  const h = Math.min(resH - y, Math.round(crop.h * resH));
  return { x, y, w, h };
}

/** True when two sizes have the same shape, within a small tolerance (about one pixel on a 1000 px side). */
export function sameShape(aW: number, aH: number, bW: number, bH: number): boolean {
  return Math.abs(aW / aH / (bW / bH) - 1) < 0.003;
}
