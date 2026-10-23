// The render suite interface. Same code in the SketchUp panel and the browser.

import { clear, h } from "./dom";
import { cropImage, cropToRatio, FRAMES, findFrame } from "./frame";
import { detectHost, type Host } from "./host";
import { addHistory, listHistory, removeHistory } from "./history";
import { icon, logo } from "./icons";
import { compositeMasked, fileToImage, imageSize, redOverlay, resizeTo, toDataUrl } from "./images";
import {
  BEAMS,
  KELVINS,
  LED_PROFILES,
  kelvinLabel,
  kelvinToRgb,
  paintBeam,
  paintLed,
  rgbCss,
  settingsId,
} from "./lightgen";
import { BUILT_IN_PRESETS, newPresetId, parsePresetFile } from "./presets";
import {
  ENVIRONMENTS,
  LIGHTING,
  PROJECT_TYPES,
  SKETCHUP_SUN,
  buildLightingPrompt,
  buildRenderPrompt,
  buildSpotEditPrompt,
  nearestAspectRatio,
  type Option,
} from "./prompt";
import { GeminiProvider } from "./providers/gemini";
import { loadSettings, makeProvider, saveSettings, type Settings } from "./settings";
import type { Capture, HistoryItem, ImageData64, LightSummary, Preset, ProjectType, ToolId } from "./types";

type Tab = "render" | "edit" | "lights" | "mirror" | "history";

interface SpotSettings {
  beam: string;
  kelvin: number;
  intensity: number;
  lengthMm: number;
  widthMm: number;
  orientation: "down" | "up" | "left" | "right";
}

interface LedSettings {
  profile: string;
  kelvin: number;
  intensity: number;
  widthMm: number;
}

interface State {
  tab: Tab;
  settingsOpen: boolean;
  settings: Settings;
  /** Source before cropping (uploads keep it so the frame can change). */
  original: ImageData64 | null;
  capture: Capture | null;
  frameId: string;
  /** Frame the current capture was taken with. */
  capturedFrameId: string;
  showFrame: boolean;
  preset: Preset;
  notes: string;
  result: ImageData64 | null;
  editSource: ImageData64 | null;
  editMode: "spot" | "relight";
  editInstruction: string;
  relight: string;
  lightMode: "spot" | "led";
  spot: SpotSettings;
  led: LedSettings;
  mirrorFov: number;
  lights: LightSummary | null;
  history: HistoryItem[];
  busy: boolean;
  busySince: number;
  abort: AbortController | null;
}

let host: Host;
let state: State;
let root: HTMLElement;
let maskCanvas: HTMLCanvasElement | null = null;
let busyTimer: number | undefined;

export async function start(el: HTMLElement): Promise<void> {
  root = el;
  host = detectHost();
  const settings = await loadSettings(host);
  state = {
    tab: "render",
    settingsOpen: !(settings.geminiKey || settings.backend === "comfyui"),
    settings,
    original: null,
    capture: null,
    frameId: settings.frameId ?? "16:9",
    capturedFrameId: "",
    showFrame: true,
    preset: { ...BUILT_IN_PRESETS[0] },
    notes: "",
    result: null,
    editSource: null,
    editMode: "spot",
    editInstruction: "",
    relight: "blue-hour",
    lightMode: "spot",
    spot: { beam: "medium", kelvin: 3000, intensity: 70, lengthMm: 900, widthMm: 600, orientation: "down" },
    led: { profile: "soft", kelvin: 3000, intensity: 75, widthMm: 170 },
    mirrorFov: 60,
    lights: null,
    history: await listHistory(),
    busy: false,
    busySince: 0,
    abort: null,
  };
  document.body.dataset.host = host.kind;
  host.onEvent((name, payload) => {
    if (name === "lightsChanged") {
      state.lights = payload as LightSummary;
      if (state.tab === "lights" || state.tab === "mirror") render();
    }
  });
  if (host.kind === "sketchup") {
    syncFrame();
    refreshLights();
  }
  render();
}

// ---------- helpers ----------

function allPresets(): Preset[] {
  return [...BUILT_IN_PRESETS.map((p) => ({ ...p, builtIn: true })), ...state.settings.userPresets];
}

function toast(text: string, kind: "info" | "error" | "ok" = "info"): void {
  const bar = document.getElementById("status");
  if (!bar) return;
  bar.textContent = text;
  bar.className = `toast show ${kind}`;
  window.clearTimeout((bar as HTMLElement & { _t?: number })._t);
  (bar as HTMLElement & { _t?: number })._t = window.setTimeout(() => (bar.className = `toast ${kind}`), kind === "error" ? 9000 : 4500);
}

async function persist(): Promise<void> {
  await saveSettings(host, state.settings);
}

async function syncFrame(): Promise<void> {
  if (host.kind !== "sketchup") return;
  try {
    await host.call("setFrame", { ratio: findFrame(state.frameId).ratio, visible: state.showFrame });
  } catch {
    /* older SketchUp without overlays: the crop still applies */
  }
}

async function refreshLights(): Promise<void> {
  try {
    state.lights = await host.call<LightSummary>("lightsSummary");
  } catch {
    state.lights = null;
  }
}

function section(title: string, ...children: (Node | null | false)[]): HTMLElement {
  return h("section", { class: "section" }, h("div", { class: "section-head" }, h("h3", {}, title)), ...children);
}

function sectionWith(title: string, aside: Node | null, ...children: (Node | null | false)[]): HTMLElement {
  return h("section", { class: "section" }, h("div", { class: "section-head" }, h("h3", {}, title), aside), ...children);
}

function chip(label: string, active: boolean, onclick: () => void, extra?: Node, title?: string): HTMLElement {
  return h("button", { class: active ? "chip active" : "chip", onclick, title, type: "button" }, extra ?? null, label);
}

function segmented<T extends string>(
  items: { id: T; label: string; icon?: string }[],
  value: T,
  onPick: (v: T) => void,
): HTMLElement {
  return h(
    "div",
    { class: "seg" },
    items.map((it) =>
      h(
        "button",
        { class: it.id === value ? "active" : "", type: "button", onclick: () => onPick(it.id) },
        it.icon ? icon(it.icon, 16) : null,
        h("span", {}, it.label),
      ),
    ),
  );
}

function slider(label: string, min: number, max: number, step: number, value: number, unit: string, onInput: (v: number) => void): HTMLElement {
  const out = h("output", {}, `${value}${unit}`);
  const input = h("input", { type: "range", min, max, step, value, "aria-label": label }) as HTMLInputElement;
  const fill = () => input.style.setProperty("--fill", `${((Number(input.value) - min) / (max - min)) * 100}%`);
  input.addEventListener("input", () => {
    out.textContent = `${input.value}${unit}`;
    fill();
    onInput(Number(input.value));
  });
  fill();
  return h("div", { class: "slider" }, h("div", { class: "slider-head" }, h("label", {}, label), out), input);
}

function textarea(value: string, placeholder: string, rows: number, onInput: (v: string) => void): HTMLTextAreaElement {
  const t = h("textarea", { rows, placeholder }, value) as HTMLTextAreaElement;
  t.addEventListener("input", () => onInput(t.value));
  return t;
}

function primaryButton(label: string, iconName: string, onclick: () => void, disabled = false, cls = ""): HTMLElement {
  return h("button", { class: `btn primary ${cls}`, onclick, disabled, type: "button" }, icon(iconName, 18), h("span", {}, label));
}

function button(label: string, iconName: string | null, onclick: () => void, cls = "", disabled = false): HTMLElement {
  return h("button", { class: `btn ${cls}`, onclick, disabled, type: "button" }, iconName ? icon(iconName, 16) : null, h("span", {}, label));
}

function iconButton(iconName: string, title: string, onclick: () => void, cls = ""): HTMLElement {
  return h("button", { class: `icon-btn ${cls}`, onclick, title, "aria-label": title, type: "button" }, icon(iconName, 18));
}

// Material colour hints for preset cards, read from the style text.
const MATERIAL_SWATCHES: [RegExp, string][] = [
  [/white render|off-white|white/i, "#ece8df"],
  [/concrete|cement/i, "#a19e98"],
  [/oak|timber|hardwood|walnut|wood/i, "#a9784b"],
  [/glass|glazing/i, "#9cc2d2"],
  [/terracotta|clay tile/i, "#c0673f"],
  [/laterite/i, "#a5513a"],
  [/travertine|stone/i, "#cfc1a6"],
  [/brass/i, "#c8a24a"],
  [/black steel|dark grey|steel/i, "#3b3d40"],
  [/garden|palm|plant|tree|frangipani/i, "#5f7f4b"],
  [/rattan|linen/i, "#d6bd8f"],
  [/terrazzo/i, "#d9d2c6"],
  [/asphalt|road/i, "#55575a"],
  [/aluminium|aluminum/i, "#8e9297"],
];

function presetSwatches(p: Preset): string[] {
  const found = MATERIAL_SWATCHES.filter(([re]) => re.test(p.style)).map(([, c]) => c);
  return (found.length ? found : ["#8e8a82", "#c9c2b6"]).slice(0, 4);
}

// ---------- layout ----------

function backendPill(): HTMLElement {
  const s = state.settings;
  const ready = s.backend === "comfyui" ? Boolean(s.comfyWorkflow.trim()) : Boolean(s.geminiKey);
  const label = s.backend === "comfyui" ? "ComfyUI" : s.geminiModel.replace(/^gemini-/, "Gemini ").replace(/-/g, " ");
  return h(
    "button",
    { class: ready ? "pill ok" : "pill warn", onclick: () => openSettings(), title: "Backend settings", type: "button" },
    h("span", { class: "dot" }),
    ready ? label : "Set up backend",
  );
}

function openSettings(): void {
  state.settingsOpen = true;
  render();
}

function render(): void {
  clear(root);
  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "render", label: "Render", icon: "render" },
    { id: "edit", label: "Edit", icon: "edit" },
    { id: "lights", label: "Lights", icon: "lights" },
    { id: "mirror", label: "Mirror", icon: "mirror" },
    { id: "history", label: "History", icon: "history" },
  ];
  root.append(
    h(
      "header",
      { class: "topbar" },
      logo(26),
      h("div", { class: "brand" }, h("strong", {}, "AI Render Suite"), h("small", {}, host.kind === "sketchup" ? "for SketchUp" : "web")),
      backendPill(),
      iconButton("gear", "Settings", openSettings),
    ),
    h(
      "nav",
      { class: "tabs" },
      tabs.map((t) =>
        h(
          "button",
          {
            class: t.id === state.tab ? "tab active" : "tab",
            type: "button",
            onclick: () => {
              state.tab = t.id;
              if ((t.id === "lights" || t.id === "mirror") && host.kind === "sketchup") refreshLights().then(render);
              render();
            },
          },
          icon(t.icon, 18),
          h("span", {}, t.id === "history" && state.history.length ? `${t.label} ${state.history.length}` : t.label),
        ),
      ),
    ),
  );
  const body = h("main", { class: "body" });
  if (state.tab === "render") renderTab(body);
  if (state.tab === "edit") editTab(body);
  if (state.tab === "lights") lightsTab(body);
  if (state.tab === "mirror") mirrorTab(body);
  if (state.tab === "history") historyTab(body);
  root.append(body);
  if (state.tab === "render") root.append(renderBar());
  root.append(h("div", { id: "status", class: "toast", role: "status", "aria-live": "polite" }));
  if (state.settingsOpen) root.append(settingsSheet());
}

// ---------- Render tab ----------

function frameLabel(): string {
  const cap = state.capture;
  if (!cap) return findFrame(state.frameId).label;
  return `${findFrame(state.capturedFrameId || state.frameId).label} · ${cap.view.width ?? "?"} × ${cap.view.height ?? "?"} px`;
}

async function doCapture(): Promise<void> {
  try {
    toast("Capturing the SketchUp view...");
    const frame = findFrame(state.frameId);
    const raw = await host.capture({
      size: state.settings.captureSize,
      linePass: state.settings.linePass,
      mask: false,
      ratio: frame.ratio,
    });
    const rect = raw.frame;
    const view = rect ? await cropImage(raw.view, rect) : raw.view;
    const lines = raw.lines && rect ? await cropImage(raw.lines, rect) : raw.lines;
    state.capture = { ...raw, view, lines };
    state.original = null;
    state.capturedFrameId = state.frameId;
    state.result = null;
    render();
    const f = raw.facts;
    const bits = [`Captured ${view.width} × ${view.height} px`];
    if (f?.sceneName) bits.push(`scene "${f.sceneName}"`);
    if (f?.focalLengthMm) bits.push(`${f.focalLengthMm} mm lens`);
    if (lines) bits.push("line pass");
    const l = f?.lights;
    if (l && (l.spots || l.leds || l.mirrors)) bits.push(`${l.spots + l.leds} lights, ${l.mirrors} mirrors`);
    toast(bits.join(" · "), "ok");
  } catch (e) {
    toast((e as Error).message, "error");
  }
}

async function useUpload(file: File, target: "render" | "edit"): Promise<void> {
  const img = await fileToImage(file);
  if (target === "edit") {
    state.editSource = img;
    maskCanvas = null;
    render();
    return;
  }
  state.original = img;
  const view = await cropToRatio(img, findFrame(state.frameId).ratio);
  state.capture = { view, source: "upload" };
  state.capturedFrameId = state.frameId;
  state.result = null;
  render();
}

function uploadInput(target: "render" | "edit"): HTMLInputElement {
  const input = h("input", { type: "file", accept: "image/*", class: "hidden", "data-target": target }) as HTMLInputElement;
  input.addEventListener("change", () => {
    const f = input.files?.[0];
    if (f) useUpload(f, target);
  });
  return input;
}

function stage(): HTMLElement {
  const cap = state.capture;
  const input = uploadInput("render");
  const actions = h(
    "div",
    { class: "stage-actions" },
    host.kind === "sketchup" ? primaryButton(cap ? "Recapture" : "Capture view", "capture", doCapture, state.busy) : null,
    button("Upload", "upload", () => input.click(), host.kind === "sketchup" ? "ghost" : "primary", state.busy),
    input,
  );
  let content: HTMLElement;
  if (cap && state.result) {
    content = compareSlider(cap.view, state.result);
  } else if (cap) {
    content = h("img", { class: "stage-img", src: toDataUrl(cap.view), alt: "Source view" });
  } else {
    const r = findFrame(state.frameId).ratio || 16 / 9;
    content = h(
      "div",
      { class: "stage-empty", style: `aspect-ratio:${r}` },
      icon(host.kind === "sketchup" ? "capture" : "upload", 34),
      h(
        "p",
        {},
        host.kind === "sketchup"
          ? "Frame your camera in SketchUp, then capture the view."
          : "Upload a SketchUp export, CAD view, site photo or iPad sketch.",
      ),
    );
  }
  const stale = cap && cap.source === "sketchup" && state.capturedFrameId && state.capturedFrameId !== state.frameId;
  return h(
    "div",
    { class: "stage" },
    h(
      "div",
      { class: "stage-frame" },
      content,
      cap ? h("span", { class: "badge" }, frameLabel()) : null,
      state.result ? h("span", { class: "badge right" }, "Drag to compare") : null,
      state.busy ? h("div", { class: "scan" }) : null,
    ),
    stale ? h("div", { class: "notice" }, icon("info", 16), "The frame changed. Recapture to use it.", button("Recapture", "capture", doCapture, "small")) : null,
    state.result ? resultActions(state.result, "render") : actions,
  );
}

function frameSection(): HTMLElement {
  const picker = h(
    "div",
    { class: "frames" },
    FRAMES.map((f) => {
      const r = f.ratio || 1.5;
      const w = r >= 1 ? 22 : Math.round(22 * r);
      const hh = r >= 1 ? Math.round(22 / r) : 22;
      const shape = h("span", { class: f.ratio ? "ratio-shape" : "ratio-shape free", style: `width:${w}px;height:${hh}px` });
      return h(
        "button",
        {
          class: f.id === state.frameId ? "frame active" : "frame",
          title: f.hint,
          type: "button",
          onclick: async () => {
            state.frameId = f.id;
            state.settings.frameId = f.id;
            persist();
            syncFrame();
            if (state.original && state.capture?.source === "upload") {
              state.capture = { ...state.capture, view: await cropToRatio(state.original, f.ratio) };
              state.capturedFrameId = f.id;
              state.result = null;
            }
            render();
          },
        },
        h("span", { class: "frame-box" }, shape),
        h("span", {}, f.label),
      );
    }),
  );
  const toggle =
    host.kind === "sketchup"
      ? h(
          "label",
          { class: "switch" },
          h("input", {
            type: "checkbox",
            checked: state.showFrame,
            onchange: (e: Event) => {
              state.showFrame = (e.target as HTMLInputElement).checked;
              syncFrame();
            },
          }),
          h("span", { class: "track" }),
          "Show in SketchUp",
        )
      : null;
  return sectionWith("Frame", toggle, picker);
}

function lightingCard(o: Option, active: boolean, onPick: () => void): HTMLElement {
  const [a, b] = o.swatch ?? ["#555", "#999"];
  return h(
    "button",
    { class: active ? "light-card active" : "light-card", type: "button", onclick: onPick },
    h("span", { class: "sky", style: `background:linear-gradient(180deg, ${a}, ${b})` }, h("span", { class: "sun" })),
    h("span", { class: "light-text" }, h("strong", {}, o.label), h("small", {}, o.sub ?? "")),
  );
}

function lightingOptions(): Option[] {
  return host.kind === "sketchup" ? [SKETCHUP_SUN, ...LIGHTING] : LIGHTING;
}

function renderTab(body: HTMLElement): void {
  const p = state.preset;
  body.append(stage());
  body.append(frameSection());

  const typeIcons: Record<ProjectType, string> = { exterior: "exterior", interior: "interior", aerial: "aerial", sketch: "sketch" };
  body.append(
    section(
      "Scene",
      segmented(
        (Object.keys(PROJECT_TYPES) as ProjectType[]).map((id) => ({ id, label: id === "sketch" ? "Sketch" : PROJECT_TYPES[id].label.replace(" / masterplan", ""), icon: typeIcons[id] })),
        p.projectType,
        (v) => {
          state.preset.projectType = v;
          render();
        },
      ),
    ),
  );

  body.append(
    section(
      "Light",
      h(
        "div",
        { class: "light-grid" },
        lightingOptions().map((o) =>
          lightingCard(o, o.id === p.lighting, () => {
            state.preset.lighting = o.id;
            render();
          }),
        ),
      ),
    ),
  );

  body.append(
    section(
      "Surroundings",
      h(
        "div",
        { class: "chips" },
        ENVIRONMENTS.map((o) =>
          chip(o.label, o.id === p.environment, () => {
            state.preset.environment = o.id;
            render();
          }),
        ),
      ),
    ),
  );

  const presetCards = h(
    "div",
    { class: "preset-grid" },
    allPresets().map((x) =>
      h(
        "button",
        {
          class: x.id === p.id ? "preset active" : "preset",
          type: "button",
          onclick: () => {
            state.preset = { ...x };
            render();
          },
        },
        h("span", { class: "swatches" }, presetSwatches(x).map((c) => h("i", { style: `background:${c}` }))),
        h("strong", {}, x.name),
        h("small", {}, `${PROJECT_TYPES[x.projectType].label.replace(" / masterplan", "")}${x.builtIn ? "" : " · mine"}`),
      ),
    ),
  );
  body.append(
    sectionWith(
      "Style preset",
      h(
        "div",
        { class: "head-actions" },
        iconButton("plus", "Save current settings as a preset", savePresetAs, "small"),
        p.builtIn ? null : iconButton("trash", "Delete this preset", deletePreset, "small"),
        iconButton("save", "Export my presets", exportPresets, "small"),
        importButton(),
      ),
      presetCards,
      h(
        "label",
        { class: "field" },
        h("span", {}, "Materials and style"),
        textarea(p.style, "e.g. board-formed concrete, terracotta tiles, timber louvers", 3, (v) => {
          state.preset.style = v;
          updatePromptPreview();
        }),
      ),
      h(
        "label",
        { class: "field" },
        h("span", {}, "Notes for this view"),
        textarea(state.notes, "e.g. add a parked Honda Dream by the gate", 2, (v) => {
          state.notes = v;
          updatePromptPreview();
        }),
      ),
    ),
  );

  const lp = h("input", {
    type: "checkbox",
    checked: state.settings.linePass,
    onchange: async (e: Event) => {
      state.settings.linePass = (e.target as HTMLInputElement).checked;
      await persist();
    },
  });
  body.append(
    h(
      "details",
      { class: "section advanced" },
      h("summary", {}, "Advanced"),
      host.kind === "sketchup"
        ? h(
            "div",
            { class: "adv-grid" },
            h("label", { class: "switch" }, lp, h("span", { class: "track" }), "Send hidden-line pass to hold geometry"),
            h(
              "div",
              { class: "field" },
              h("span", {}, "Capture size (long side)"),
              segmented(
                ["1280", "1600", "2048"].map((n) => ({ id: n, label: `${n} px` })),
                String(state.settings.captureSize),
                async (v) => {
                  state.settings.captureSize = Number(v);
                  await persist();
                  render();
                },
              ),
            ),
          )
        : null,
      h("div", { class: "field" }, h("span", {}, "Prompt sent to the AI"), h("pre", { id: "prompt-preview" }, currentRenderPrompt())),
    ),
  );
}

function renderBar(): HTMLElement {
  const disabled = state.busy || !state.capture;
  const btn = h(
    "button",
    { class: state.busy ? "render-btn busy" : "render-btn", disabled, onclick: runRender, type: "button" },
    icon("render", 20),
    h("span", { id: "render-label" }, state.busy ? "Rendering..." : state.result ? "Render again" : "Render"),
  );
  return h(
    "div",
    { class: "render-bar" },
    btn,
    state.busy && state.abort ? iconButton("close", "Cancel", () => state.abort?.abort(), "ghost") : null,
  );
}

function currentRenderPrompt(): string {
  return buildRenderPrompt({
    preset: state.preset,
    notes: state.notes,
    facts: state.capture?.facts,
    hasLinePass: Boolean(state.capture?.lines),
  });
}

function updatePromptPreview(): void {
  const pre = document.getElementById("prompt-preview");
  if (pre) pre.textContent = currentRenderPrompt();
}

function resultActions(after: ImageData64, tool: ToolId): HTMLElement {
  return h(
    "div",
    { class: "stage-actions" },
    primaryButton(host.kind === "sketchup" ? "Save to model folder" : "Download", "save", () => saveImage(after, tool)),
    button("Edit", "edit", () => {
      state.editSource = after;
      maskCanvas = null;
      state.tab = "edit";
      render();
    }, "ghost"),
    host.kind === "sketchup" ? iconButton("folder", "Open the AI Renders folder", () => host.openRenderFolder().catch((e) => toast(e.message, "error")), "ghost") : null,
    tool === "render"
      ? iconButton("close", "Back to the source view", () => {
          state.result = null;
          render();
        }, "ghost")
      : null,
  );
}

function compareSlider(before: ImageData64, after: ImageData64): HTMLElement {
  const beforeImg = h("img", { src: toDataUrl(before), alt: "Before" }) as HTMLImageElement;
  const clip = h("div", { class: "compare-before" }, beforeImg);
  const handle = h("div", { class: "compare-handle" }, h("span", {}, "‹ ›"));
  const wrap = h("div", { class: "compare" }, h("img", { src: toDataUrl(after), alt: "After" }), clip, handle);
  const set = (pct: number) => {
    const v = Math.max(0, Math.min(100, pct));
    clip.style.width = `${v}%`;
    handle.style.left = `${v}%`;
  };
  const sync = () => (beforeImg.style.width = `${wrap.clientWidth}px`);
  let drag = false;
  const move = (e: PointerEvent) => {
    const r = wrap.getBoundingClientRect();
    set(((e.clientX - r.left) / r.width) * 100);
  };
  wrap.addEventListener("pointerdown", (e) => {
    drag = true;
    wrap.setPointerCapture(e.pointerId);
    move(e);
  });
  wrap.addEventListener("pointermove", (e) => drag && move(e));
  wrap.addEventListener("pointerup", () => (drag = false));
  requestAnimationFrame(sync);
  window.addEventListener("resize", sync);
  set(50);
  return wrap;
}

async function saveImage(img: ImageData64, tool: ToolId): Promise<void> {
  try {
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    const name = `${tool}_${state.capture?.facts?.sceneName || state.preset.name}_${stamp}`.replace(/[^\w.-]+/g, "_");
    const where = await host.save(img, name);
    toast(`Saved ${where}`, "ok");
  } catch (e) {
    toast((e as Error).message, "error");
  }
}

function setBusy(on: boolean): void {
  state.busy = on;
  window.clearInterval(busyTimer);
  if (on) {
    state.busySince = Date.now();
    busyTimer = window.setInterval(() => {
      const label = document.getElementById("render-label");
      if (label) label.textContent = `Rendering... ${Math.round((Date.now() - state.busySince) / 1000)} s`;
    }, 1000);
  }
}

async function runProvider(prompt: string, images: ImageData64[], aspectRatio?: string): Promise<ImageData64 | null> {
  const provider = makeProvider(state.settings);
  setBusy(true);
  // Older SketchUp versions embed a Chromium without AbortController.
  state.abort = typeof AbortController === "undefined" ? null : new AbortController();
  render();
  toast(`Sending to ${provider.label}...`);
  try {
    const res = await provider.render({ prompt, images, aspectRatio }, state.abort?.signal);
    toast(`Done in ${Math.round((Date.now() - state.busySince) / 1000)} s.`, "ok");
    return res.image;
  } catch (e) {
    const err = e as Error;
    toast(err.name === "AbortError" ? "Cancelled." : err.message, err.name === "AbortError" ? "info" : "error");
    return null;
  } finally {
    setBusy(false);
    state.abort = null;
  }
}

async function record(tool: ToolId, prompt: string, before: ImageData64, after: ImageData64): Promise<void> {
  const provider = makeProvider(state.settings);
  await addHistory({
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
    tool,
    presetName: tool === "render" ? state.preset.name : undefined,
    prompt,
    before,
    after,
    provider: provider.label,
    model: provider.modelName ?? state.settings.comfyUrl,
  });
  state.history = await listHistory();
}

async function runRender(): Promise<void> {
  const cap = state.capture;
  if (!cap) return;
  const prompt = currentRenderPrompt();
  const images = [cap.view, ...(cap.lines ? [cap.lines] : [])];
  const size = await imageSize(cap.view);
  const out = await runProvider(prompt, images, nearestAspectRatio(size.width, size.height));
  if (out) {
    state.result = out;
    await record("render", prompt, cap.view, out);
  }
  render();
}

// ---------- presets ----------

async function savePresetAs(): Promise<void> {
  const name = window.prompt("Name for this preset", state.preset.builtIn ? `${state.preset.name} (copy)` : state.preset.name);
  if (!name) return;
  const existing = state.settings.userPresets.find((x) => x.name === name);
  const preset: Preset = { ...state.preset, id: existing?.id ?? newPresetId(name), name, builtIn: undefined };
  state.settings.userPresets = [...state.settings.userPresets.filter((x) => x.id !== preset.id), preset];
  state.preset = { ...preset };
  await persist();
  render();
  toast(`Saved preset "${name}".`, "ok");
}

async function deletePreset(): Promise<void> {
  const id = state.preset.id;
  state.settings.userPresets = state.settings.userPresets.filter((x) => x.id !== id);
  state.preset = { ...BUILT_IN_PRESETS[0] };
  await persist();
  render();
}

function exportPresets(): void {
  const json = JSON.stringify({ app: "ai-render-suite", version: 1, presets: state.settings.userPresets }, null, 2);
  const a = h("a", { href: `data:application/json;charset=utf-8,${encodeURIComponent(json)}`, download: "render-presets.json" });
  document.body.append(a);
  a.click();
  a.remove();
  toast(state.settings.userPresets.length ? "Exported your presets." : "No saved presets yet; the exported file is empty.");
}

function importButton(): HTMLElement {
  const input = h("input", { type: "file", accept: "application/json,.json", class: "hidden" }) as HTMLInputElement;
  input.addEventListener("change", async () => {
    const f = input.files?.[0];
    if (!f) return;
    try {
      const found = parsePresetFile(JSON.parse(await f.text()));
      const byId = new Map(state.settings.userPresets.map((p) => [p.id, p]));
      for (const p of found) byId.set(p.id, p);
      state.settings.userPresets = [...byId.values()];
      await persist();
      render();
      toast(`Imported ${found.length} preset${found.length === 1 ? "" : "s"}.`, "ok");
    } catch {
      toast("That file is not a preset file.", "error");
    }
  });
  return h("span", {}, iconButton("upload", "Import presets", () => input.click(), "small"), input);
}

// ---------- Edit tab ----------

function editTab(body: HTMLElement): void {
  const input = uploadInput("edit");
  if (!state.editSource) {
    body.append(
      h(
        "div",
        { class: "empty" },
        icon("edit", 34),
        h("h2", {}, "Edit a render"),
        h("p", {}, "Paint over part of an image and say what should change, or change its lighting. Pick a render from Render or History, or upload one."),
        h("div", { class: "row center" }, primaryButton("Upload image", "upload", () => input.click()), state.history.length ? button("From history", "history", () => { state.tab = "history"; render(); }, "ghost") : null, input),
      ),
    );
    return;
  }
  const src = state.editSource;
  body.append(
    segmented(
      [
        { id: "spot", label: "Spot edit", icon: "edit" },
        { id: "relight", label: "Change lighting", icon: "lights" },
      ],
      state.editMode,
      (v) => {
        state.editMode = v as State["editMode"];
        render();
      },
    ),
  );
  if (state.editMode === "spot") {
    body.append(
      section(
        "Paint the area to change",
        paintArea(src),
        h(
          "label",
          { class: "field" },
          h("span", {}, "What should change"),
          textarea(state.editInstruction, "e.g. replace the car with a frangipani tree in a concrete planter", 2, (v) => (state.editInstruction = v)),
        ),
        h("p", { class: "hint" }, "Only the painted area is replaced. Everything else stays exactly as it is."),
        primaryButton(state.busy ? "Working..." : "Apply edit", "wand", runSpotEdit, state.busy, "wide"),
      ),
    );
  } else {
    body.append(
      section(
        "New lighting",
        h("img", { class: "stage-img", src: toDataUrl(src), alt: "Image to relight" }),
        h(
          "div",
          { class: "light-grid" },
          lightingOptions().map((o) =>
            lightingCard(o, o.id === state.relight, () => {
              state.relight = o.id;
              render();
            }),
          ),
        ),
        h(
          "label",
          { class: "field" },
          h("span", {}, "Notes"),
          textarea(state.editInstruction, "Optional, e.g. wet road after rain", 2, (v) => (state.editInstruction = v)),
        ),
        primaryButton(state.busy ? "Working..." : "Change lighting", "lights", runRelight, state.busy, "wide"),
      ),
    );
  }
  body.append(h("div", { class: "row" }, button("Use another image", "upload", () => input.click(), "ghost small"), input));
}

function paintArea(src: ImageData64): HTMLElement {
  const img = h("img", { src: toDataUrl(src), alt: "Image to edit" }) as HTMLImageElement;
  const canvas = maskCanvas ?? (h("canvas", { class: "paint" }) as HTMLCanvasElement);
  canvas.className = "paint";
  let brushSize = 40;
  const wrap = h("div", { class: "paint-wrap" }, img, canvas);
  img.addEventListener("load", () => {
    if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
    }
  });
  maskCanvas = canvas;

  let drawing = false;
  let last: [number, number] | null = null;
  const point = (e: PointerEvent): [number, number] => {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * canvas.width, ((e.clientY - r.top) / r.height) * canvas.height];
  };
  const stroke = (to: [number, number]) => {
    const ctx = canvas.getContext("2d")!;
    const scale = canvas.width / canvas.getBoundingClientRect().width;
    ctx.strokeStyle = "rgb(255,0,0)";
    ctx.lineWidth = brushSize * scale;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    const from = last ?? to;
    ctx.moveTo(from[0], from[1]);
    ctx.lineTo(to[0], to[1]);
    ctx.stroke();
    last = to;
  };
  canvas.onpointerdown = (e) => {
    drawing = true;
    canvas.setPointerCapture(e.pointerId);
    last = null;
    stroke(point(e));
  };
  canvas.onpointermove = (e) => drawing && stroke(point(e));
  canvas.onpointerup = () => {
    drawing = false;
    last = null;
  };

  return h(
    "div",
    { class: "paint-box" },
    wrap,
    h(
      "div",
      { class: "row" },
      h("div", { class: "grow" }, slider("Brush", 5, 200, 1, brushSize, " px", (v) => (brushSize = v))),
      button("Clear", "trash", () => canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height), "ghost small"),
    ),
  );
}

function maskIsEmpty(c: HTMLCanvasElement): boolean {
  if (!c.width || !c.height) return true;
  const data = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
  for (let i = 3; i < data.length; i += 16) if (data[i] > 0) return false;
  return true;
}

async function runSpotEdit(): Promise<void> {
  const src = state.editSource;
  if (!src || !maskCanvas) return;
  if (maskIsEmpty(maskCanvas)) return toast("Paint over the area you want to change first.", "error");
  if (!state.editInstruction.trim()) return toast("Describe what should change.", "error");
  const prompt = buildSpotEditPrompt(state.editInstruction);
  const mask = maskCanvas;
  const overlay = await redOverlay(src, mask);
  const size = await imageSize(src);
  const out = await runProvider(prompt, [src, overlay], nearestAspectRatio(size.width, size.height));
  if (out) {
    const fitted = await resizeTo(out, size.width, size.height);
    const merged = await compositeMasked(src, fitted, mask);
    await record("spot-edit", prompt, src, merged);
    state.editSource = merged;
    maskCanvas = null;
    showEditResult(src, merged, "spot-edit");
    return;
  }
  render();
}

async function runRelight(): Promise<void> {
  const src = state.editSource;
  if (!src) return;
  const prompt = buildLightingPrompt(state.relight, state.editInstruction, state.capture?.facts);
  const size = await imageSize(src);
  const out = await runProvider(prompt, [src], nearestAspectRatio(size.width, size.height));
  if (out) {
    await record("lighting", prompt, src, out);
    showEditResult(src, out, "lighting");
    return;
  }
  render();
}

function showEditResult(before: ImageData64, after: ImageData64, tool: ToolId): void {
  render();
  const body = root.querySelector("main");
  body?.prepend(section("Result", h("div", { class: "stage-frame" }, compareSlider(before, after)), resultActions(after, tool)));
}

// ---------- Lights tab ----------

function needsSketchUp(body: HTMLElement, what: string): boolean {
  if (host.kind === "sketchup") return false;
  body.append(h("div", { class: "empty" }, icon("info", 34), h("h2", {}, `${what} work inside SketchUp`), h("p", {}, "Install the plugin (.rbz) to place lights and mirrors in your model. The web app can still render, edit and relight images.")));
  return true;
}

function lightsStrip(): HTMLElement {
  const l = state.lights;
  const stat = (n: number, label: string) => h("div", { class: "stat" }, h("strong", {}, String(n)), h("small", {}, label));
  return h(
    "div",
    { class: "strip" },
    stat(l?.spots ?? 0, "spots"),
    stat(l?.leds ?? 0, "LED strips"),
    stat(l?.mirrors ?? 0, "mirrors"),
    h(
      "div",
      { class: "strip-actions" },
      iconButton(l?.visible === false ? "eyeOff" : "eye", l?.visible === false ? "Show AI lights" : "Hide AI lights", async () => {
        try {
          state.lights = await host.call<LightSummary>("toggleLights");
          render();
        } catch (e) {
          toast((e as Error).message, "error");
        }
      }),
      iconButton("trash", "Remove selected AI lights or mirrors", async () => {
        try {
          state.lights = await host.call<LightSummary>("removeSelectedLights");
          render();
          toast("Removed.", "ok");
        } catch (e) {
          toast((e as Error).message, "error");
        }
      }),
    ),
  );
}

function kelvinPicker(value: number, onPick: (k: number) => void): HTMLElement {
  return h(
    "div",
    { class: "kelvins" },
    KELVINS.map((k) =>
      h(
        "button",
        { class: k === value ? "kelvin active" : "kelvin", type: "button", title: `${k}K, ${kelvinLabel(k)}`, onclick: () => onPick(k) },
        h("i", { style: `background:${rgbCss(kelvinToRgb(k))}` }),
        h("span", {}, `${k}K`),
      ),
    ),
  );
}

function beamCanvas(beamId: string, w: number, h2: number, kelvin: number, intensity: number, flip = false): HTMLCanvasElement {
  const c = h("canvas", { width: w, height: h2 }) as HTMLCanvasElement;
  const beam = BEAMS.find((b) => b.id === beamId) ?? BEAMS[0];
  paintBeam(c.getContext("2d")!, w, h2, beam, kelvin, intensity, true, flip);
  return c;
}

function beamTexture(s: SpotSettings): { id: string; data: string } {
  const beam = BEAMS.find((b) => b.id === s.beam) ?? BEAMS[0];
  const w = 256;
  const hh = Math.max(64, Math.min(1024, Math.round((256 * s.lengthMm) / s.widthMm)));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = hh;
  paintBeam(c.getContext("2d")!, w, hh, beam, s.kelvin, s.intensity);
  return { id: settingsId("spot", { b: s.beam, k: s.kelvin, i: s.intensity, r: hh }), data: c.toDataURL("image/png").split(",")[1] };
}

function ledTexture(s: LedSettings): { id: string; data: string } {
  const profile = LED_PROFILES.find((p) => p.id === s.profile) ?? LED_PROFILES[0];
  const c = document.createElement("canvas");
  c.width = 8;
  c.height = 256;
  paintLed(c.getContext("2d")!, 8, 256, profile, s.kelvin, s.intensity);
  return { id: settingsId("led", { p: s.profile, k: s.kelvin, i: s.intensity }), data: c.toDataURL("image/png").split(",")[1] };
}

function lightsTab(body: HTMLElement): void {
  if (needsSketchUp(body, "Light tools")) return;
  body.append(lightsStrip());
  body.append(
    segmented(
      [
        { id: "spot", label: "Spotlight", icon: "spot" },
        { id: "led", label: "LED strip", icon: "led" },
      ],
      state.lightMode,
      (v) => {
        state.lightMode = v as State["lightMode"];
        render();
      },
    ),
  );
  if (state.lightMode === "spot") spotPanel(body);
  else ledPanel(body);
  body.append(
    h("p", { class: "hint" }, "Lights go on their own tag, AI Lights, and cast no shadows. The render reads them as real fittings and adds the glow and spill."),
  );
}

function spotPanel(body: HTMLElement): void {
  const s = state.spot;
  const preview = h("div", { class: "light-preview" });
  const draw = () => {
    clear(preview);
    const flip = s.orientation === "up";
    const c = beamCanvas(s.beam, 300, Math.round(Math.min(360, (300 * s.lengthMm) / s.widthMm)), s.kelvin, s.intensity, flip);
    if (s.orientation === "left" || s.orientation === "right") c.style.transform = `rotate(${s.orientation === "left" ? 90 : -90}deg)`;
    preview.append(c, h("span", { class: "badge" }, `${s.widthMm} × ${s.lengthMm} mm · ${s.kelvin}K`));
  };
  draw();
  body.append(section("Preview", preview));

  body.append(
    section(
      "Beam",
      h(
        "div",
        { class: "beam-grid" },
        BEAMS.map((b) =>
          h(
            "button",
            {
              class: b.id === s.beam ? "beam active" : "beam",
              type: "button",
              title: b.name,
              onclick: () => {
                s.beam = b.id;
                render();
              },
            },
            beamCanvas(b.id, 64, 84, s.kelvin, 80),
            h("span", {}, b.name),
          ),
        ),
      ),
    ),
  );
  body.append(
    section(
      "Light",
      kelvinPicker(s.kelvin, (k) => {
        s.kelvin = k;
        render();
      }),
      slider("Intensity", 10, 100, 1, s.intensity, "%", (v) => {
        s.intensity = v;
        draw();
      }),
      slider("Beam length", 200, 3000, 50, s.lengthMm, " mm", (v) => {
        s.lengthMm = v;
        draw();
      }),
      slider("Beam width", 150, 2000, 50, s.widthMm, " mm", (v) => {
        s.widthMm = v;
        draw();
      }),
      h(
        "div",
        { class: "field" },
        h("span", {}, "Direction"),
        segmented(
          [
            { id: "down", label: "Down", icon: "arrowDown" },
            { id: "up", label: "Up", icon: "arrowUp" },
            { id: "left", label: "Left", icon: "arrowLeft" },
            { id: "right", label: "Right", icon: "arrowRight" },
          ],
          s.orientation,
          (v) => {
            s.orientation = v as SpotSettings["orientation"];
            render();
          },
        ),
      ),
    ),
  );
  body.append(
    primaryButton("Place spotlights", "spot", async () => {
      try {
        await host.call("placeSpots", { settings: s, texture: beamTexture(s) });
        toast("Click walls or ceilings in SketchUp where each light sits. Esc to finish.", "ok");
      } catch (e) {
        toast((e as Error).message, "error");
      }
    }, false, "wide"),
  );
}

function ledPanel(body: HTMLElement): void {
  const s = state.led;
  const preview = h("div", { class: "light-preview led" });
  const draw = () => {
    clear(preview);
    // Glow drawn to scale against a 600 mm tall preview wall.
    const gh = Math.max(12, Math.round((s.widthMm / 600) * 120));
    const c = h("canvas", { width: 300, height: gh, style: `height:${gh}px` }) as HTMLCanvasElement;
    const profile = LED_PROFILES.find((p) => p.id === s.profile) ?? LED_PROFILES[0];
    paintLed(c.getContext("2d")!, 300, gh, profile, s.kelvin, s.intensity, true);
    preview.append(c, h("span", { class: "badge" }, `${s.widthMm} mm glow · ${s.kelvin}K`));
  };
  draw();
  body.append(section("Preview", preview));
  body.append(
    section(
      "Strip",
      segmented(
        LED_PROFILES.map((p) => ({ id: p.id, label: p.name })),
        s.profile,
        (v) => {
          s.profile = v;
          render();
        },
      ),
      kelvinPicker(s.kelvin, (k) => {
        s.kelvin = k;
        render();
      }),
      slider("Intensity", 10, 100, 1, s.intensity, "%", (v) => {
        s.intensity = v;
        draw();
      }),
      slider("Glow width", 30, 600, 10, s.widthMm, " mm", (v) => {
        s.widthMm = v;
        draw();
      }),
    ),
  );
  body.append(
    h(
      "ol",
      { class: "steps" },
      h("li", {}, "In SketchUp, select the edges where the strip runs: a ceiling cove, under a shelf, behind a mirror, along a step."),
      h("li", {}, "Press Add LED. The glow spreads from each edge across the face next to it."),
    ),
  );
  body.append(
    primaryButton("Add LED to selected edges", "led", async () => {
      try {
        const n = await host.call<number>("addLeds", { settings: s, texture: ledTexture(s) });
        toast(`Added LED glow to ${n} edge${n === 1 ? "" : "s"}.`, "ok");
      } catch (e) {
        toast((e as Error).message, "error");
      }
    }, false, "wide"),
  );
}

// ---------- Mirror tab ----------

function mirrorTab(body: HTMLElement): void {
  if (needsSketchUp(body, "Mirror reflections")) return;
  body.append(lightsStrip());
  body.append(
    section(
      "Mirror reflection",
      h("p", { class: "hint" }, "SketchUp renders the room from the mirror's position and lays that picture onto the mirror. The AI render then has a real reflection to work from, instead of a flat grey face."),
      h(
        "ol",
        { class: "steps" },
        h("li", {}, "Press Pick mirror face, then click the mirror in SketchUp. Works for glass doors, TV screens and polished panels too."),
        h("li", {}, "Changed the room? Press Update reflections before you capture."),
      ),
      slider("Reflection field of view", 30, 100, 1, state.mirrorFov, "°", (v) => (state.mirrorFov = v)),
      primaryButton("Pick mirror face", "mirror", async () => {
        try {
          await host.call("pickMirror", { settings: { fov: state.mirrorFov } });
          toast("Click the mirror face in SketchUp.", "ok");
        } catch (e) {
          toast((e as Error).message, "error");
        }
      }, false, "wide"),
      button("Update reflections", "refresh", async () => {
        try {
          const n = await host.call<number>("refreshMirrors");
          toast(`Updated ${n} mirror${n === 1 ? "" : "s"}.`, "ok");
        } catch (e) {
          toast((e as Error).message, "error");
        }
      }, "ghost wide"),
    ),
  );
}

// ---------- History tab ----------

function toolLabel(t: ToolId): string {
  return t === "render" ? "Render" : t === "lighting" ? "Lighting" : "Spot edit";
}

function historyTab(body: HTMLElement): void {
  if (!state.history.length) {
    body.append(h("div", { class: "empty" }, icon("history", 34), h("h2", {}, "No renders yet"), h("p", {}, "Renders appear here with the prompt that made them. They stay on this computer.")));
    return;
  }
  const detail = h("div", {});
  body.append(
    h(
      "div",
      { class: "history-grid" },
      state.history.map((item) =>
        h(
          "button",
          {
            class: "thumb",
            type: "button",
            title: new Date(item.createdAt).toLocaleString(),
            onclick: () => {
              clear(detail);
              detail.append(historyDetail(item));
              detail.scrollIntoView({ behavior: "smooth" });
            },
          },
          h("img", { src: toDataUrl(item.after), alt: item.presetName ?? item.tool, loading: "lazy" }),
          h("span", {}, item.presetName ?? toolLabel(item.tool)),
        ),
      ),
    ),
    detail,
  );
}

function historyDetail(item: HistoryItem): HTMLElement {
  return section(
    `${toolLabel(item.tool)}${item.presetName ? ` · ${item.presetName}` : ""}`,
    h("p", { class: "hint" }, `${new Date(item.createdAt).toLocaleString()} · ${item.provider} · ${item.model}`),
    h("div", { class: "stage-frame" }, compareSlider(item.before, item.after)),
    resultActions(item.after, item.tool),
    h("details", {}, h("summary", {}, "Prompt used"), h("pre", {}, item.prompt)),
    button("Delete from history", "trash", async () => {
      await removeHistory(item.id);
      state.history = await listHistory();
      render();
    }, "ghost small"),
  );
}

// ---------- Settings sheet ----------

function settingsSheet(): HTMLElement {
  const s = state.settings;
  const close = () => {
    state.settingsOpen = false;
    render();
  };
  const sheet = h("div", { class: "sheet" });
  sheet.append(
    h("div", { class: "sheet-head" }, h("h2", {}, "Settings"), iconButton("close", "Close", close)),
    section(
      "AI backend",
      segmented(
        [
          { id: "gemini", label: "Gemini (your key)", icon: "key" },
          { id: "comfyui", label: "ComfyUI (local)", icon: "gear" },
        ],
        s.backend,
        async (v) => {
          s.backend = v as Settings["backend"];
          await persist();
          render();
        },
      ),
    ),
  );

  if (s.backend === "gemini") {
    const key = h("input", { type: "password", value: s.geminiKey, placeholder: "Paste your Gemini API key", autocomplete: "off" }) as HTMLInputElement;
    key.addEventListener("change", async () => {
      s.geminiKey = key.value.trim();
      await persist();
    });
    const modelSel = h("select", {}, h("option", { value: s.geminiModel }, s.geminiModel)) as HTMLSelectElement;
    modelSel.addEventListener("change", async () => {
      s.geminiModel = modelSel.value;
      await persist();
    });
    sheet.append(
      section(
        "Gemini",
        h("label", { class: "field" }, h("span", {}, "API key"), key),
        h("p", { class: "hint" }, "Get a key at aistudio.google.com. Google bills image generation to that key's account. The key is saved on this computer in plain text, so avoid saving it on a shared office PC."),
        h("label", { class: "field" }, h("span", {}, "Model"), modelSel),
        button("Test key and load models", "check", async () => {
          try {
            s.geminiKey = key.value.trim();
            await persist();
            toast("Checking the key...");
            const models = await new GeminiProvider(s.geminiKey).listImageModels();
            clear(modelSel);
            const list = models.includes(s.geminiModel) || !models.length ? models : [s.geminiModel, ...models];
            for (const m of list.length ? list : [s.geminiModel]) modelSel.append(h("option", { value: m, selected: m === s.geminiModel }, m));
            toast(models.length ? `Key works. ${models.length} image model${models.length === 1 ? "" : "s"} found.` : "Key works, but no image models were listed for it.", "ok");
          } catch (e) {
            toast((e as Error).message, "error");
          }
        }, "ghost"),
      ),
    );
  } else {
    const url = h("input", { type: "url", value: s.comfyUrl }) as HTMLInputElement;
    url.addEventListener("change", async () => {
      s.comfyUrl = url.value.trim();
      await persist();
    });
    const wf = h("textarea", { rows: 8, placeholder: '{"3": {"class_type": "KSampler", ...}}' }, s.comfyWorkflow) as HTMLTextAreaElement;
    wf.addEventListener("change", async () => {
      s.comfyWorkflow = wf.value;
      await persist();
    });
    sheet.append(
      section(
        "ComfyUI (experimental)",
        h("p", { class: "hint" }, "Start ComfyUI with --enable-cors-header. In your workflow put {{PROMPT}} in the positive prompt, {{IMAGE_1}} as the Load Image file name (and {{IMAGE_2}} for the line pass), then Export (API) and paste it here."),
        h("label", { class: "field" }, h("span", {}, "ComfyUI address"), url),
        h("label", { class: "field" }, h("span", {}, "Workflow (API format)"), wf),
        button("Test connection", "check", async () => {
          try {
            toast(await makeProvider(s).test(), "ok");
          } catch (e) {
            toast((e as Error).message, "error");
          }
        }, "ghost"),
      ),
    );
  }
  sheet.append(primaryButton("Done", "check", close, false, "wide"));
  return h("div", { class: "sheet-backdrop", onclick: (e: Event) => e.target === e.currentTarget && close() }, sheet);
}

// Exposed for the SketchUp toolbar "Capture view" button.
export async function captureFromHost(): Promise<void> {
  if (host.kind !== "sketchup") return;
  state.tab = "render";
  render();
  await doCapture();
}
