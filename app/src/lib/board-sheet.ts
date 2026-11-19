// Lays a board picture onto a true A-series sheet: the picture, numbered pins, a
// legend and a title block. All text is drawn here, never by the model.

import { canvasToImage, loadImage } from "../core/images";
import type { ImageData64 } from "../core/types";
import { boardLayout, sheetPixels, type BoardPin, type Orientation, type SheetSize } from "../core/boards";

export interface SheetInput {
  picture: ImageData64;
  size: SheetSize;
  orient: Orientation;
  pins: BoardPin[];
  title: string;
  project: string;
  /** e.g. "19 Nov 2026" */
  date: string;
  dpi?: number;
}

const FONT = '"Inter", "Segoe UI", "Noto Sans Khmer", "Khmer OS", Arial, sans-serif';
const INK = "#1d1d1f";
const MUTED = "#6e6e73";
const PAPER = "#fbfaf7";

/** Where the picture sits inside its area once fitted (contain), in sheet mm. */
export function fitPicture(area: { x: number; y: number; w: number; h: number }, imgW: number, imgH: number) {
  const k = Math.min(area.w / imgW, area.h / imgH);
  const w = imgW * k;
  const h = imgH * k;
  return { x: area.x + (area.w - w) / 2, y: area.y + (area.h - h) / 2, w, h };
}

export async function composeSheet(i: SheetInput): Promise<ImageData64> {
  const L = boardLayout(i.size, i.orient);
  const px = sheetPixels(i.size, i.orient, i.dpi ?? 150);
  const k = px.scale; // px per mm
  const c = document.createElement("canvas");
  c.width = px.w;
  c.height = px.h;
  const g = c.getContext("2d")!;
  g.fillStyle = PAPER;
  g.fillRect(0, 0, c.width, c.height);

  const img = await loadImage(i.picture);
  const fit = fitPicture(L.pic, img.naturalWidth, img.naturalHeight);
  g.imageSmoothingQuality = "high";
  g.drawImage(img, fit.x * k, fit.y * k, fit.w * k, fit.h * k);

  const short = Math.min(L.w, L.h);
  const r = short * 0.011; // pin radius in mm
  i.pins.forEach((p, n) => drawPin(g, (fit.x + p.x * fit.w) * k, (fit.y + p.y * fit.h) * k, r * k, n + 1));

  // band: thin rule, legend on the left, title block on the right
  const b = L.band;
  g.strokeStyle = INK;
  g.lineWidth = Math.max(1, 0.35 * k);
  g.beginPath();
  g.moveTo(b.x * k, b.y * k);
  g.lineTo((b.x + b.w) * k, b.y * k);
  g.stroke();

  const titleW = b.w * (i.orient === "landscape" ? 0.3 : 0.42);
  const legendW = b.w - titleW - short * 0.02;
  drawLegend(g, i.pins, { x: b.x, y: b.y, w: legendW, h: b.h }, k, short, r);
  drawTitle(g, i, { x: b.x + b.w - titleW, y: b.y, w: titleW, h: b.h }, k, short);
  return canvasToImage(c, "image/png");
}

function drawPin(g: CanvasRenderingContext2D, x: number, y: number, r: number, n: number) {
  g.save();
  g.shadowColor = "rgba(0,0,0,0.3)";
  g.shadowBlur = r * 0.5;
  g.fillStyle = INK;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.restore();
  g.strokeStyle = "#ffffff";
  g.lineWidth = r * 0.14;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = "#ffffff";
  g.font = `700 ${r * 1.15}px ${FONT}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(String(n), x, y + r * 0.05);
}

function drawLegend(g: CanvasRenderingContext2D, pins: BoardPin[], box: { x: number; y: number; w: number; h: number }, k: number, short: number, r: number) {
  if (!pins.length) return;
  const pad = short * 0.012;
  const rows = Math.max(1, Math.floor((box.h - pad) / (short * 0.026)));
  const cols = Math.ceil(pins.length / rows);
  const colW = box.w / Math.max(cols, 1);
  const rowH = (box.h - pad * 1.5) / Math.min(rows, pins.length);
  const pr = Math.min(r * 0.95, rowH * 0.36);
  pins.forEach((p, n) => {
    const col = Math.floor(n / rows);
    const row = n % rows;
    const cx = box.x + col * colW + pr;
    const cy = box.y + pad + row * rowH + rowH / 2;
    drawPin(g, cx * k, cy * k, pr * k, n + 1);
    g.fillStyle = INK;
    g.font = `500 ${pr * 1.5 * k}px ${FONT}`;
    g.textAlign = "left";
    g.textBaseline = "middle";
    fitText(g, p.text || "—", (cx + pr * 1.8) * k, cy * k, (colW - pr * 3) * k);
  });
}

function drawTitle(g: CanvasRenderingContext2D, i: SheetInput, box: { x: number; y: number; w: number; h: number }, k: number, short: number) {
  const pad = short * 0.012;
  g.strokeStyle = INK;
  g.lineWidth = Math.max(1, 0.25 * k);
  g.beginPath();
  g.moveTo(box.x * k, (box.y + pad) * k);
  g.lineTo(box.x * k, (box.y + box.h) * k);
  g.stroke();
  const x = box.x + pad * 1.5;
  const w = box.w - pad * 2;
  g.textAlign = "left";
  g.textBaseline = "alphabetic";
  g.fillStyle = INK;
  g.font = `700 ${short * 0.03 * k}px ${FONT}`;
  fitText(g, (i.title || "Presentation board").toUpperCase(), x * k, (box.y + box.h * 0.42) * k, w * k);
  g.fillStyle = MUTED;
  g.font = `500 ${short * 0.016 * k}px ${FONT}`;
  if (i.project) fitText(g, i.project, x * k, (box.y + box.h * 0.66) * k, w * k);
  fitText(g, `${i.size} ${i.orient === "landscape" ? "landscape" : "portrait"} · ${i.date}`, x * k, (box.y + box.h * 0.88) * k, w * k);
}

/** Draws text, shrinking it to fit the width. */
function fitText(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number) {
  const m = g.measureText(text).width;
  if (m <= maxW || m === 0) return g.fillText(text, x, y);
  g.save();
  const font = g.font;
  const size = parseFloat(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? "12");
  g.font = font.replace(/\d+(?:\.\d+)?px/, `${(size * maxW) / m}px`);
  g.fillText(text, x, y);
  g.restore();
}
