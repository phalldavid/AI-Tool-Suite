// Small thumbnails for the History grid. A full render can be several MB of
// base64; putting dozens of those into <img> tags froze the tab, and making
// thumbnails on every visit still left cards empty for seconds. Each thumbnail
// is now made once, kept on this device (IndexedDB, its own small database),
// and made ahead of time in the background, so History opens with them ready.
// If storage is not available, they are kept for the visit only.

import type { ImageData64 } from "../core/types";

const DB = "drs2-thumbs";
const STORE = "thumbs";
const done = new Map<string, string>();
const working = new Map<string, Promise<string | null>>();
const queue: (() => void)[] = [];
let running = 0;
/** Two at a time, so the page stays responsive while they are made. */
const PARALLEL = 2;

let dbp: Promise<IDBDatabase | null> | null = null;
function db(): Promise<IDBDatabase | null> {
  if (!dbp) {
    dbp = new Promise((resolve) => {
      try {
        const r = indexedDB.open(DB, 1);
        r.onupgradeneeded = () => r.result.createObjectStore(STORE);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return dbp;
}

async function stored(id: string): Promise<Blob | null> {
  const d = await db();
  if (!d) return null;
  return new Promise((resolve) => {
    try {
      const q = d.transaction(STORE, "readonly").objectStore(STORE).get(id);
      q.onsuccess = () => resolve(q.result instanceof Blob ? q.result : null);
      q.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function keep(id: string, blob: Blob): Promise<void> {
  const d = await db();
  if (!d) return;
  try {
    d.transaction(STORE, "readwrite").objectStore(STORE).put(blob, id);
  } catch {
    /* kept for this visit only */
  }
}

function next(): void {
  while (running < PARALLEL && queue.length) {
    running++;
    queue.shift()!();
  }
}

async function shrink(img: ImageData64, maxW: number): Promise<Blob> {
  // The browser decodes the base64 itself (off the page's own work), and the
  // picture is scaled while it is decoded.
  const blob = await (await fetch(`data:${img.mimeType};base64,${img.data}`)).blob();
  const w0 = img.width ?? 0;
  const bmp = w0 > maxW ? await createImageBitmap(blob, { resizeWidth: maxW, resizeQuality: "medium" }) : await createImageBitmap(blob);
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
  return out;
}

/** The thumbnail if it is ready. */
export function readyThumb(id: string): string | undefined {
  return done.get(id);
}

/** Makes (or returns) the thumbnail. Null if the picture can't be read. */
export function thumbFor(id: string, img: ImageData64, maxW = 560, persist = true): Promise<string | null> {
  const have = done.get(id);
  if (have) return Promise.resolve(have);
  const busy = working.get(id);
  if (busy) return busy;
  const p = (async () => {
    const saved = persist ? await stored(id) : null;
    if (saved) {
      const url = URL.createObjectURL(saved);
      done.set(id, url);
      return url;
    }
    return new Promise<string | null>((resolve) => {
      queue.push(() => {
        shrink(img, maxW)
          .then((blob) => {
            if (persist) void keep(id, blob);
            const url = URL.createObjectURL(blob);
            done.set(id, url);
            resolve(url);
          })
          .catch(() => resolve(null))
          .finally(() => {
            running--;
            next();
          });
      });
      next();
    });
  })().finally(() => working.delete(id));
  working.set(id, p);
  return p;
}

/** Frees thumbnails of items that are no longer in History (memory and storage). */
export function forgetThumbs(keepIds: Set<string>): void {
  for (const [id, url] of done) {
    if (!keepIds.has(id)) {
      URL.revokeObjectURL(url);
      done.delete(id);
    }
  }
  void db().then((d) => {
    if (!d) return;
    try {
      const s = d.transaction(STORE, "readwrite").objectStore(STORE);
      const q = s.getAllKeys();
      q.onsuccess = () => {
        for (const k of q.result) if (typeof k === "string" && !keepIds.has(k)) s.delete(k);
      };
    } catch {
      /* nothing to clean */
    }
  });
}

/**
 * Makes History thumbnails ahead of time, a little after the app starts and
 * only while the page is idle, so the History tab opens with them ready.
 */
export function warmThumbs(items: { id: string; after: ImageData64 }[]): void {
  const list = items.slice(0, 60);
  let i = 0;
  const idle = (cb: () => void) =>
    typeof requestIdleCallback === "function" ? requestIdleCallback(cb, { timeout: 4000 }) : window.setTimeout(cb, 300);
  const step = () => {
    if (i >= list.length) return;
    const it = list[i++];
    void thumbFor(it.id, it.after).finally(() => idle(step));
  };
  window.setTimeout(() => idle(step), 2500);
}
