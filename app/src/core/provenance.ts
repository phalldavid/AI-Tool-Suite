// Prompt and history that travel inside the picture file.
//
// PNG: two iTXt chunks placed right after IHDR. Pixels are never touched.
//   "Description"     the plain prompt (readable in many viewers and in ComfyUI-style tools)
//   "DRS-Provenance"  the full record as JSON (prompt, model, chain of earlier steps, small input picture)
// JPEG: one COM segment with a compact record (no thumbnails, JPEG segments stop at 64 KB).
// Other formats are returned unchanged.
//
// Messaging apps, screenshots and "save as JPG" remove this. Send images as files to keep it.
// Pure byte work, no DOM, so it also runs in the tests.

import type { ImageData64 } from "./types";

export const PROV_KEY = "DRS-Provenance";
const DESC_KEY = "Description";
const JPEG_TAG = "DRS1:";
export const MAX_CHAIN = 30;

export interface ChainStep {
  id: string;
  at: number;
  tool: string;
  preset?: string;
  prompt: string;
  model: string;
}

export interface Provenance {
  v: 1;
  app: "David Render Studio";
  id: string;
  createdAt: number;
  tool: string;
  preset?: string;
  prompt: string;
  provider: string;
  model: string;
  credits?: number;
  project?: string;
  /** Id of the record this picture was made from, when it had one. */
  parent?: string;
  /** Earlier steps, oldest first. */
  chain: ChainStep[];
  /** Small copies (JPEG, base64) of what the render was made from. */
  inputs: { role: "before"; thumb: string; w?: number; h?: number }[];
}

/** The fields of a History item the record needs. */
export interface ProvSource {
  id: string;
  createdAt: number;
  tool: string;
  presetName?: string;
  prompt: string;
  provider: string;
  model: string;
  credits?: number;
  project?: string;
}

export function stepOf(p: Provenance): ChainStep {
  return { id: p.id, at: p.createdAt, tool: p.tool, preset: p.preset, prompt: p.prompt, model: p.model };
}

/** Builds the record for one render. `parent` is the record of the picture it was made from, if any. */
export function buildProvenance(item: ProvSource, parent?: Provenance, thumb?: { data: string; width?: number; height?: number }): Provenance {
  const chain = parent ? [...parent.chain, stepOf(parent)].slice(-MAX_CHAIN) : [];
  return {
    v: 1,
    app: "David Render Studio",
    id: item.id,
    createdAt: item.createdAt,
    tool: item.tool,
    preset: item.presetName,
    prompt: item.prompt,
    provider: item.provider,
    model: item.model,
    credits: item.credits,
    project: item.project,
    parent: parent?.id,
    chain,
    inputs: thumb ? [{ role: "before", thumb: thumb.data, w: thumb.width, h: thumb.height }] : [],
  };
}

// ---------- registry of pictures we know the record of ----------

const known = new Map<string, Provenance>();

/** Cheap fingerprint of a base64 picture: length plus 24 sampled characters. */
export function fingerprint(data: string): string {
  const n = data.length;
  let s = String(n);
  for (let i = 0; i < 24; i++) s += data[Math.floor(((n - 1) * i) / 23)];
  return s;
}

export function rememberProvenance(data: string, p: Provenance): void {
  known.set(fingerprint(data), p);
  if (known.size > 400) known.delete(known.keys().next().value as string);
}

export function provenanceOf(data: string): Provenance | undefined {
  return known.get(fingerprint(data));
}

// ---------- bytes ----------

export function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(parts: Uint8Array[]): number {
  let c = 0xffffffff;
  for (const p of parts) for (let i = 0; i < p.length; i++) c = CRC[(c ^ p[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const enc = new TextEncoder();
const dec = new TextDecoder("utf-8");
const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];

function isPng(b: Uint8Array): boolean {
  return b.length > 33 && PNG_SIG.every((v, i) => b[i] === v);
}

function isJpeg(b: Uint8Array): boolean {
  return b.length > 4 && b[0] === 0xff && b[1] === 0xd8;
}

const u32 = (b: Uint8Array, o: number): number => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;

function itxt(keyword: string, text: string): Uint8Array {
  const body = [enc.encode(keyword), new Uint8Array([0, 0, 0, 0, 0]), enc.encode(text)];
  const data = new Uint8Array(body.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of body) {
    data.set(p, o);
    o += p.length;
  }
  const type = enc.encode("iTXt");
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  out.set(type, 4);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32([type, data]));
  return out;
}

interface Chunk {
  type: string;
  start: number;
  end: number;
  data: number;
  len: number;
}

function pngChunks(b: Uint8Array): Chunk[] {
  const list: Chunk[] = [];
  let o = 8;
  while (o + 12 <= b.length) {
    const len = u32(b, o);
    const type = String.fromCharCode(b[o + 4], b[o + 5], b[o + 6], b[o + 7]);
    const end = o + 12 + len;
    if (end > b.length) break;
    list.push({ type, start: o, end, data: o + 8, len });
    o = end;
    if (type === "IEND") break;
  }
  return list;
}

function itxtKeyword(b: Uint8Array, c: Chunk): string {
  let e = c.data;
  while (e < c.data + c.len && b[e] !== 0) e++;
  return dec.decode(b.subarray(c.data, e));
}

function itxtText(b: Uint8Array, c: Chunk): string | null {
  let o = c.data;
  const stop = c.data + c.len;
  while (o < stop && b[o] !== 0) o++; // keyword
  o++;
  const compressed = b[o];
  o += 2; // flag, method
  while (o < stop && b[o] !== 0) o++; // language tag
  o++;
  while (o < stop && b[o] !== 0) o++; // translated keyword
  o++;
  if (compressed || o > stop) return null; // we never write compressed text
  return dec.decode(b.subarray(o, stop));
}

// ---------- write ----------

/** Cuts a long prompt for the plain-text field. */
function shortPrompt(s: string): string {
  return s.length > 4000 ? `${s.slice(0, 4000)}…` : s;
}

function embedPng(b: Uint8Array, p: Provenance): Uint8Array {
  const chunks = pngChunks(b);
  const ihdr = chunks.find((c) => c.type === "IHDR");
  if (!ihdr) return b;
  const ours = (c: Chunk) => c.type === "iTXt" && (itxtKeyword(b, c) === PROV_KEY || itxtKeyword(b, c) === DESC_KEY);
  const add = [itxt(DESC_KEY, shortPrompt(p.prompt)), itxt(PROV_KEY, JSON.stringify(p))];
  const kept = chunks.filter((c) => !ours(c));
  const size = 8 + kept.reduce((n, c) => n + (c.end - c.start), 0) + add.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(size);
  out.set(b.subarray(0, 8), 0);
  let o = 8;
  for (const c of kept) {
    out.set(b.subarray(c.start, c.end), o);
    o += c.end - c.start;
    if (c.type === "IHDR") {
      for (const a of add) {
        out.set(a, o);
        o += a.length;
      }
    }
  }
  return out;
}

function compact(p: Provenance): Provenance {
  let q: Provenance = { ...p, inputs: [] };
  // JPEG segments hold 65,533 bytes: drop the oldest steps, then trim long prompts.
  while (enc.encode(JPEG_TAG + JSON.stringify(q)).length > 65000 && q.chain.length) q = { ...q, chain: q.chain.slice(1) };
  if (enc.encode(JPEG_TAG + JSON.stringify(q)).length > 65000) q = { ...q, prompt: q.prompt.slice(0, 20000), chain: [] };
  return q;
}

function embedJpeg(b: Uint8Array, p: Provenance): Uint8Array {
  // Walk the leading segments, remove an old record, and insert ours before the first non-APP segment.
  let o = 2;
  const keep: [number, number][] = [];
  let insertAt = 2;
  while (o + 4 <= b.length && b[o] === 0xff) {
    const m = b[o + 1];
    const len = (b[o + 2] << 8) | b[o + 3];
    const end = o + 2 + len;
    if (m === 0xda || end > b.length) break;
    const isOld = m === 0xfe && dec.decode(b.subarray(o + 4, o + 4 + JPEG_TAG.length)) === JPEG_TAG;
    if (!isOld) keep.push([o, end]);
    if (m >= 0xe0 && m <= 0xef) insertAt = isOld ? insertAt : end;
    o = end;
  }
  const payload = enc.encode(JPEG_TAG + JSON.stringify(compact(p)));
  const seg = new Uint8Array(4 + payload.length);
  seg[0] = 0xff;
  seg[1] = 0xfe;
  seg[2] = ((payload.length + 2) >> 8) & 0xff;
  seg[3] = (payload.length + 2) & 0xff;
  seg.set(payload, 4);
  // Rebuild: SOI, kept leading segments up to insertAt, ours, the rest.
  const head: Uint8Array[] = [b.subarray(0, 2)];
  const tail: Uint8Array[] = [];
  for (const [s, e] of keep) (e <= insertAt ? head : tail).push(b.subarray(s, e));
  tail.push(b.subarray(o));
  const parts = [...head, seg, ...tail];
  const out = new Uint8Array(parts.reduce((n, x) => n + x.length, 0));
  let w = 0;
  for (const x of parts) {
    out.set(x, w);
    w += x.length;
  }
  return out;
}

/** The picture with the record inside. Unknown formats come back unchanged. */
export function embedProvenance(img: ImageData64, p: Provenance): ImageData64 {
  const bytes = b64ToBytes(img.data);
  let out = bytes;
  if (isPng(bytes)) out = embedPng(bytes, p);
  else if (isJpeg(bytes)) out = embedJpeg(bytes, p);
  else return img;
  return { ...img, data: bytesToB64(out) };
}

// ---------- read ----------

/** The record inside a PNG or JPEG file, or null. Never throws. */
export function readProvenance(bytes: Uint8Array): Provenance | null {
  try {
    if (isPng(bytes)) {
      for (const c of pngChunks(bytes)) {
        if (c.type === "iTXt" && itxtKeyword(bytes, c) === PROV_KEY) {
          const text = itxtText(bytes, c);
          return text ? validate(JSON.parse(text)) : null;
        }
      }
      return null;
    }
    if (isJpeg(bytes)) {
      let o = 2;
      while (o + 4 <= bytes.length && bytes[o] === 0xff) {
        const m = bytes[o + 1];
        const len = (bytes[o + 2] << 8) | bytes[o + 3];
        if (m === 0xda) break;
        if (m === 0xfe) {
          const text = dec.decode(bytes.subarray(o + 4, o + 2 + len));
          if (text.startsWith(JPEG_TAG)) return validate(JSON.parse(text.slice(JPEG_TAG.length)));
        }
        o += 2 + len;
      }
    }
  } catch {
    /* damaged or not ours */
  }
  return null;
}

export function readProvenanceB64(data: string): Provenance | null {
  try {
    return readProvenance(b64ToBytes(data));
  } catch {
    return null;
  }
}

function validate(x: unknown): Provenance | null {
  const p = x as Partial<Provenance> | null;
  if (!p || p.v !== 1 || p.app !== "David Render Studio" || typeof p.prompt !== "string" || typeof p.id !== "string") return null;
  return { ...(p as Provenance), chain: Array.isArray(p.chain) ? p.chain : [], inputs: Array.isArray(p.inputs) ? p.inputs : [] };
}
