// Hand-off to the user's own Gemini (or ChatGPT / Flow) account in the web
// app: no API key and no automation of the site. The app puts the view and
// the prompt on the clipboard one at a time and opens the site in a new
// tab; the user pastes them and sends. The finished picture comes back by
// paste, drop or file.
//
// A browser clipboard holds one image or text the user can paste at a
// time, so image and prompt are two separate copies.

import { fileToImage } from "./images";
import type { ImageData64 } from "./types";

/** PNG blob of an image; clipboards only take PNG. */
async function pngBlob(img: ImageData64): Promise<Blob> {
  const res = await fetch(`data:${img.mimeType};base64,${img.data}`);
  const blob = await res.blob();
  if (img.mimeType === "image/png") return blob;
  const bmp = await createImageBitmap(blob);
  const c = document.createElement("canvas");
  c.width = bmp.width;
  c.height = bmp.height;
  c.getContext("2d")!.drawImage(bmp, 0, 0);
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not make a PNG."))), "image/png"));
}

/**
 * Puts one image on the clipboard. The ClipboardItem gets a promise so the
 * write starts inside the click (Safari needs that).
 */
export async function copyImage(img: ImageData64): Promise<void> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") throw new Error("This browser can't copy images. Use Download and drag the file into the chat instead.");
  await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob(img) })]);
}

export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.append(ta);
  ta.select();
  const ok = document.execCommand("copy");
  ta.remove();
  if (!ok) throw new Error("Copy was blocked. Select the prompt and press Ctrl+C.");
}

/** The first image on the clipboard, or null. Needs the user's permission in some browsers. */
export async function readClipboardImage(): Promise<ImageData64 | null> {
  if (!navigator.clipboard?.read) throw new Error("This browser can't read the clipboard from a button. Press Ctrl+V instead.");
  for (const item of await navigator.clipboard.read()) {
    const type = item.types.find((t) => t.startsWith("image/"));
    if (type) return fileToImage(new File([await item.getType(type)], "result", { type }), 4096);
  }
  return null;
}

/** The first image file in a paste or drop, or null. */
export async function imageFromTransfer(dt: DataTransfer | null): Promise<ImageData64 | null> {
  const file = [...(dt?.files ?? [])].find((f) => f.type.startsWith("image/"));
  return file ? fileToImage(file, 4096) : null;
}
