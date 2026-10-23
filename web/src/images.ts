// Image helpers: conversion between base64, blobs, canvases and <img>.

import type { ImageData64 } from "./types";

export function toDataUrl(img: ImageData64): string {
  return `data:${img.mimeType};base64,${img.data}`;
}

export function base64ToBlob(img: ImageData64): Blob {
  const bin = atob(img.data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: img.mimeType });
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export function loadImage(img: ImageData64): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Could not read image"));
    el.src = toDataUrl(img);
  });
}

export function canvasToImage(canvas: HTMLCanvasElement, mimeType = "image/png", quality = 0.92): ImageData64 {
  const url = canvas.toDataURL(mimeType, quality);
  return { mimeType, data: url.split(",")[1] ?? "", width: canvas.width, height: canvas.height };
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");
  return [c, ctx];
}

/** Reads an uploaded file, scaling it so the long side is at most maxSide px. */
export async function fileToImage(file: File, maxSide = 2048): Promise<ImageData64> {
  const data = await blobToBase64(file);
  const src: ImageData64 = { mimeType: file.type || "image/png", data };
  const el = await loadImage(src);
  const scale = Math.min(1, maxSide / Math.max(el.naturalWidth, el.naturalHeight));
  const w = Math.round(el.naturalWidth * scale);
  const h = Math.round(el.naturalHeight * scale);
  const [c, ctx] = makeCanvas(w, h);
  ctx.drawImage(el, 0, 0, w, h);
  return canvasToImage(c, "image/jpeg", 0.92);
}

export async function imageSize(img: ImageData64): Promise<{ width: number; height: number }> {
  if (img.width && img.height) return { width: img.width, height: img.height };
  const el = await loadImage(img);
  return { width: el.naturalWidth, height: el.naturalHeight };
}

/** The original with the mask painted over it in red, for the model to read. */
export async function redOverlay(original: ImageData64, mask: HTMLCanvasElement): Promise<ImageData64> {
  const el = await loadImage(original);
  const [c, ctx] = makeCanvas(el.naturalWidth, el.naturalHeight);
  ctx.drawImage(el, 0, 0);
  const [tint, tctx] = makeCanvas(c.width, c.height);
  tctx.drawImage(mask, 0, 0, c.width, c.height);
  tctx.globalCompositeOperation = "source-in";
  tctx.fillStyle = "rgb(255,0,0)";
  tctx.fillRect(0, 0, c.width, c.height);
  ctx.globalAlpha = 0.65;
  ctx.drawImage(tint, 0, 0);
  return canvasToImage(c, "image/jpeg", 0.92);
}

/**
 * Pastes the edited area from `result` onto `original`, using the painted
 * mask with a soft edge. Everything outside the mask stays pixel-exact.
 */
export async function compositeMasked(
  original: ImageData64,
  result: ImageData64,
  mask: HTMLCanvasElement,
  featherPx = 12,
): Promise<ImageData64> {
  const base = await loadImage(original);
  const edit = await loadImage(result);
  const w = base.naturalWidth;
  const h = base.naturalHeight;
  const [c, ctx] = makeCanvas(w, h);
  ctx.drawImage(base, 0, 0);

  const [m, mctx] = makeCanvas(w, h);
  mctx.filter = `blur(${featherPx}px)`;
  mctx.drawImage(mask, 0, 0, w, h);
  mctx.filter = "none";
  mctx.globalCompositeOperation = "source-in";
  mctx.drawImage(edit, 0, 0, w, h);

  ctx.drawImage(m, 0, 0);
  return canvasToImage(c, "image/png");
}

/** Scales an image to the given size (used when the model returns a different size). */
export async function resizeTo(img: ImageData64, width: number, height: number): Promise<ImageData64> {
  const el = await loadImage(img);
  if (el.naturalWidth === width && el.naturalHeight === height) return { ...img, width, height };
  const [c, ctx] = makeCanvas(width, height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(el, 0, 0, width, height);
  return canvasToImage(c, "image/png");
}
