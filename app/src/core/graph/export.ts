// "Save all prompts": one .txt per image plus prompts.json, packed in one .zip
// so the browser asks for a single download. Same shape as the command-line batch.

import { baseName } from "../../lib/room";
import type { PromptItem } from "./evaluate";

export interface TextFile {
  name: string;
  text: string;
}

/** prompts.json entries, as the command-line batch writes them. */
export interface BatchEntry {
  image: string;
  result: { ok: true; presetId: string; presetName: string; prompt: string; words: number };
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function batchEntries(items: PromptItem[]): BatchEntry[] {
  return items.map((p) => ({
    image: p.name,
    result: { ok: true, presetId: p.lookId, presetName: p.lookName, prompt: p.text, words: wordCount(p.text) },
  }));
}

/** Safe file name part: letters, numbers, spaces, dots, dashes. */
export function safeName(name: string): string {
  return name.replace(/[^\p{L}\p{M}\p{N} ._-]+/gu, "").replace(/\s+/g, " ").trim().replace(/^\.+/, "").slice(0, 80) || "image";
}

/** One .txt per image (names made unique) and prompts.json. */
export function promptFiles(items: PromptItem[]): TextFile[] {
  const used = new Set<string>(["prompts.json"]);
  const files: TextFile[] = [];
  items.forEach((p, i) => {
    const base = safeName(baseName(p.name) || `image ${i + 1}`);
    let name = `${base}.txt`;
    for (let k = 2; used.has(name.toLowerCase()); k++) name = `${base}-${k}.txt`;
    used.add(name.toLowerCase());
    files.push({ name, text: `${p.text}\n` });
  });
  files.push({ name: "prompts.json", text: `${JSON.stringify(batchEntries(items), null, 2)}\n` });
  return files;
}

// ---------- a small zip writer (stored, no compression) ----------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosTime(d: Date): [number, number] {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const date = (Math.max(0, d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return [time, date];
}

/** A .zip holding the files as they are (UTF-8 names). */
export function zipFiles(files: TextFile[], when = new Date()): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder();
  const [time, date] = dosTime(when);
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const data = enc.encode(f.text);
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // UTF-8 names
    lv.setUint16(8, 0, true); // stored
    lv.setUint16(10, time, true);
    lv.setUint16(12, date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    const head = new Uint8Array(46 + name.length);
    const cv = new DataView(head.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, time, true);
    cv.setUint16(14, date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    head.set(name, 46);
    parts.push(local, data);
    central.push(head);
    offset += local.length + data.length;
  }
  const centralSize = central.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  const all = [...parts, ...central, end];
  const out = new Uint8Array(all.reduce((s, p) => s + p.length, 0));
  let at = 0;
  for (const p of all) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
