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
  dialTimeId,
  nearestAspectRatio,
  parseDialTime,
  sunPhase,
  sunText,
  type Option,
} from "./prompt";
import { GeminiProvider } from "./providers/gemini";
import { ACCENTS, FONTS, animateTheme, applyLook } from "./appearance";
import { CONTEXT_GROUPS, contextLabel, joinContexts, parseContexts } from "./context";
import { setLang, t } from "./i18n";
import { countSet, dynamicLines, findGenerator, GENERATORS, type DynGenerator, type DynValues } from "./dynamic";
import { BROWSER_SITES, loadSettings, makeProvider, saveSettings, type Settings } from "./settings";
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
  /** Open dynamic prompt generator, by id. */
  dynOpen: string | null;
  lookOpen: boolean;
  /** Site context picker: open, which group is shown, search text. */
  ctxOpen: boolean;
  ctxGroup: string;
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
    settingsOpen: !(settings.geminiKey || settings.backend !== "gemini"),
    dynOpen: null,
    lookOpen: false,
    ctxOpen: false,
    ctxGroup: CONTEXT_GROUPS[0].id,
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
  applyLook(settings);
  setLang(settings.lang);
  host.onEvent((name, payload) => {
    if (name === "browserStatus") {
      const p = payload as { text: string; kind: string };
      toast(p.text, p.kind === "error" ? "error" : p.kind === "ok" ? "ok" : "info");
    }
    if (name === "browserResult" && !state.busy) {
      // A result pulled back with no render waiting, e.g. a second try on the site.
      const img = payload as ImageData64;
      const before = state.capture?.view ?? img;
      state.result = img;
      state.tab = "render";
      record("render", currentRenderPrompt(), before, img).then(render);
      toast("Result added to history.", "ok");
    }
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
  const site = BROWSER_SITES.find((x) => x.id === s.browserSite) ?? BROWSER_SITES[0];
  const ready = s.backend === "comfyui" ? Boolean(s.comfyWorkflow.trim()) : s.backend === "browser" ? true : Boolean(s.geminiKey);
  const label =
    s.backend === "comfyui" ? "ComfyUI" : s.backend === "browser" ? `${site.label} · your account` : s.geminiModel.replace(/^gemini-/, "Gemini ").replace(/-/g, " ");
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
    { id: "render", label: t("Render"), icon: "render" },
    { id: "edit", label: t("Edit"), icon: "edit" },
    { id: "lights", label: t("Lights"), icon: "lights" },
    { id: "mirror", label: t("Mirror"), icon: "mirror" },
    { id: "history", label: t("History"), icon: "history" },
  ];
  root.append(
    h(
      "header",
      { class: "topbar" },
      logo(26),
      h("div", { class: "brand" }, h("strong", {}, "AI Render Suite"), h("small", {}, host.kind === "sketchup" ? "for SketchUp" : "web")),
      backendPill(),
      themeButton(),
      iconButton("palette", t("Customise"), () => {
        state.lookOpen = true;
        render();
      }),
      iconButton("gear", t("Settings"), openSettings),
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
  if (state.lookOpen) root.append(lookSheet());
  if (state.ctxOpen) root.append(contextSheet());
  if (state.dynOpen) {
    const g = findGenerator(state.dynOpen);
    if (g) root.append(dynamicSheet(g));
  }
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
    host.kind === "sketchup" ? primaryButton(t(cap ? "Recapture" : "Capture view"), "capture", doCapture, state.busy) : null,
    button(t("Upload"), "upload", () => input.click(), host.kind === "sketchup" ? "ghost" : "primary", state.busy),
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
          t("Show in SketchUp"),
        )
      : null;
  return sectionWith(t("Frame"), toggle, picker);
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
      t("Scene"),
      segmented(
        (Object.keys(PROJECT_TYPES) as ProjectType[]).map((id) => ({ id, label: t(id === "sketch" ? "Sketch" : PROJECT_TYPES[id].label.replace(" / masterplan", "")), icon: typeIcons[id] })),
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
      t("Environment"),
      sunDial(),
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

  body.append(surroundingsSection());

  body.append(dynamicSection());

  const presetCards = h(
    "div",
    { class: "preset-grid" },
    allPresets()
      .filter((x) => x.projectType === p.projectType)
      .map((x) =>
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
  if (!presetCards.childElementCount) {
    presetCards.append(h("p", { class: "hint" }, "No presets for this scene yet. Set it up and press + to save one."));
  }
  body.append(
    sectionWith(
      t("Style preset"),
      h(
        "div",
        { class: "head-actions" },
        iconButton("plus", "Save current settings as a preset", savePresetAs, "small"),
        p.builtIn ? null : iconButton("trash", "Delete this preset", deletePreset, "small"),
        iconButton("upload", "Export my presets", exportPresets, "small"),
        importButton(),
      ),
      presetCards,
      h(
        "label",
        { class: "field" },
        h("span", {}, t("Materials and style")),
        textarea(p.style, "e.g. board-formed concrete, terracotta tiles, timber louvers", 3, (v) => {
          state.preset.style = v;
          updatePromptPreview();
        }),
      ),
      h(
        "label",
        { class: "field" },
        h("span", {}, t("Notes for this view")),
        textarea(state.notes, "e.g. add a parked Honda Dream by the gate", 2, (v) => {
          state.notes = v;
          updatePromptPreview();
        }),
      ),
    ),
  );

  if (host.kind === "sketchup") body.append(geometrySection());
  body.append(
    h(
      "details",
      { class: "section advanced" },
      h("summary", {}, t("Advanced")),
      host.kind === "sketchup"
        ? h(
            "div",
            { class: "adv-grid" },
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
    h("span", { id: "render-label" }, t(state.busy ? "Rendering..." : state.result ? "Render again" : "Render")),
  );
  return h(
    "div",
    { class: "render-bar" },
    btn,
    state.busy && state.settings.backend === "browser"
      ? button("Bring result back", "arrowDown", () => host.call("browserGrab").catch((e: Error) => toast(e.message, "error")), "ghost")
      : null,
    state.busy && state.abort ? iconButton("close", "Cancel", () => state.abort?.abort(), "ghost") : null,
  );
}

function currentRenderPrompt(): string {
  return buildRenderPrompt({
    preset: state.preset,
    notes: state.notes,
    facts: state.capture?.facts,
    hasLinePass: Boolean(state.capture?.lines),
    extras: dynamicLines(state.settings.dynamic),
    lineStrength: state.settings.lineStrength,
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
  // draggable=false and preventDefault stop the browser's own image drag,
  // which used to grab the picture instead of moving the divider.
  const beforeImg = h("img", { src: toDataUrl(before), alt: "Before", draggable: "false" }) as HTMLImageElement;
  const afterImg = h("img", { src: toDataUrl(after), alt: "After", draggable: "false" }) as HTMLImageElement;
  const clip = h("div", { class: "compare-before" }, beforeImg);
  const handle = h("div", { class: "compare-handle" }, h("span", {}, "‹ ›"));
  const wrap = h(
    "div",
    { class: "compare" },
    afterImg,
    clip,
    handle,
    h("span", { class: "compare-tag left" }, "Before"),
    h("span", { class: "compare-tag right" }, "After"),
  );
  wrap.addEventListener("dragstart", (e) => e.preventDefault());
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
    if (e.button !== 0) return;
    e.preventDefault();
    drag = true;
    try {
      wrap.setPointerCapture(e.pointerId);
    } catch {
      /* old Chromium: window listeners below still track the drag */
    }
    move(e);
  });
  const onMove = (e: PointerEvent) => {
    if (!wrap.isConnected) return window.removeEventListener("pointermove", onMove);
    if (drag) move(e);
  };
  window.addEventListener("pointermove", onMove);
  const end = () => (drag = false);
  wrap.addEventListener("pointerup", end);
  wrap.addEventListener("pointercancel", end);
  wrap.addEventListener("lostpointercapture", end);
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
      const waitText = state.settings.backend === "browser" ? "Press Send in the browser" : "Rendering...";
      if (label) label.textContent = `${waitText} ${Math.round((Date.now() - state.busySince) / 1000)} s`;
    }, 1000);
  }
}

async function runProvider(prompt: string, images: ImageData64[], aspectRatio?: string): Promise<ImageData64 | null> {
  const provider = makeProvider(state.settings, host);
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
  const provider = makeProvider(state.settings, host);
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
  return h("span", {}, iconButton("save", "Import presets", () => input.click(), "small"), input);
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

function beamCanvas(beamId: string, w: number, h2: number, s: { kelvin: number; intensity: number; widthMm: number; lengthMm: number }, flip = false): HTMLCanvasElement {
  const c = h("canvas", { width: w, height: h2 }) as HTMLCanvasElement;
  const beam = BEAMS.find((b) => b.id === beamId) ?? BEAMS[0];
  paintBeam(c.getContext("2d")!, w, h2, beam, { ...s, onBlack: true, flipUp: flip });
  return c;
}

function beamTexture(s: SpotSettings): { id: string; data: string } {
  const beam = BEAMS.find((b) => b.id === s.beam) ?? BEAMS[0];
  const w = 256;
  const hh = Math.max(64, Math.min(1024, Math.round((256 * s.lengthMm) / s.widthMm)));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = hh;
  paintBeam(c.getContext("2d")!, w, hh, beam, s);
  return { id: settingsId("spot", { b: s.beam, k: s.kelvin, i: s.intensity, w: s.widthMm, l: s.lengthMm, v: 2 }), data: c.toDataURL("image/png").split(",")[1] };
}

function ledTexture(s: LedSettings): { id: string; data: string } {
  const profile = LED_PROFILES.find((p) => p.id === s.profile) ?? LED_PROFILES[0];
  const c = document.createElement("canvas");
  c.width = 8;
  c.height = 256;
  paintLed(c.getContext("2d")!, 8, 256, profile, s);
  return { id: settingsId("led", { p: s.profile, k: s.kelvin, i: s.intensity, w: s.widthMm, v: 2 }), data: c.toDataURL("image/png").split(",")[1] };
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
    const c = beamCanvas(s.beam, 300, Math.round(Math.min(380, (300 * s.lengthMm) / s.widthMm)), s, flip);
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
            beamCanvas(b.id, 72, 96, { kelvin: s.kelvin, intensity: 75, widthMm: 900, lengthMm: 1200 }),
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
    paintLed(c.getContext("2d")!, 300, gh, profile, { ...s, onBlack: true });
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
    h("div", { class: "sheet-head" }, h("h2", {}, t("Settings")), iconButton("close", "Close", close)),
    section(
      t("AI backend"),
      segmented(
        [
          { id: "gemini", label: "Gemini API key", icon: "key" },
          { id: "browser", label: "Your account", icon: "eye" },
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

  if (s.backend === "browser") {
    sheet.append(
      section(
        "Your own account, in a browser window",
        segmented(
          BROWSER_SITES.map((x) => ({ id: x.id, label: x.label })),
          s.browserSite,
          async (v) => {
            s.browserSite = v;
            await persist();
            render();
          },
        ),
        h(
          "ol",
          { class: "steps" },
          h("li", {}, "Press Open browser and sign in to the site once. SketchUp keeps you signed in."),
          h("li", {}, "Press Render. The captured view and the full prompt go into the chat box for you."),
          h("li", {}, "Check them and press Send on the site. When the image is done, press Bring result back."),
        ),
        h("p", { class: "hint" }, "No API key needed: your plan on that site and its limits apply. The site sometimes changes its page; if the image does not go in by itself, it is put on the clipboard so you can paste it with Ctrl+V."),
        host.kind === "sketchup"
          ? button("Open browser", "eye", async () => {
              try {
                toast(await makeProvider(s, host).test(), "ok");
              } catch (e) {
                toast((e as Error).message, "error");
              }
            }, "ghost")
          : h("p", { class: "hint" }, "This mode works inside the SketchUp plugin only."),
      ),
    );
  } else if (s.backend === "gemini") {
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
            toast(await makeProvider(s, host).test(), "ok");
          } catch (e) {
            toast((e as Error).message, "error");
          }
        }, "ghost"),
      ),
    );
  }
  sheet.append(primaryButton(t("Done"), "check", close, false, "wide"));
  return h("div", { class: "sheet-backdrop", onclick: (e: Event) => e.target === e.currentTarget && close() }, sheet);
}

// Exposed for the SketchUp toolbar "Capture view" button.
export async function captureFromHost(): Promise<void> {
  if (host.kind !== "sketchup") return;
  state.tab = "render";
  render();
  await doCapture();
}

// ---------- Dynamic prompts ----------

function dynamicSection(): HTMLElement {
  const all = state.settings.dynamic;
  const total = GENERATORS.reduce((n, g) => n + (dynamicLines({ [g.id]: all[g.id] ?? {} }).length ? 1 : 0), 0);
  return sectionWith(
    t("Dynamic prompts"),
    total ? button("Clear all", null, async () => {
      state.settings.dynamic = {};
      await persist();
      render();
    }, "ghost small") : null,
    h(
      "div",
      { class: "dyn-grid" },
      GENERATORS.map((g) => {
        const n = countSet(all[g.id]);
        return h(
          "button",
          {
            class: n ? "dyn-card active" : "dyn-card",
            type: "button",
            onclick: () => {
              state.dynOpen = g.id;
              render();
            },
          },
          icon(g.icon, 18),
          h("strong", {}, g.name),
          h("small", {}, n ? `${n} set` : g.blurb),
        );
      }),
    ),
  );
}

function dynamicSheet(g: DynGenerator): HTMLElement {
  const values: DynValues = { ...(state.settings.dynamic[g.id] ?? {}) };
  const preview = h("pre", { class: "dyn-preview" });
  const refresh = () => {
    preview.textContent = g.build(values) ?? "Nothing set yet. Fields left at No change stay out of the prompt.";
  };
  const close = async (save: boolean) => {
    if (save) {
      state.settings.dynamic = { ...state.settings.dynamic, [g.id]: values };
      await persist();
    }
    state.dynOpen = null;
    render();
  };
  const fields = h("div", { class: "dyn-fields" });
  for (const f of g.fields) {
    if (f.kind === "one") {
      const sel = h(
        "select",
        {},
        f.choices.map((c) => h("option", { value: c.id, selected: c.id === (values[f.id] ?? "") }, c.label)),
      ) as HTMLSelectElement;
      sel.value = (values[f.id] as string) ?? "";
      sel.addEventListener("change", () => {
        values[f.id] = sel.value;
        refresh();
      });
      fields.append(h("label", { class: f.half ? "field half" : "field" }, h("span", {}, f.label), sel));
    } else {
      const chosen = new Set(Array.isArray(values[f.id]) ? (values[f.id] as string[]) : []);
      const wrap = h("div", { class: "chips" });
      for (const c of f.choices) {
        const b = chip(c.label, chosen.has(c.id), () => {
          if (chosen.has(c.id)) chosen.delete(c.id);
          else chosen.add(c.id);
          values[f.id] = [...chosen];
          b.classList.toggle("active", chosen.has(c.id));
          refresh();
        });
        wrap.append(b);
      }
      fields.append(h("div", { class: "field" }, h("span", {}, f.label), wrap));
    }
  }
  refresh();
  const sheet = h(
    "div",
    { class: "sheet" },
    h("div", { class: "sheet-head" }, h("h2", {}, g.name), iconButton("close", "Close", () => close(false))),
    h("p", { class: "hint" }, `${g.blurb} Any field left at No change is left out of the prompt.`),
    fields,
    h("div", { class: "field" }, h("span", {}, "Adds to the prompt"), preview),
    h(
      "div",
      { class: "sheet-actions" },
      button("Reset", "trash", () => {
        for (const k of Object.keys(values)) delete values[k];
        state.settings.dynamic = { ...state.settings.dynamic, [g.id]: {} };
        persist().then(() => {
          state.dynOpen = g.id;
          render();
        });
      }, "ghost"),
      primaryButton("Apply", "check", () => close(true)),
    ),
  );
  return h("div", { class: "sheet-backdrop", onclick: (e: Event) => e.target === e.currentTarget && close(false) }, sheet);
}

// ---------- Theme and customise ----------

function themeButton(): HTMLElement {
  const dark = state.settings.theme === "dark";
  const btn = iconButton(dark ? "moon" : "sun", dark ? "Switch to light mode" : "Switch to dark mode", () => {
    const next = state.settings.theme === "dark" ? "light" : "dark";
    animateTheme(btn, next, () => {
      state.settings.theme = next;
      applyLook(state.settings);
      persist();
      render();
    });
  }, "theme-btn");
  return btn;
}

function lookSheet(): HTMLElement {
  const s = state.settings;
  const close = () => {
    state.lookOpen = false;
    render();
  };
  const update = async () => {
    applyLook(s);
    setLang(s.lang);
    await persist();
    render();
  };
  const sheet = h(
    "div",
    { class: "sheet" },
    h("div", { class: "sheet-head" }, h("h2", {}, t("Customise")), iconButton("close", "Close", close)),
    section(
      t("Theme"),
      segmented(
        [
          { id: "dark", label: t("Dark"), icon: "moon" },
          { id: "light", label: t("Light"), icon: "sun" },
        ],
        s.theme,
        (v) => {
          s.theme = v as Settings["theme"];
          update();
        },
      ),
    ),
    section(
      t("Accent colour"),
      h(
        "div",
        { class: "accents" },
        ACCENTS.map((a) =>
          h(
            "button",
            {
              class: a.id === s.accent ? "accent-dot active" : "accent-dot",
              type: "button",
              title: a.label,
              style: `--dot:${a.color}`,
              onclick: () => {
                s.accent = a.id;
                update();
              },
            },
            h("i", {}),
            h("span", {}, a.label),
          ),
        ),
      ),
    ),
    section(
      t("Font"),
      h(
        "div",
        { class: "font-list" },
        FONTS.map((f) =>
          h(
            "button",
            {
              class: f.id === s.font ? "font-opt active" : "font-opt",
              type: "button",
              style: `font-family:${f.stack}`,
              onclick: () => {
                s.font = f.id;
                update();
              },
            },
            h("strong", {}, f.label),
            h("small", {}, "Borey villa, blue hour · វីឡាបុរី"),
          ),
        ),
      ),
      h("p", { class: "hint" }, "Fonts other than System download from Google Fonts the first time, so they need internet once. Without it the panel falls back to Segoe UI and Khmer UI."),
    ),
    section(
      t("Language"),
      segmented(
        [
          { id: "en", label: "English" },
          { id: "km", label: "ខ្មែរ" },
        ],
        s.lang,
        (v) => {
          s.lang = v as Settings["lang"];
          update();
        },
      ),
      h("p", { class: "hint" }, "Changes the panel labels. Prompts always go to the AI in English. Notes you type in Khmer are sent as written and the AI is told they are in Khmer."),
    ),
    primaryButton(t("Done"), "check", close, false, "wide"),
  );
  return h("div", { class: "sheet-backdrop", onclick: (e: Event) => e.target === e.currentTarget && close() }, sheet);
}

// ---------- Geometry ----------

function geometrySection(): HTMLElement {
  const s = state.settings;
  const sw = h("input", {
    type: "checkbox",
    checked: s.linePass,
    onchange: async (e: Event) => {
      s.linePass = (e.target as HTMLInputElement).checked;
      await persist();
      render();
    },
  });
  const band = (k: number) => (k >= 0.9 ? "Strict" : k >= 0.6 ? "Close" : k >= 0.3 ? "Guide" : "Loose");
  const out = h("output", {}, `${s.lineStrength.toFixed(2)} · ${band(s.lineStrength)}`);
  const input = h("input", { type: "range", min: 0, max: 1, step: 0.05, value: s.lineStrength, "aria-label": t("Match to line drawing") }) as HTMLInputElement;
  const fill = () => input.style.setProperty("--fill", `${Number(input.value) * 100}%`);
  input.addEventListener("input", () => {
    s.lineStrength = Number(input.value);
    out.textContent = `${s.lineStrength.toFixed(2)} · ${band(s.lineStrength)}`;
    fill();
    updatePromptPreview();
  });
  input.addEventListener("change", () => persist());
  fill();
  return sectionWith(
    t("Geometry"),
    h("label", { class: "switch" }, sw, h("span", { class: "track" }), t("Send line drawing to hold geometry")),
    s.linePass
      ? h(
          "div",
          { class: "slider" },
          h("div", { class: "slider-head" }, h("label", {}, t("Match to line drawing")), out),
          input,
          h("div", { class: "scale-labels" }, h("span", {}, "0.0 loose"), h("span", {}, "0.5"), h("span", {}, "1.0 strict")),
        )
      : h("p", { class: "hint" }, "Off: only the SketchUp view is sent, so the AI may drift from your model."),
  );
}

// ---------- Sun dial ----------

const CARD_HOURS: Record<string, number> = { morning: 7, noon: 12, afternoon: 16.5, "blue-hour": 18.75, night: 20 };
const DIAL_START = 5.5;
const DIAL_END = 19.5;

function dialHour(): { hour: number; live: boolean } {
  const id = state.preset.lighting;
  const t0 = parseDialTime(id);
  if (t0 !== null) return { hour: t0, live: true };
  if (id === "sketchup" && state.capture?.facts?.shadowTime) {
    const iso = state.capture.facts.shadowTime;
    return { hour: Number(iso.slice(11, 13)) + Number(iso.slice(14, 16)) / 60, live: true };
  }
  if (id in CARD_HOURS) return { hour: CARD_HOURS[id], live: true };
  return { hour: 12, live: false };
}

function fmtHour(hour: number): string {
  const m = Math.round(hour * 60);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function sunColour(phase: string): [string, string, string] {
  // sky top, sky bottom, sun
  switch (phase) {
    case "Dawn":
      return ["#2c3560", "#e9967a", "#ffb36b"];
    case "Morning":
      return ["#5f9bd6", "#f3d6a6", "#ffe2a3"];
    case "Midday":
      return ["#2f86d8", "#bfe0f6", "#fff6d8"];
    case "Afternoon":
      return ["#4a88c7", "#f2c98d", "#ffd27a"];
    case "Golden hour":
      return ["#5a5f8a", "#f0a050", "#ff9d3c"];
    case "Dusk":
      return ["#2b2f5c", "#d9704a", "#ff7a45"];
    case "Blue hour":
      return ["#101a3d", "#3d5a99", "#c9d6ff"];
    default:
      return ["#05070f", "#1b2036", "#d9dde8"];
  }
}

function sunDial(): HTMLElement {
  const W = 320;
  const H = 150;
  const cx = W / 2;
  const cy = 118;
  const R = 112;
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag: string, attrs: Record<string, string | number>) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
    return e;
  };
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, class: "dial-svg", role: "slider", "aria-label": "Time of day" }) as SVGSVGElement;
  const defs = el("defs", {});
  const grad = el("linearGradient", { id: "dial-sky", x1: 0, y1: 0, x2: 0, y2: 1 });
  const stopTop = el("stop", { offset: "0%" });
  const stopBot = el("stop", { offset: "100%" });
  grad.append(stopTop, stopBot);
  const glow = el("radialGradient", { id: "dial-glow" });
  const g0 = el("stop", { offset: "0%", "stop-opacity": 0.9 });
  const g1 = el("stop", { offset: "100%", "stop-opacity": 0 });
  glow.append(g0, g1);
  defs.append(grad, glow);
  svg.append(defs);
  svg.append(el("rect", { x: 0, y: 0, width: W, height: cy, rx: 10, fill: "url(#dial-sky)", class: "dial-sky" }));
  svg.append(el("rect", { x: 0, y: cy, width: W, height: H - cy, fill: "var(--field)" }));
  svg.append(el("path", { d: `M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`, fill: "none", stroke: "rgba(255,255,255,0.35)", "stroke-width": 1.2, "stroke-dasharray": "3 5" }));
  svg.append(el("line", { x1: 8, y1: cy, x2: W - 8, y2: cy, stroke: "rgba(255,255,255,0.45)", "stroke-width": 1 }));
  const pos = (hour: number) => {
    const k = (Math.max(DIAL_START, Math.min(DIAL_END, hour)) - DIAL_START) / (DIAL_END - DIAL_START);
    const a = Math.PI * (1 - k);
    return [cx + R * Math.cos(a), cy - R * Math.sin(a)];
  };
  for (const hh of [6, 9, 12, 15, 18]) {
    const [x, y] = pos(hh);
    svg.append(el("circle", { cx: x, cy: y, r: 2.6, fill: "rgba(255,255,255,0.8)" }));
    const lab = el("text", { x, y: y - 8, "text-anchor": "middle", class: "dial-tick" });
    lab.textContent = `${hh}:00`;
    svg.append(lab);
  }
  const east = el("text", { x: 12, y: cy + 16, class: "dial-dir" });
  east.textContent = "E";
  const west = el("text", { x: W - 12, y: cy + 16, "text-anchor": "end", class: "dial-dir" });
  west.textContent = "W";
  svg.append(east, west);
  const halo = el("circle", { r: 26, fill: "url(#dial-glow)" });
  const sun = el("circle", { r: 9, class: "dial-sun" });
  const label = el("text", { x: cx, y: cy - 34, "text-anchor": "middle", class: "dial-phase" });
  const time = el("text", { x: cx, y: cy - 16, "text-anchor": "middle", class: "dial-time" });
  svg.append(halo, sun, label, time);
  const caption = h("p", { class: "dial-caption" });

  const month = state.capture?.facts?.shadowTime ? Number(state.capture.facts.shadowTime.slice(5, 7)) : new Date().getMonth() + 1;
  const draw = (hour: number, live: boolean) => {
    const phase = sunPhase(hour);
    const [top, bottom, sunC] = sunColour(phase);
    stopTop.setAttribute("stop-color", top);
    stopBot.setAttribute("stop-color", bottom);
    g0.setAttribute("stop-color", sunC);
    g1.setAttribute("stop-color", sunC);
    const [x, y] = pos(hour);
    for (const c of [halo, sun]) {
      c.setAttribute("cx", String(x));
      c.setAttribute("cy", String(y));
    }
    sun.setAttribute("fill", sunC);
    label.textContent = phase.toUpperCase();
    time.textContent = live ? fmtHour(hour) : "drag the sun to set a time";
    svg.classList.toggle("dim", !live);
    caption.textContent = live ? `${sunText(hour, month)}.` : "This light has no fixed sun position. Drag the sun to pick a time.";
  };
  const start = dialHour();
  draw(start.hour, start.live);

  let dragging = false;
  const hourAt = (e: PointerEvent) => {
    const r = svg.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const y = ((e.clientY - r.top) / r.height) * H;
    let a = Math.atan2(cy - y, x - cx);
    if (a < 0) a = x < cx ? Math.PI : 0;
    return DIAL_START + (1 - a / Math.PI) * (DIAL_END - DIAL_START);
  };
  const setFrom = (e: PointerEvent) => {
    const id = dialTimeId(hourAt(e));
    state.preset.lighting = id;
    draw(parseDialTime(id)!, true);
    updatePromptPreview();
  };
  svg.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    dragging = true;
    try {
      svg.setPointerCapture(e.pointerId);
    } catch {
      /* old Chromium */
    }
    setFrom(e);
  });
  svg.addEventListener("pointermove", (e) => dragging && setFrom(e));
  const stop = () => {
    if (!dragging) return;
    dragging = false;
    render(); // refresh which light card is active
  };
  svg.addEventListener("pointerup", stop);
  svg.addEventListener("pointercancel", stop);
  return h("div", { class: "dial" }, svg as unknown as HTMLElement, caption);
}

// ---------- Surroundings ----------

function surroundingsSection(): HTMLElement {
  const picks = parseContexts(state.preset.environment);
  const open = () => {
    state.ctxOpen = true;
    render();
  };
  return sectionWith(
    t("Surroundings"),
    button(t("Choose site context"), "aerial", open, "ghost small"),
    picks.length
      ? h(
          "div",
          { class: "chips" },
          picks.map((id) =>
            h(
              "span",
              { class: "chip active removable" },
              contextLabel(id),
              h(
                "button",
                {
                  type: "button",
                  "aria-label": `Remove ${contextLabel(id)}`,
                  onclick: () => {
                    state.preset.environment = joinContexts(picks.filter((x) => x !== id));
                    render();
                  },
                },
                "×",
              ),
            ),
          ),
        )
      : h("button", { class: "ctx-empty", type: "button", onclick: open }, icon("aerial", 18), h("span", {}, `${t("Keep as modelled")}. Pick a site context to place the building somewhere real.`)),
  );
}

function contextSheet(): HTMLElement {
  const chosen = parseContexts(state.preset.environment);
  let query = "";
  const close = (save: boolean) => {
    if (save) state.preset.environment = joinContexts(chosen);
    state.ctxOpen = false;
    render();
  };
  const list = h("div", { class: "ctx-list" });
  const rail = h("nav", { class: "ctx-rail" });
  const count = h("span", { class: "ctx-count" });
  const search = h("input", { type: "text", placeholder: "Search, or type your own context and press Enter", "aria-label": "Search site contexts" }) as HTMLInputElement;

  const toggle = (id: string) => {
    const i = chosen.indexOf(id);
    if (i >= 0) chosen.splice(i, 1);
    else chosen.push(id);
    draw();
  };
  const item = (c: { id: string; label: string; sub: string }) =>
    h(
      "button",
      { class: chosen.includes(c.id) ? "ctx-item on" : "ctx-item", type: "button", onclick: () => toggle(c.id) },
      h("span", { class: "ctx-check" }, icon("check", 14)),
      h("span", { class: "ctx-text" }, h("strong", {}, c.label), h("small", {}, c.sub)),
    );
  const draw = () => {
    clear(list);
    clear(rail);
    const q = query.trim().toLowerCase();
    for (const g of CONTEXT_GROUPS) {
      const n = g.items.filter((c) => chosen.includes(c.id)).length;
      rail.append(
        h(
          "button",
          {
            class: g.id === state.ctxGroup && !q ? "active" : "",
            type: "button",
            onclick: () => {
              state.ctxGroup = g.id;
              query = "";
              search.value = "";
              draw();
            },
          },
          h("span", {}, g.label),
          n ? h("em", {}, String(n)) : null,
        ),
      );
    }
    if (q) {
      const hits = CONTEXT_GROUPS.flatMap((g) => g.items).filter((c) => `${c.label} ${c.sub} ${c.text}`.toLowerCase().includes(q));
      list.append(h("div", { class: "ctx-head" }, h("h4", {}, `Results for "${query.trim()}"`), h("span", { class: "badge" }, `${hits.length}`)));
      list.append(h("div", { class: "ctx-items" }, hits.map(item)));
      list.append(
        h(
          "button",
          { class: "ctx-add", type: "button", onclick: () => addCustom() },
          icon("plus", 16),
          h("span", {}, `${t("Add")} "${query.trim()}" as your own context`),
        ),
      );
    } else {
      const g = CONTEXT_GROUPS.find((x) => x.id === state.ctxGroup) ?? CONTEXT_GROUPS[0];
      list.append(
        h(
          "div",
          { class: "ctx-banner", style: `background:linear-gradient(120deg, ${g.colors[0]}, ${g.colors[1]} 55%, ${g.colors[2]})` },
          h("span", { class: "badge" }, `${g.tag} · ${g.items.length} contexts`),
          h("h3", {}, g.label),
        ),
        h("div", { class: "ctx-items" }, g.items.map(item)),
      );
    }
    const custom = chosen.filter((id) => id.startsWith("custom:"));
    if (custom.length) {
      list.append(
        h("div", { class: "ctx-head" }, h("h4", {}, "Your own")),
        h("div", { class: "ctx-items" }, custom.map((id) => item({ id, label: contextLabel(id), sub: "Typed by you" }))),
      );
    }
    count.textContent = chosen.length ? `${chosen.length} selected` : "None selected: surroundings stay as modelled";
  };
  const addCustom = () => {
    const text = query.trim();
    if (!text) return;
    const id = `custom:${text.replace(/,/g, ";")}`;
    if (!chosen.includes(id)) chosen.push(id);
    query = "";
    search.value = "";
    draw();
  };
  search.addEventListener("input", () => {
    query = search.value;
    draw();
  });
  search.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addCustom();
  });
  draw();
  const sheet = h(
    "div",
    { class: "sheet ctx-sheet" },
    h(
      "div",
      { class: "sheet-head" },
      h("div", { class: "ctx-title" }, icon("aerial", 22), h("div", {}, h("h2", {}, t("Site context")), h("small", {}, "Pick one or more settings for the scene"))),
      iconButton("close", "Close", () => close(false)),
    ),
    h("label", { class: "ctx-search" }, icon("search", 16), search),
    h("div", { class: "ctx-body" }, list, rail),
    h(
      "div",
      { class: "ctx-foot" },
      count,
      button(t("Clear all"), null, () => {
        chosen.splice(0, chosen.length);
        draw();
      }, "ghost small"),
      primaryButton(t("Apply and close"), "check", () => close(true)),
    ),
  );
  return h("div", { class: "sheet-backdrop", onclick: (e: Event) => e.target === e.currentTarget && close(false) }, sheet);
}
