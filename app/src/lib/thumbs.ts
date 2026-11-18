// Small thumbnails for the History grid. A full render can be several MB of
// base64; putting dozens of those into <img> tags at once froze the tab for a
// few seconds. Each thumbnail is made once, in the background, and kept for the
// visit, so switching back to History is instant.

import { base64ToBlob } from "../core/images";
import type { ImageData64 } from "../core/types";

const done = new Map<string, string>();
const working = new Map<string, Promise<string | null>>();
const queue: (() => void)[] = [];
let running = 0;
/** Two at a time, so the page stays responsive while they are made. */
const PARALLEL = 2;

function next(): void {
  while (running < PARALLEL && queue.length) {
    running++;
    queue.shift()!();
  }
}

async function shrink(img: ImageData64, maxW: number): Promise<string> {
  const blob = base64ToBlob(img);
  const bmp = await createImageBitmap(blob);
  const scale = Math.min(1, maxW / bmp.width);
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  let out: Blob;
  if (typeof OffscreenCanvas !== "undefined") {
    const c = new OffscreenCanvas(w, h);
    c.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
    out = await c.convertToBlob({ type: "image/jpeg", quality: 0.82 });
  } else {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
    out = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("no thumbnail"))), "image/jpeg", 0.82));
  }
  bmp.close?.();
  return URL.createObjectURL(out);
}

/** The thumbnail if it is ready. */
export function readyThumb(id: string): string | undefined {
  return done.get(id);
}

/** Makes (or returns) the thumbnail for a History item. Null if the picture can't be read. */
export function thumbFor(id: string, img: ImageData64, maxW = 560): Promise<string | null> {
  const have = done.get(id);
  if (have) return Promise.resolve(have);
  const busy = working.get(id);
  if (busy) return busy;
  const p = new Promise<string | null>((resolve) => {
    queue.push(() => {
      shrink(img, maxW)
        .then((url) => {
          done.set(id, url);
          resolve(url);
        })
        .catch(() => resolve(null))
        .finally(() => {
          working.delete(id);
          running--;
          next();
        });
    });
    next();
  });
  working.set(id, p);
  return p;
}

/** Frees thumbnails of items that are no longer in History. */
export function forgetThumbs(keep: Set<string>): void {
  for (const [id, url] of done) {
    if (!keep.has(id)) {
      URL.revokeObjectURL(url);
      done.delete(id);
    }
  }
}
