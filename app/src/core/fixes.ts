// Fix list from a render inspection ("snag list"): what is wrong, where, how big the fix is,
// and the prompt that fixes it. The inspector writes a drs-fixes/1 JSON file; this module reads
// it, checks it, and works out what the app can run by itself.
//
// Pure (no DOM), so it runs in the tests.

export const FIX_SCHEMA = "drs-fixes/1";

export type FixMethod = "accept" | "hand" | "spot-edit" | "relight" | "re-render" | "source";
export type Severity = "blocker" | "major" | "minor" | "note";
export type FixStatus = "open" | "applied" | "accepted" | "rejected" | "recheck" | "closed" | "wontfix";
export type FixSize = 0 | 1 | 2 | 3 | 4 | 5;

export const CATEGORIES = ["fidelity", "construction", "lighting", "finish", "fixture", "furniture", "reflection", "consistency", "quality", "framing", "prompt"] as const;
export type Category = (typeof CATEGORIES)[number];

/** How big each fix is, in plain words. */
export const SIZE_LABEL: Record<FixSize, string> = {
  0: "Accept as is",
  1: "Hand fix (Photopea)",
  2: "Spot edit (one area)",
  3: "Whole-picture relight",
  4: "Re-render, same source",
  5: "Fix the model or camera first",
};

export interface Patch {
  /** Lines added to the end of the original prompt. */
  add?: string[];
  /** Phrases of the original prompt to swap. */
  replace?: { from: string; to: string }[];
}

export interface Finding {
  id: string;
  category: Category;
  severity: Severity;
  title: string;
  what: string;
  /** What the prompt, brief or source said it should be. */
  expected?: string;
  /** Where, as fractions of the picture: [x, y, width, height]. */
  box?: [number, number, number, number];
  fix: {
    size: FixSize;
    method: FixMethod;
    /** The instruction to copy, or to send to the model for a spot edit. */
    prompt: string;
    /** Relight id for method "relight" (default "night"). */
    light?: string;
    patch?: Patch;
    risk?: string;
    confidence?: "high" | "medium" | "low";
  };
  status: FixStatus;
}

export interface FixEntry {
  /** File name the inspection was made on. */
  image: string;
  /** Record id from the picture's embedded history, when it had one. */
  imageId?: string;
  room?: string;
  verdict: "pass" | "conditional" | "fail";
  summary?: string;
  findings: Finding[];
}

export interface FixFile {
  schema: typeof FIX_SCHEMA;
  project?: string;
  inspectedAt: string;
  inspector: string;
  /** What the inspection assumed the design to be (materials, time of day, furniture set). */
  brief?: string[];
  images: FixEntry[];
}

const METHODS: FixMethod[] = ["accept", "hand", "spot-edit", "relight", "re-render", "source"];
const SEVERITIES: Severity[] = ["blocker", "major", "minor", "note"];
const STATUSES: FixStatus[] = ["open", "applied", "accepted", "rejected", "recheck", "closed", "wontfix"];

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);

function boxOf(v: unknown): [number, number, number, number] | undefined {
  if (!Array.isArray(v) || v.length !== 4 || !v.every(num)) return undefined;
  const [x, y, w, h] = v as number[];
  const cx = Math.min(1, Math.max(0, x));
  const cy = Math.min(1, Math.max(0, y));
  const cw = Math.min(1 - cx, Math.max(0, w));
  const ch = Math.min(1 - cy, Math.max(0, h));
  return cw > 0.005 && ch > 0.005 ? [cx, cy, cw, ch] : undefined;
}

function findingOf(x: unknown, n: number): Finding | null {
  const f = x as Record<string, unknown> | null;
  if (!f || typeof f !== "object") return null;
  const fix = (f.fix ?? {}) as Record<string, unknown>;
  const method = METHODS.includes(fix.method as FixMethod) ? (fix.method as FixMethod) : "hand";
  const size = num(fix.size) && fix.size >= 0 && fix.size <= 5 ? (Math.round(fix.size) as FixSize) : 1;
  const title = str(f.title);
  if (!title) return null;
  const p = (fix.patch ?? {}) as Record<string, unknown>;
  const patch: Patch | undefined =
    p && (Array.isArray(p.add) || Array.isArray(p.replace))
      ? {
          add: Array.isArray(p.add) ? p.add.filter((s): s is string => typeof s === "string" && !!s.trim()) : undefined,
          replace: Array.isArray(p.replace)
            ? (p.replace as Record<string, unknown>[]).filter((r) => r && typeof r.from === "string" && typeof r.to === "string").map((r) => ({ from: r.from as string, to: r.to as string }))
            : undefined,
        }
      : undefined;
  return {
    id: str(f.id, `f${n + 1}`),
    category: (CATEGORIES as readonly string[]).includes(str(f.category)) ? (f.category as Category) : "quality",
    severity: SEVERITIES.includes(f.severity as Severity) ? (f.severity as Severity) : "minor",
    title,
    what: str(f.what),
    expected: str(f.expected) || undefined,
    box: boxOf(f.box),
    fix: {
      size,
      method,
      prompt: str(fix.prompt),
      light: str(fix.light) || undefined,
      patch,
      risk: str(fix.risk) || undefined,
      confidence: fix.confidence === "high" || fix.confidence === "medium" || fix.confidence === "low" ? fix.confidence : undefined,
    },
    status: STATUSES.includes(f.status as FixStatus) ? (f.status as FixStatus) : "open",
  };
}

/** Reads a fix file. Throws a plain message if it is not one. Bad findings are skipped, not fatal. */
export function parseFixFile(text: string): FixFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("That file isn't a fix list (it isn't valid JSON).");
  }
  const o = raw as Record<string, unknown> | null;
  if (!o || o.schema !== FIX_SCHEMA || !Array.isArray(o.images)) throw new Error("That isn't a David Render Studio fix list.");
  const images: FixEntry[] = [];
  for (const e of o.images as Record<string, unknown>[]) {
    const image = str(e?.image);
    if (!image) continue;
    const findings = (Array.isArray(e.findings) ? e.findings : []).map(findingOf).filter((f): f is Finding => f !== null);
    images.push({
      image,
      imageId: str(e.imageId) || undefined,
      room: str(e.room) || undefined,
      verdict: e.verdict === "pass" || e.verdict === "fail" ? e.verdict : "conditional",
      summary: str(e.summary) || undefined,
      findings,
    });
  }
  if (!images.length) throw new Error("That fix list has no pictures in it.");
  return {
    schema: FIX_SCHEMA,
    project: str(o.project) || undefined,
    inspectedAt: str(o.inspectedAt),
    inspector: str(o.inspector, "Inspector"),
    brief: Array.isArray(o.brief) ? o.brief.filter((s): s is string => typeof s === "string") : undefined,
    images,
  };
}

/** The entry for a picture, matched by embedded id first, then by file name (ignoring extension and case). */
export function entryFor(file: FixFile, name: string | undefined, id?: string): FixEntry | undefined {
  if (id) {
    const byId = file.images.find((e) => e.imageId === id);
    if (byId) return byId;
  }
  if (!name) return undefined;
  const base = (s: string) => s.replace(/\.[a-z0-9]+$/i, "").trim().toLowerCase();
  return file.images.find((e) => base(e.image) === base(name));
}

const SEVERITY_ORDER: Record<Severity, number> = { blocker: 0, major: 1, minor: 2, note: 3 };

/** Open items first, worst first, then biggest fix last (so the quick wins show early). */
export function sortFindings(list: Finding[]): Finding[] {
  const done = (s: FixStatus) => (s === "open" || s === "recheck" ? 0 : 1);
  return [...list].sort((a, b) => done(a.status) - done(b.status) || SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.fix.size - b.fix.size);
}

/** What the app can do for this finding on its own. */
export function canAutoRun(f: Finding): boolean {
  if (f.status === "closed" || f.status === "accepted") return false;
  if (f.fix.method === "relight") return true;
  return f.fix.method === "spot-edit" && !!f.box && !!f.fix.prompt.trim();
}

/** How many model runs a finding costs when the app runs it (0 for hand, accept, source). */
export function runsFor(f: Finding): number {
  return f.fix.method === "spot-edit" || f.fix.method === "relight" || f.fix.method === "re-render" ? 1 : 0;
}

/** The original prompt with the fix applied. Says what it could not find. */
export function patchPrompt(original: string, patch: Patch | undefined): { prompt: string; notes: string[] } {
  const notes: string[] = [];
  let prompt = original;
  const extra: string[] = [...(patch?.add ?? [])];
  for (const r of patch?.replace ?? []) {
    const i = prompt.toLowerCase().indexOf(r.from.toLowerCase());
    if (i < 0) {
      notes.push(`"${r.from}" is not in the original prompt, so "${r.to}" was added as a new line.`);
      extra.push(r.to);
    } else prompt = prompt.slice(0, i) + r.to + prompt.slice(i + r.from.length);
  }
  const lines = extra.map((l) => l.trim()).filter(Boolean);
  if (lines.length) prompt = `${prompt.trimEnd()}\n\nCorrections:\n${lines.map((l) => `- ${l.replace(/\.$/, "")}.`).join("\n")}`;
  return { prompt, notes };
}

/** A box as pixel numbers for a picture of this size, with a small margin so the edit blends in. */
export function boxToRect(box: [number, number, number, number], w: number, h: number, pad = 0.015): { x: number; y: number; w: number; h: number } {
  const x0 = Math.max(0, box[0] - pad);
  const y0 = Math.max(0, box[1] - pad);
  const x1 = Math.min(1, box[0] + box[2] + pad);
  const y1 = Math.min(1, box[1] + box[3] + pad);
  return { x: Math.round(x0 * w), y: Math.round(y0 * h), w: Math.max(1, Math.round((x1 - x0) * w)), h: Math.max(1, Math.round((y1 - y0) * h)) };
}

export interface Rollup {
  open: number;
  blockers: number;
  majors: number;
  closed: number;
  /** Model runs needed to clear everything that is still open and can be run. */
  runs: number;
}

export function rollup(list: Finding[]): Rollup {
  const r: Rollup = { open: 0, blockers: 0, majors: 0, closed: 0, runs: 0 };
  for (const f of list) {
    if (f.status === "closed" || f.status === "accepted" || f.status === "wontfix") {
      r.closed++;
      continue;
    }
    r.open++;
    if (f.severity === "blocker") r.blockers++;
    if (f.severity === "major") r.majors++;
    if (f.status === "open" || f.status === "recheck") r.runs += runsFor(f);
  }
  return r;
}

export function setStatus(file: FixFile, image: string, id: string, status: FixStatus): FixFile {
  return { ...file, images: file.images.map((e) => (e.image !== image ? e : { ...e, findings: e.findings.map((f) => (f.id === id ? { ...f, status } : f)) })) };
}
