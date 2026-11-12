// Everything that changes state or talks to a backend. Screens call these.

import { getState, setState } from "./store";
import type { AppState, Version, VersionMeta } from "./store";
import { toast } from "./toasts";
import { detectHost } from "./core/host";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, makeProvider, BROWSER_SITES } from "./core/settings";
import type { Settings } from "./core/settings";
import { buildRenderPrompt, buildZoneEditPrompt, dialTimeId, nearestAspectRatio, relightText, lightingText } from "./core/prompt";
import type { Capture, HistoryItem, ImageData64, Preset, ToolId } from "./core/types";
import { compositeMasked, fileToImage, imageSize, resizeTo, toDataUrl, zoneOverlay } from "./core/images";
import { cropToRatio, findFrame } from "./core/frame";
import { addHistory, listHistory, removeHistory } from "./core/history";
import { findLibraryItem } from "./core/library";
import { rememberDuration, typicalMs } from "./core/progress";
import { friendlyError } from "./core/errors";
import { KieProvider, fetchTransport, hostTransport } from "./core/providers/kie";
import { ProviderError } from "./core/providers/types";
import { ZONES } from "./core/zones";
import type { ZonePainter } from "./core/zones";
import { splitTypology } from "./lib/typology";
import { lintPrompt } from "./lib/lint";
import { renderCost } from "./lib/cost";
import { sunPromptLine, solar, toCamera as ringAngle } from "./lib/sun";
import { cameraPromptLine } from "./lib/camera";
import { dynamicLines, countSet } from "./core/dynamic";
import { BUILT_IN_NOTES, loadCustomNotes, noteLines } from "./lib/notes";
import { cameraViewPrompt, partOfDay, shotViewPrompt, sunWords } from "./lib/views";
import { lightingGuidance, styleCopyPrompt, withOverride } from "./lib/lighting";
import type { LightScene } from "./lib/lighting";
import { findKieModel } from "./core/providers/kie-models";
import { contextLabel, parseContexts } from "./core/context";
import { getPrefs } from "./prefs";

export const DEFAULT_LOOK = "ext-mansion-tropical";

/** A look from the library, or the first built-in exterior one. */
export function lookPreset(id: string): Preset {
  const it = findLibraryItem(id);
  if (it) return { id: it.id, name: it.name, projectType: it.projectType, lighting: it.lighting, environment: it.environment, style: it.style };
  return findLibraryItem(DEFAULT_LOOK)!;
}

export async function init(): Promise<AppState> {
  const host = detectHost();
  const settings = await loadSettings(host).catch(() => ({ ...DEFAULT_SETTINGS }));
  const history = await listHistory().catch(() => []);
  const frameId = settings.frameId && findFrame(settings.frameId) ? settings.frameId : "free";
  return {
    host,
    settings,
    ready: true,
    tab: "render",
    capture: null,
    captureName: "",
    preset: lookPreset(settings.lastSetup?.exterior?.preset?.id ?? DEFAULT_LOOK),
    frameId,
    portrait: false,
    hour: 16.5,
    lighting: "time",
    sun: { mode: "time", toCamera: 225, elevation: 14, north: 336, dayOfYear: dayNow(), exact: false },
    camera: { orbit: 35, tilt: 15, lensMm: 35, distanceM: 35 },
    notes: "",
    noteChips: [],
    glassColour: "red",
    advancedOpen: false,
    libOpen: null,
    dynOpen: null,
    editMode: "compare",
    viewSource: "shot",
    shots: [],
    lookIndex: 0,
    lightScene: null,
    styleRef: null,
    styleLight: "reference",
    keyCheck: "unknown",
    kieCredits: null,
    busy: null,
    before: null,
    versions: [],
    activeVersion: 0,
    history,
    review: null,
    handoff: null,
    dialog: null,
    customiseOpen: false,
    dragging: false,
    paintRev: 0,
  };
}

function dayNow(): number {
  const d = new Date();
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 1)) / 86400000) + 1;
}

// ---------- settings ----------

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  const s = { ...getState().settings, ...patch };
  setState({ settings: s });
  await saveSettings(getState().host, s);
  if ("kieKey" in patch || "geminiKey" in patch || "backend" in patch) void checkKey();
}

/** Real key check, so the header never shows a status it hasn't confirmed (H-01). */
export async function checkKey(): Promise<void> {
  const { settings: s, host } = getState();
  if (s.testMode || s.backend === "browser" || s.backend === "comfyui") return setState({ keyCheck: "unknown" });
  const key = s.backend === "kie" ? s.kieKey : s.geminiKey;
  if (!key.trim()) return setState({ keyCheck: "unknown" });
  setState({ keyCheck: "checking" });
  try {
    if (s.backend === "kie") {
      const p = new KieProvider(s.kieKey.trim(), s.kieModel, s.kieResolution, host.kind === "sketchup" ? hostTransport(host) : fetchTransport);
      const credits = await p.balance();
      setState({ keyCheck: "ok", kieCredits: credits });
    } else {
      await makeProvider(s, host).test();
      setState({ keyCheck: "ok" });
    }
  } catch (e) {
    const rejected = e instanceof ProviderError ? e.status === 401 || e.status === 403 || /reject|invalid|api key/i.test(e.message) : false;
    setState({ keyCheck: rejected ? "bad" : "offline" });
  }
}

// ---------- the view ----------

export async function useFile(file: File, name?: string): Promise<void> {
  if (!file.type.startsWith("image/")) return void toast("That isn't an image. Use PNG, JPG or WebP.", "error");
  if (getState().tab === "edit") return useEditFile(file, name);
  try {
    const view = await fileToImage(file, getState().settings.captureSize || 1600);
    const cap: Capture = { view, source: "upload" };
    setState({ capture: cap, captureName: name ?? file.name ?? "Pasted image", before: null });
    toast("Image added. Pick a look and render.", "ok");
  } catch {
    toast("Couldn't read that image. Try PNG or JPG.", "error", { label: "Retry", run: () => void useFile(file, name) });
  }
}

/** A picture dropped or pasted on the Edit tab: a new view screenshot, or a render to edit. */
export async function useEditFile(file: File, name?: string): Promise<void> {
  try {
    const st = getState();
    const img = await fileToImage(file, 4096);
    const label = name ?? file.name ?? "Pasted image";
    if (st.editMode === "style" && st.versions.length) {
      setState({ styleRef: { image: img, name: label } });
      toast("Style reference added", "ok");
      return;
    }
    if (st.editMode === "view" && st.versions.length) {
      setState((x) => ({ viewSource: "shot", shots: [...x.shots, { image: img, name: label }] }));
      toast(`View added${getState().shots.length > 1 ? ` · ${getState().shots.length} in the queue` : ""}`, "ok");
      return;
    }
    setState({ before: null, versions: [{ image: img, label: "Uploaded", prompt: "", kind: "version", meta: { at: Date.now() } }], activeVersion: 0, editMode: "compare" });
    toast("Image ready to edit", "ok");
  } catch {
    toast("Couldn't read that image. Try PNG or JPG.", "error");
  }
}

export async function pasteFromClipboard(): Promise<void> {
  try {
    const items = await navigator.clipboard.read();
    for (const it of items) {
      const type = it.types.find((t) => t.startsWith("image/"));
      if (type) {
        const blob = await it.getType(type);
        return useFile(new File([blob], "Pasted image", { type }), "Pasted image");
      }
    }
    toast("No image on the clipboard. Copy a screenshot first, then press Ctrl V.", "warn");
  } catch {
    toast("Press Ctrl V to paste your screenshot.", "info");
  }
}

export function clearView(): void {
  setState({ capture: null, captureName: "" });
  toast("Image cleared", "info");
}

export async function captureFromSketchUp(): Promise<void> {
  const { host, settings } = getState();
  if (host.kind !== "sketchup") return void toast("Capture works inside SketchUp. Here, paste or upload a screenshot instead.", "info");
  try {
    const ratio = frameRatio();
    const cap = await host.capture({ size: settings.captureSize, linePass: settings.linePass, mask: false, ratio: ratio ?? 0 });
    setState({ capture: cap, captureName: cap.facts?.sceneName ? `${cap.facts.modelName ?? "Model"} · ${cap.facts.sceneName}` : "SketchUp view" });
    toast("View captured", "ok");
  } catch (e) {
    toast((e as Error).message, "error");
  }
}

// ---------- frame ----------

export function frameRatio(): number | null {
  const { frameId } = getState();
  if (frameId === "free") return null;
  const f = findFrame(frameId);
  return f.ratio || null;
}

export function pickFrame(id: string): void {
  setState({ frameId: id });
  void updateSettings({ frameId: id });
}

// ---------- prompt ----------

/** The light the prompt gets: exact ring direction, the dial's time, or a light card. */
function lightingId(): string {
  const { lighting, hour } = getState();
  return lighting === "time" ? dialTimeId(hour) : lighting;
}

export interface BuiltPrompt {
  prompt: string;
  removed: string[];
}

export function buildPrompt(): BuiltPrompt {
  const st = getState();
  const s = st.settings;
  const cap = st.capture;
  const split = splitTypology(st.preset.style);
  const preset: Preset = { ...st.preset, style: split.style, lighting: lightingId() };
  const extras: string[] = [...dynamicLines(s.dynamic), lightingGuidance(effectiveLightScene())];
  let fromSun = countSet(s.dynamic.time) > 0;
  if (st.sun.exact) {
    const live = sunNow();
    extras.push(sunPromptLine(live));
    fromSun = true;
  }
  const prompt = buildRenderPrompt({
    preset,
    notes: "",
    facts: cap?.facts,
    hasLinePass: Boolean(cap?.lines),
    extras,
    lineStrength: s.lineStrength,
    look: s.look,
    materialLock: s.materialLock,
    boundaryLock: s.boundaryLock,
    lightingFromDynamic: fromSun,
    avoid: s.avoid,
  });
  return { prompt: withNotes(prompt), removed: split.removed };
}

/** Interior or exterior lighting: the user's switch, else what the Scene chips say. */
export function effectiveLightScene(): LightScene {
  const st = getState();
  return st.lightScene ?? (st.preset.projectType === "interior" ? "interior" : "exterior");
}

/** Additional Notes (chips + free text) on top of a prompt, as the highest priority. */
export function withNotes(prompt: string): string {
  return withOverride(prompt, currentNoteLines(), getState().notes);
}

/** Sentences from the Additional Notes chips. */
export function currentNoteLines(): string[] {
  const st = getState();
  return noteLines(st.noteChips, [...BUILT_IN_NOTES, ...loadCustomNotes()], st.glassColour);
}

/** Where the sun is, in words tied to the building (for new views). */
function sunForViews(): string {
  const st = getState();
  if (st.lighting !== "time") return `same light as Image 2 (${lightingText(st.lighting) ?? st.lighting})`;
  const live = sunNow();
  return sunWords({ bearing: live.bearing, elevation: live.elevation, when: partOfDay(st.hour) });
}

function metaNow(): VersionMeta {
  const st = getState();
  const s = st.settings;
  const env = parseContexts(st.preset.environment);
  return {
    scene: st.preset.projectType,
    look: st.preset.name,
    light: lightCaption().replace(/\.$/, ""),
    environment: env.length ? env.map(contextLabel).join(", ") : "As modelled",
    model: s.testMode ? "Test mode" : s.backend === "kie" ? findKieModel(s.kieModel).label : s.backend === "browser" ? "Prompt Copy" : s.backend === "gemini" ? "Gemini API" : "ComfyUI",
    at: Date.now(),
  };
}

/** The sun as the Sun screen currently has it. */
export function sunNow(): { toCamera: number; elevation: number; bearing?: number; when?: string } {
  const { sun, hour, capture } = getState();
  if (sun.mode === "free") return { toCamera: sun.toCamera, elevation: sun.elevation, bearing: (sun.toCamera - sun.north + 720) % 360 };
  const facts = capture?.facts;
  if (sun.mode === "sketchup" && facts?.sunToCameraDeg !== undefined && facts.sunElevationDeg !== undefined) {
    const t = (facts.sunToCameraDeg + 360) % 360;
    return { toCamera: t, elevation: facts.sunElevationDeg, when: "SketchUp shadow settings" };
  }
  const p = solar(sun.dayOfYear, hour);
  const date = new Date(Date.UTC(2026, 0, sun.dayOfYear)).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const hh = `${String(Math.floor(hour)).padStart(2, "0")}:${String(Math.round((hour % 1) * 60)).padStart(2, "0")}`;
  return { toCamera: ringAngle(p.bearing, sun.north), elevation: p.elevation, bearing: p.bearing, when: `${date}, ${hh}, Phnom Penh` };
}

export function lightCaption(): string {
  const st = getState();
  return `${lightingText(lightingId(), st.capture?.facts) ?? ""}`.replace(/^./, (c) => c.toUpperCase()) + ".";
}

// ---------- review then render ----------

async function viewForRender(cap: Capture): Promise<ImageData64> {
  const r = frameRatio();
  return r && cap.source === "upload" ? cropToRatio(cap.view, r) : cap.view;
}

/** Builds the prompt, checks it, and opens Review. Nothing is spent here. */
export async function openReview(kind: "render" | "view" | "shots" | "style" = "render"): Promise<void> {
  const st = getState();
  if (st.busy) return;
  if (kind === "style") {
    const base = activeImage();
    if (!base) return void toast("Open or upload the SketchUp view first.", "warn");
    if (!st.styleRef) return void toast("Add the style reference photo: paste, drop or upload it.", "warn");
    const prompt = withNotes(styleCopyPrompt({ scene: effectiveLightScene(), dialLight: st.styleLight === "dial" ? lightCaption().replace(/\.$/, "").toLowerCase() : null }));
    const lint = lintPrompt(prompt);
    const size = await imageSize(base);
    setState({ review: { prompt: lint.prompt, lint, images: [base, st.styleRef.image], aspectRatio: nearestAspectRatio(size.width, size.height), kind } });
    return;
  }
  const promptOnly = st.settings.backend === "browser" && !st.settings.testMode;
  if (kind === "render" && !st.capture && !promptOnly) return void toast("Add a view first: paste, drop or upload one.", "warn");
  let prompt: string;
  let images: ImageData64[];
  let batch: ImageData64[][] | undefined;
  if (kind === "view" || kind === "shots") {
    const look = st.versions[st.lookIndex]?.image ?? activeImage();
    if (!look) return void toast("Open or upload a render first.", "warn");
    if (kind === "view") {
      prompt = withNotes(cameraViewPrompt(cameraPromptLine(st.camera), sunForViews(), [], effectiveLightScene() === "interior"));
      images = [look];
    } else {
      if (!st.shots.length) return void toast("Paste, drop or upload a screenshot of the new view.", "warn");
      prompt = withNotes(shotViewPrompt({ type: effectiveLightScene(), sun: sunForViews(), notes: [] }));
      batch = st.shots.map((x) => [x.image, look]);
      images = batch[0];
    }
  } else {
    prompt = buildPrompt().prompt;
    if (st.capture) {
      const view = await viewForRender(st.capture);
      images = [view, ...(st.capture.lines ? [st.capture.lines] : [])];
    } else images = [];
  }
  const lint = lintPrompt(prompt);
  const size = images[0] ? await imageSize(images[0]) : { width: 4, height: 3 };
  const fr = frameRatio();
  const aspect = !images[0] && fr ? nearestAspectRatio(fr * 1000, 1000) : nearestAspectRatio(size.width, size.height);
  setState({ review: { prompt: lint.prompt, lint, images, aspectRatio: aspect, kind, batch } });
}

export function closeReview(): void {
  setState({ review: null });
}

/** Spends: runs the render the user just reviewed. */
export async function confirmReview(prompt: string): Promise<void> {
  const st = getState();
  const r = st.review;
  if (!r) return;
  setState({ review: null });
  const s = st.settings;
  if (s.backend === "browser" && st.host.kind === "browser" && !s.testMode) {
    setState({ handoff: { prompt, images: r.images, before: r.images[0] ?? null } });
    return;
  }
  const meta = metaNow();
  const tool: ToolId = "render";
  if (r.kind === "view" || r.kind === "shots") {
    const sets = r.batch ?? [r.images];
    const made: Version[] = [];
    for (let i = 0; i < sets.length; i++) {
      const set = sets[i];
      const size = await imageSize(set[0]);
      const out = await runProvider(prompt, set, r.kind === "shots" ? nearestAspectRatio(size.width, size.height) : r.aspectRatio, undefined, sets.length > 1 ? `View ${i + 1} of ${sets.length}` : undefined);
      for (const img of out) made.push({ image: img, label: r.kind === "shots" ? getState().shots[i]?.name || "New view" : "New camera", prompt, kind: "view", meta, before: set[0], historyId: await record(tool, prompt, set[0], img) });
    }
    if (!made.length) return;
    setState((x) => ({ versions: [...x.versions, ...made], activeVersion: x.versions.length, shots: r.kind === "shots" ? [] : x.shots, editMode: "compare" }));
    return;
  }
  if (r.kind === "style") {
    const out = await runProvider(prompt, r.images, r.aspectRatio, undefined, "Copying the style");
    if (!out.length) return;
    const made: Version[] = [];
    for (const img of out) made.push({ image: img, label: "Style copy", prompt, kind: "version", before: r.images[0], meta: { ...meta, look: `Reference: ${st.styleRef?.name ?? "photo"}`, light: st.styleLight === "dial" ? meta.light : "From the reference photo" }, historyId: await record(tool, prompt, r.images[0], img) });
    setState((x) => ({ versions: [...x.versions, ...made], activeVersion: x.versions.length, editMode: "compare" }));
    return;
  }
  const before = st.capture?.view ?? null;
  const out = await runProvider(prompt, r.images, r.aspectRatio);
  if (!out.length) return;
  const versions: Version[] = [];
  for (const img of out) versions.push({ image: img, label: "Render", prompt, kind: "version", meta, historyId: await record(tool, prompt, before ?? img, img) });
  setState({ before, versions, activeVersion: 0, lookIndex: 0, tab: "edit", editMode: "compare" });
  void updateSettings({ lastSetup: { ...s.lastSetup, [st.preset.projectType]: { preset: st.preset, kieModel: s.kieModel, frameId: st.frameId } } });
}

let abort: AbortController | null = null;

export function cancelRender(): void {
  abort?.abort();
}

async function runProvider(prompt: string, images: ImageData64[], aspectRatio: string, modelId?: string, label?: string): Promise<ImageData64[]> {
  const st = getState();
  const settings = modelId ? { ...st.settings, kieModel: modelId } : st.settings;
  const provider = makeProvider(settings, st.host);
  const key = `${settings.backend}:${settings.kieModel}:${settings.kieResolution}`;
  const n = settings.backend === "browser" ? 1 : Math.max(1, Math.min(4, settings.imageCount));
  abort = typeof AbortController === "undefined" ? null : new AbortController();
  setState({ busy: { label: label ?? (n > 1 ? `Rendering ${n} images` : "Rendering"), since: Date.now(), typical: typicalMs(key) } });
  try {
    const runs = await Promise.allSettled(Array.from({ length: n }, () => provider.render({ prompt, images, aspectRatio }, abort?.signal)));
    const ok = runs.flatMap((x) => (x.status === "fulfilled" ? [x.value.image] : []));
    const failed = runs.find((x): x is PromiseRejectedResult => x.status === "rejected");
    if (failed && !ok.length) throw failed.reason;
    rememberDuration(key, Date.now() - getState().busy!.since);
    if (failed) toast(`${ok.length} of ${n} done. One failed: ${(failed.reason as Error).message}`, "warn");
    else toast("Render ready", "ok");
    return ok;
  } catch (e) {
    const err = e as Error;
    if (err.name === "AbortError") toast("Render cancelled.", "info");
    else {
      const nice = friendlyError(err.message);
      if (e instanceof ProviderError && (e.status === 401 || e.status === 403)) setState({ keyCheck: "bad" });
      toast(nice?.text ?? err.message, "error", nice?.action === "settings" ? { label: "Settings", run: () => setState({ dialog: "settings" }) } : { label: "Retry", run: () => void openReview() });
    }
    return [];
  } finally {
    abort = null;
    setState({ busy: null });
  }
}

async function record(tool: ToolId, prompt: string, before: ImageData64, after: ImageData64): Promise<string | undefined> {
  const st = getState();
  const s = st.settings;
  const cost = renderCost(s);
  const item: HistoryItem = {
    id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
    tool,
    presetName: st.preset.name,
    presetId: st.preset.id,
    prompt,
    before,
    after,
    provider: s.testMode ? "Test mode" : s.backend === "kie" ? "Kie.ai" : s.backend === "gemini" ? "Gemini API" : s.backend === "comfyui" ? "ComfyUI" : "Browser",
    model: s.backend === "kie" ? s.kieModel : s.backend === "gemini" ? s.geminiModel : s.backend,
    credits: cost.credits ?? undefined,
    project: s.project || undefined,
  };
  try {
    await addHistory(item);
    setState({ history: await listHistory() });
    return item.id;
  } catch {
    toast("Couldn't save this render to History. Download it to keep it.", "warn");
    return undefined;
  }
}

export function activeImage(): ImageData64 | null {
  const { versions, activeVersion } = getState();
  return versions[activeVersion]?.image ?? null;
}

// ---------- handoff (free Gemini copy-paste) ----------

export async function copyImage(img: ImageData64): Promise<void> {
  const blob = await (await fetch(toDataUrl(img))).blob();
  const png = blob.type === "image/png" ? blob : await toPng(blob);
  await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
}

async function toPng(blob: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(blob);
  const c = document.createElement("canvas");
  c.width = bmp.width;
  c.height = bmp.height;
  c.getContext("2d")!.drawImage(bmp, 0, 0);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Couldn't copy the image."))), "image/png"));
}

export function handoffSite(): (typeof BROWSER_SITES)[number] {
  const s = getState().settings;
  return BROWSER_SITES.find((x) => x.id === s.browserSite) ?? BROWSER_SITES[0];
}

/** A result pasted or dropped back from Gemini / ChatGPT lands in History with its prompt. */
export async function importResult(file: File): Promise<void> {
  const st = getState();
  const h = st.handoff;
  const after = await fileToImage(file, 4096);
  const before = h?.before ?? st.capture?.view ?? after;
  const fresh = !h?.before;
  const prompt = h?.prompt ?? "(pasted result)";
  const id = await record("render", prompt, before, after);
  setState((x) => ({ handoff: null, before: fresh ? null : before, versions: [...x.versions, { image: after, label: "Pasted result", prompt, kind: "version", meta: metaNow(), historyId: id }], activeVersion: x.versions.length, tab: "edit", editMode: "compare" }));
  toast("Result saved to History", "ok");
}

// ---------- edits on the result ----------

export async function runSpotEdit(painter: ZonePainter, instructions: Record<string, string>, general: string): Promise<void> {
  const src = activeImage();
  if (!src) return;
  const painted = painter.paintedZones();
  if (!painted.length && !general.trim()) return void toast("Select an area, or write a change for the whole picture.", "warn");
  const missing = painted.filter((id) => !(instructions[id] ?? "").trim());
  if (missing.length) return void toast(`Describe what should change in ${missing.map((id) => `Zone ${id}`).join(", ")}.`, "warn");
  const zones = ZONES.filter((z) => painted.includes(z.id));
  const s = getState().settings;
  const prompt = buildZoneEditPrompt(
    zones.map((z) => ({ colour: z.colour, instruction: instructions[z.id] })),
    { singleImage: s.singleImage, general },
  );
  const overlay = zones.length ? await zoneOverlay(src, zones.map((z) => ({ mask: painter.canvases[z.id], colour: z.css }))) : src;
  const images = !zones.length ? [src] : s.singleImage ? [overlay] : [src, overlay];
  const size = await imageSize(src);
  const out = await runProvider(prompt, images, nearestAspectRatio(size.width, size.height), s.backend === "kie" ? s.editModel || undefined : undefined);
  if (!out.length) return;
  const fitted = await resizeTo(out[0], size.width, size.height);
  // A plain zone edit is pasted back over the original, so nothing outside the selection changes.
  const merged = general.trim() || !zones.length ? fitted : await compositeMasked(src, fitted, painter.union());
  const id = await record("spot-edit", prompt, src, merged);
  painter.clearAll();
  setState((x) => ({ versions: [...x.versions, { image: merged, label: "Spot edit", prompt, kind: "version", meta: x.versions[x.activeVersion]?.meta, historyId: id }], activeVersion: x.versions.length }));
}

/** lightId: a light card id, or a dial time from dialTimeId(). */
export async function runRelight(lightId: string): Promise<void> {
  const src = activeImage();
  if (!src) return;
  const light = relightText(lightId, getState().capture?.facts) ?? lightingText(lightId) ?? lightId;
  const prompt = `Change only the lighting and sky of this image to: ${light}. Shadows and reflections must match the new light. Keep every building, material, object and the camera exactly as they are. The result must look like a real photograph.`;
  const size = await imageSize(src);
  const s = getState().settings;
  const out = await runProvider(prompt, [src], nearestAspectRatio(size.width, size.height), s.backend === "kie" ? s.editModel || undefined : undefined);
  if (!out.length) return;
  const id = await record("lighting", prompt, src, out[0]);
  setState((x) => ({ versions: [...x.versions, { image: out[0], label: "Relight", prompt, kind: "version", meta: { ...(x.versions[x.activeVersion]?.meta ?? { at: Date.now() }), light: light.replace(/^./, (ch) => ch.toUpperCase()), at: Date.now() }, historyId: id }], activeVersion: x.versions.length }));
}

export function openHistoryItem(item: HistoryItem): void {
  setState({ before: item.before, versions: [{ image: item.after, label: item.presetName ?? "Render", prompt: item.prompt, historyId: item.id, kind: "version", meta: { look: item.presetName, model: item.model, at: item.createdAt } }], activeVersion: 0, lookIndex: 0, tab: "edit", editMode: "compare" });
}

export async function deleteHistoryItem(id: string): Promise<void> {
  await removeHistory(id);
  setState({ history: await listHistory() });
  toast("Removed from History", "info");
}

export async function download(img: ImageData64, name: string): Promise<void> {
  await getState().host.save(img, name);
}

/** Copies presets, favourites and projects from v1 (never keys unless asked). */
export async function importFromV1(withKeys: boolean): Promise<void> {
  try {
    const raw = localStorage.getItem("airs.settings");
    if (!raw) return void toast("No v1 settings found in this browser.", "info");
    const v1 = JSON.parse(raw) as Partial<Settings>;
    const patch: Partial<Settings> = {
      userPresets: v1.userPresets ?? [],
      favorites: v1.favorites ?? [],
      projects: v1.projects ?? [],
      project: v1.project ?? "",
      backend: v1.backend ?? getState().settings.backend,
      browserSite: v1.browserSite ?? "gemini",
      kieModel: v1.kieModel ?? getState().settings.kieModel,
    };
    if (withKeys) Object.assign(patch, { kieKey: v1.kieKey ?? "", geminiKey: v1.geminiKey ?? "", comfyUrl: v1.comfyUrl ?? "", comfyWorkflow: v1.comfyWorkflow ?? "" });
    await updateSettings(patch);
    toast(`Imported from v1${withKeys ? ", keys included" : ""}.`, "ok");
  } catch {
    toast("Couldn't read the v1 settings.", "error");
  }
}

export function themeNow(): "dark" | "light" {
  return getPrefs().theme === "light" || (getPrefs().theme === "auto" && matchMedia("(prefers-color-scheme: light)").matches) ? "light" : "dark";
}
