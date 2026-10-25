// The render suite interface. Same code in the SketchUp panel and the browser.

import { clear, h } from "./dom";
import { cropImage, cropToRatio, FRAME_ROW, FRAMES, findFrame, isListed, ratioFromPixels, swapFrameId } from "./frame";
import { detectHost, type Host } from "./host";
import { addHistory, listHistory, rateHistory, ratingSummary, removeHistory } from "./history";
import { icon, iconSvg, logo } from "./icons";
import { compositeMasked, fileToImage, imageSize, resizeTo, shrinkJpeg, toDataUrl, zoneOverlay } from "./images";
import { ZONES, ZonePainter, type PaintTool } from "./zones";
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
  DEFAULT_AVOID,
  ENVIRONMENTS,
  LIGHTING,
  PROJECT_TYPES,
  SKETCHUP_SUN,
  buildLightingPrompt,
  buildRenderPrompt,
  buildZoneEditPrompt,
  dialTimeId,
  fixtureSettingsLine,
  INTERIOR_RELIGHT,
  relightText,
  URBAN_RELIGHT,
  nearestAspectRatio,
  parseDialTime,
  sunPhase,
  sunText,
  type Option,
} from "./prompt";
import { GeminiProvider } from "./providers/gemini";
import { ProviderError } from "./providers/types";
import { fetchTransport, KIE_KEY_PAGE, KieProvider } from "./providers/kie";
import { nonePreset, parseScene, sceneLabel, scenePreset, scenePrompt, sceneTemplate, type SceneScan } from "./scene-scan";
import { progressAt, rememberDuration, runningLong, typicalMs } from "./progress";
import { applyPriceList, creditNumber, creditsFor, USD_PER_CREDIT, findKieModel, type PriceList, KIE_FAMILIES, modelsIn, priceFor, priceText, resolutionFor, type KieFamilyId, type KieModel, type KieResolution } from "./providers/kie-models";
import { modelLogo } from "./model-logos";
import { ACCENTS, FONTS, accentFrom, animateTheme, applyLook } from "./appearance";
import { CONTEXT_GROUPS, contextLabel, joinContexts, parseContexts } from "./context";
import { setLang, t } from "./i18n";
import { modelDnaTags, type ModelMaterial } from "./model-dna";
import { AERIAL_LOOKS, AERIAL_TYPES, EXT_STYLES, EXT_TYPES, filterLibrary, INT_STYLES, findLibraryItem, libraryItems, matchesWords, ROOMS, searchWords, type LibItem } from "./library";
import { PREVIEW_PACK } from "./preview-pack";
import { previewFile } from "./preview-files";
import { cutSheet, exportJson, tileFromImage, tileImage, tilePrompt, loadSheets, previewKey, previewMap, removeSheet, saveSheet, SHEET_MODEL, SHEET_RESOLUTION, SHEETS, sheetPrompt, type SheetDef, type SheetRecord } from "./style-previews";
import { countSet, DEFAULT_PLATE, dynamicLines, findGenerator, GENERATORS, platePhrase, type DynGenerator, type DynValues } from "./dynamic";
import { APP_VERSION, bugReport, CONTACT_LABEL, CONTACT_URL } from "./contact";
import { friendlyError, KIE_TOPUP_URL, type FixAction } from "./errors";
import { applyBackup, makeBackup } from "./backup";
import { BROWSER_SITES, loadSettings, makeProvider, saveSettings, type Settings, type StyleLock } from "./settings";
import {
  BORROW_LOOK_PROMPT,
  cleanBorrowedLook,
  cleanPeople,
  dnaConflicts,
  dnaGroup,
  dnaPrompt,
  DNA_GROUPS,
  geminiAnalyser,
  kieAnalyser,
  newTag,
  parseDna,
  peoplePrompt,
  PEOPLE_COUNTS,
  PEOPLE_SCENES,
  PEOPLE_WHO,
  type Analyser,
  type DnaTag,
  type PeopleOptions,
} from "./analysis";
import { hostTransport } from "./providers/kie";
import { mockAnalysis } from "./providers/mock";
import type { Capture, HistoryItem, ImageData64, LightSummary, Preset, ProjectType, RenderSetup, ToolId } from "./types";

type Tab = "render" | "edit" | "lights" | "mirror" | "history";
/** Where the template library is: the category picker, a category, or your own. */
type LibLevel = ProjectType | "mine" | "home";

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
  /** Settings opened from the model picker: show the Kie.ai key first. */
  settingsKie: boolean;
  /** Open dynamic prompt generator, by id. */
  dynOpen: string | null;
  lookOpen: boolean;
  /** Site context picker: open, which group is shown, search text. */
  ctxOpen: boolean;
  /** Open analysis sheet. */
  analyseOpen: "dna" | "people" | "scene" | null;
  peopleOpts: PeopleOptions;
  ctxGroup: string;
  frameEditor: boolean;
  /** Row orientation picked with swap; null follows the frame in use. */
  framePortrait: boolean | null;
  /** the docked chat browser is open */
  browserOpen: boolean;
  browserMenu: boolean;
  onboardStep: number;
  onboardPick: string;
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
  /** The user's own edit of the render prompt, or null to build it. */
  promptEdit: string | null;
  /** People line from Place People (editable). */
  people: string;
  /** Last results in the analysis windows, kept after closing until cleared or a new scan. */
  peopleDraft: string | null;
  dnaDraft: DnaTag[] | null;
  sceneLast: SceneScan | null;
  /** Style reference image sent after the view. */
  reference: ImageData64 | null;
  /** Material Scan tags for the current view. */
  dna: DnaTag[];
  result: ImageData64 | null;
  /** All images from the last render (1 to 4); result is the one shown. */
  results: ImageData64[];
  anglesOpen: boolean;
  /** The render More angles works from: the one on the stage or a History item. */
  anglesFrom: ImageData64 | null;
  /** Style, mood and materials read from the reference photo ("Borrow this look"). */
  borrowedLook: string;
  /** Admin tools shown in Settings (tap the version five times, or ?admin=1). */
  adminOpen: boolean;
  /** History item whose details are open. */
  historyOpenId: string | null;
  /** Kie credits left, null until checked. */
  kieCredits: number | null;
  /** What Kie said about the key last time we asked; "bad" means it was rejected. */
  kieKeyStatus: "unknown" | "ok" | "bad";
  lib: { open: boolean; type: LibLevel; style: string; subject: string; query: string };
  /** Style preview sheets made on this computer, by sheet id. */
  sheets: Record<string, SheetRecord>;
  /** Card pictures from style previews, by key ("int:japandi"). */
  previews: Map<string, string>;
  previewsOpen: boolean;
  modelSheet: boolean;
  /** Model family whose version list is open. */
  modelMenu: KieFamilyId | null;
  keysOpen: boolean;
  tourStep: number;
  /** History filter: "" all, a project name, or "No project". */
  historyProject: string;
  editSource: ImageData64 | null;
  /** Earlier versions of the image being edited, newest last (Undo last edit). */
  editStack: ImageData64[];
  editMode: "spot" | "relight";
  editInstruction: string;
  relight: string;
  relightGroup: "exterior" | "interior" | "urban";
  zonePrompts: Record<string, string>;
  /** Spot edit change for the whole picture, on top of the zones. */
  editGeneral: string;
  /** The user's own wording of the Edit prompt, or null to use the built one. */
  editPromptEdit: string | null;
  brushSize: number;
  editWithLight: boolean;
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
let painter: ZonePainter | null = null;
let busyTimer: number | undefined;
/** Set when a new result arrives, so the stage fades it in once. */
let freshResult = false;

export async function start(el: HTMLElement): Promise<void> {
  root = el;
  host = detectHost();
  const settings = await loadSettings(host);
  state = {
    tab: "render",
    settingsOpen: false,
    settingsKie: false,
    dynOpen: null,
    lookOpen: false,
    ctxOpen: false,
    analyseOpen: null,
    peopleOpts: { scene: "domestic", count: "few", who: "everyday" },
    ctxGroup: CONTEXT_GROUPS[0].id,
    frameEditor: false,
    framePortrait: null,
    browserOpen: false,
    browserMenu: false,
    onboardStep: 0,
    onboardPick: "",
    settings,
    original: null,
    capture: null,
    frameId: settings.frameId ?? "16:9",
    capturedFrameId: "",
    showFrame: true,
    preset: settings.styleLock ? { ...settings.styleLock.preset } : { ...BUILT_IN_PRESETS[0] },
    notes: "",
    promptEdit: null,
    people: "",
    peopleDraft: null,
    dnaDraft: null,
    sceneLast: null,
    reference: null,
    dna: [],
    result: null,
    results: [],
    anglesOpen: false,
    anglesFrom: null,
    borrowedLook: "",
    adminOpen: /[?&]admin=1\b/.test(location.search),
    historyOpenId: null,
    kieCredits: null,
    kieKeyStatus: "unknown",
    lib: { open: false, type: "home", style: "all", subject: "all", query: "" },
    sheets: {},
    previews: new Map(),
    previewsOpen: false,
    modelSheet: false,
    modelMenu: null,
    keysOpen: false,
    tourStep: 0,
    historyProject: "",
    editSource: null,
    editStack: [],
    editMode: "spot",
    editInstruction: "",
    relight: "blue-hour",
    relightGroup: "exterior",
    zonePrompts: {},
    editGeneral: "",
    editPromptEdit: null,
    brushSize: 40,
    editWithLight: false,
    lightMode: "spot",
    spot: { beam: "medium", kelvin: 3000, intensity: 70, lengthMm: 900, widthMm: 600, orientation: "down" },
    led: { profile: "soft", kelvin: 3000, intensity: 75, widthMm: 170 },
    mirrorFov: 60,
    lights: null,
    // Loaded right after the first paint, so the panel opens at once.
    history: [],
    busy: false,
    busySince: 0,
    abort: null,
  };
  state.sheets = await loadSheets();
  state.previews = previewMap(state.sheets);
  document.body.dataset.host = host.kind;
  applyLook(settings);
  setLang(settings.lang);
  host.onEvent((name, payload) => {
    if (name === "browserVisible") {
      state.browserOpen = Boolean(payload);
      const b = document.querySelector(".browser-btn");
      if (b) b.classList.toggle("active", state.browserOpen);
    }
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
  refreshCredits();
  loadPrices();
  listHistory().then((items) => {
    state.history = items;
    // Tab count, own-render cards and History need it: one redraw.
    if (items.length) render();
    recoverPending();
  });
}

// ---------- helpers ----------

function allPresets(): Preset[] {
  return [...BUILT_IN_PRESETS.map((p) => ({ ...p, builtIn: true })), ...state.settings.userPresets];
}

// Everything shown in a toast goes into the log with its full details;
// the toast itself stays short. An error toast opens the log when clicked.
interface LogEntry {
  at: number;
  kind: "info" | "error" | "ok";
  text: string;
  detail?: string;
}
const activityLog: LogEntry[] = [];

/** The first sentence only: the toast says what happened, the log says why. */
function shortText(text: string): string {
  const first = text.split(/(?<=[.!?])\s+/)[0] ?? text;
  return first.length > 90 ? `${first.slice(0, 87).trimEnd()}...` : first;
}

/** The last action a button ran, so an error toast can offer Retry. */
let lastAction: (() => unknown) | null = null;

function fixButton(action: FixAction): HTMLElement | null {
  if (!action) return null;
  const run =
    action === "retry"
      ? () => {
          const again = lastAction;
          if (again) Promise.resolve(again()).catch((e: Error) => toast(e.message, "error"));
        }
      : action === "topup"
        ? () => openExternal(KIE_TOPUP_URL)
        : () => {
            state.settingsKie = state.settings.backend === "kie";
            openSettings();
          };
  if (action === "retry" && !lastAction) return null;
  const label = action === "retry" ? "Retry" : action === "topup" ? "Top up" : "Settings";
  return h("button", { class: "toast-log toast-fix", type: "button", onclick: run }, label);
}

function toast(text: string, kind: "info" | "error" | "ok" = "info", detail?: string): void {
  if (kind === "error" && working) working.failed = true;
  const nice = kind === "error" ? friendlyError(text) : null;
  if (nice) detail = detail ?? text;
  // Our own messages that already say the numbers keep their wording.
  const short = nice && !/needs \d+/.test(text) ? nice.text : shortText(text);
  const more = detail ?? (short !== text ? text : undefined);
  activityLog.unshift({ at: Date.now(), kind, text: short, detail: more });
  activityLog.length = Math.min(activityLog.length, 100);
  if (kind === "error") console.warn("[David Render Studio]", text, detail ?? "");
  const bar = document.getElementById("status");
  if (!bar) return;
  bar.replaceChildren(
    h("span", {}, short.replace(/[.]$/, "")),
    nice ? fixButton(nice.action) ?? "" : "",
    kind === "error" ? h("button", { class: "toast-log", type: "button", onclick: openLog }, "See log") : "",
  );
  bar.className = `toast show ${kind}`;
  window.clearTimeout((bar as HTMLElement & { _t?: number })._t);
  (bar as HTMLElement & { _t?: number })._t = window.setTimeout(() => (bar.className = `toast ${kind}`), kind === "error" ? 9000 : 4500);
}

/** Opens on top of whatever is open, without redrawing, so nothing in a sheet is lost. */
function openLog(): void {
  document.getElementById("log-sheet")?.remove();
  root.append(logSheet());
}

function logSheet(): HTMLElement {
  const close = () => document.getElementById("log-sheet")?.remove();
  const text = () =>
    activityLog
      .map((e) => `${new Date(e.at).toLocaleTimeString()} [${e.kind}] ${e.text}${e.detail ? `\n    ${e.detail}` : ""}`)
      .join("\n");
  return h(
    "div",
    { class: "sheet-backdrop log-backdrop", id: "log-sheet", onclick: (e: Event) => e.target === e.currentTarget && close() },
    h(
      "div",
      { class: "sheet", role: "dialog", "aria-modal": "true" },
      h("div", { class: "sheet-head" }, h("h2", {}, "Log"), iconButton("close", "Close", close)),
      activityLog.length
        ? h(
            "ol",
            { class: "log-list" },
            activityLog.map((e) =>
              h(
                "li",
                { class: `log-${e.kind}` },
                h("time", {}, new Date(e.at).toLocaleTimeString()),
                h("strong", {}, e.text),
                e.detail ? h("pre", {}, e.detail) : null,
              ),
            ),
          )
        : h("p", { class: "hint" }, "Nothing yet. Messages from this session appear here."),
      h(
        "div",
        { class: "sheet-actions" },
        button("Copy log", "check", async () => {
          if (!(await copyText(text()))) return toast("Could not copy the log", "error");
          toast("Log copied", "ok");
        }, "ghost"),
        button("Report a bug", "bug", reportBug, "ghost"),
      ),
    ),
  );
}

function openExternal(url: string): void {
  if (host.kind === "sketchup") host.call("openUrl", { url }).catch(() => undefined);
  else window.open(url, "_blank", "noopener");
}

/** Copies a short report (no keys) and opens the maker's Telegram to paste it into. */
async function reportBug(): Promise<void> {
  const s = state.settings;
  const model = s.backend === "kie" ? s.kieModel : s.backend === "gemini" ? s.geminiModel : s.backend === "browser" ? s.browserSite : "";
  const text = bugReport({
    host: host.kind,
    backend: s.backend,
    model,
    userAgent: navigator.userAgent,
    log: activityLog,
    secrets: [s.kieKey, s.geminiKey],
  });
  // Browsers block a new tab that is not opened right on the click, so the
  // copy starts first and Telegram opens before waiting for it.
  const copied = copyText(text);
  if (host.kind !== "sketchup") openExternal(CONTACT_URL);
  if (!(await copied)) {
    showReportText(text);
    return toast("Could not copy by itself. Select the report, copy it, then paste it in Telegram", "error");
  }
  toast("Report and log copied. Paste them in Telegram", "ok");
  // In SketchUp, a short pause so the message is seen before Telegram takes focus.
  if (host.kind === "sketchup") setTimeout(() => openExternal(CONTACT_URL), 900);
}

/** Puts text on the clipboard. True only when it really got there. */
async function copyText(text: string): Promise<boolean> {
  if (host.kind === "sketchup") {
    try {
      await host.call("copyText", { text });
      return true;
    } catch {
      // Fall through to the panel's own ways.
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older embedded browsers block the clipboard API; the old copy command still works.
    const ta = h("textarea", { style: "position:fixed;left:-9999px;top:0" }) as HTMLTextAreaElement;
    ta.value = text;
    document.body.append(ta);
    ta.focus();
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

/** Last resort when nothing could copy: show the report so it can be copied by hand. */
function showReportText(text: string): void {
  const close = () => back.remove();
  const ta = h("textarea", { class: "prompt-edit", rows: 12, readonly: true }) as HTMLTextAreaElement;
  ta.value = text;
  const back = h(
    "div",
    { class: "sheet-backdrop", onclick: (e: Event) => e.target === e.currentTarget && close() },
    h(
      "div",
      { class: "sheet", role: "dialog", "aria-modal": "true" },
      h("div", { class: "sheet-head" }, h("h2", {}, "Bug report"), iconButton("close", "Close", close)),
      ta,
      h("div", { class: "sheet-actions" }, button("Open Telegram", "send", async () => (openExternal(CONTACT_URL), close()), "primary")),
    ),
  );
  document.body.append(back);
  ta.focus();
  ta.select();
}

/**
 * Saves a text file, asking where every time. SketchUp uses its own save
 * dialog; browsers that can use the system picker (it asks before
 * overwriting); others get a normal download. False when cancelled.
 */
async function saveTextFile(text: string, name: string, mime = "application/json"): Promise<boolean> {
  if (host.kind === "sketchup") return Boolean(await host.call("saveText", { text, name, title: "Save settings" }));
  const picker = (window as unknown as { showSaveFilePicker?: (o: unknown) => Promise<{ createWritable(): Promise<{ write(d: string): Promise<void>; close(): Promise<void> }> }> }).showSaveFilePicker;
  if (picker) {
    try {
      const handle = await picker({ suggestedName: name, types: [{ description: "Settings file", accept: { [mime]: [".json"] } }] });
      const w = await handle.createWritable();
      await w.write(text);
      await w.close();
      return true;
    } catch (e) {
      if ((e as Error).name === "AbortError") return false;
      // Some embedded browsers list the picker but refuse it: use a download.
    }
  }
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = h("a", { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}

/** Move presets, favourites, projects and choices to the other app or a new PC. */
function backupSection(): HTMLElement {
  const keys = h("input", { type: "checkbox" }) as HTMLInputElement;
  const file = h("input", { type: "file", accept: "application/json,.json", class: "hidden" }) as HTMLInputElement;
  file.addEventListener("change", async () => {
    const f = file.files?.[0];
    if (!f) return;
    try {
      const { settings, summary } = applyBackup(state.settings, JSON.parse(await f.text()));
      state.settings = settings;
      await persist();
      applyLook(settings);
      setLang(settings.lang);
      render();
      toast(`Imported: ${summary}`, "ok");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  });
  return section(
    "Backup and move",
    h("p", { class: "hint" }, "One file with your presets, favourites, projects and choices. Import it in the SketchUp plugin or the web app, or on a new PC."),
    h("label", { class: "check-row" }, keys, h("span", {}, "Include my API keys (keep that file private)")),
    h(
      "div",
      { class: "help-row" },
      button("Export settings", "save", async () => {
        const stamp = new Date().toISOString().slice(0, 10);
        try {
          const saved = await saveTextFile(JSON.stringify(makeBackup(state.settings, keys.checked), null, 2), `render-studio-settings-${stamp}.json`);
          if (saved) toast(keys.checked ? "Exported, keys included" : "Exported, keys left out", "ok");
        } catch (e) {
          toast(`Could not save: ${(e as Error).message}`, "error");
        }
      }, "ghost"),
      button("Import settings", "upload", async () => file.click(), "ghost"),
      file,
    ),
  );
}

function helpSection(): HTMLElement {
  return section(
    "Help",
    h(
      "div",
      { class: "help-row" },
      button("Contact", "send", async () => openExternal(CONTACT_URL), "ghost"),
      button("Report a bug", "bug", reportBug, "ghost"),
      button("Shortcuts", "info", () => {
        state.keysOpen = true;
        render();
      }, "ghost"),
    ),
    h(
      "p",
      { class: "hint" },
      `Contact: ${CONTACT_LABEL}. Report a bug copies your version, AI service and recent log (never your keys), then opens Telegram so you can paste it. `,
      h("span", { class: "version-tap", onclick: tapVersion }, `Version ${APP_VERSION}.`),
    ),
    state.adminOpen || state.settings.testMode ? adminBox() : null,
  );
}

let versionTaps = 0;
let versionTapTimer = 0;

/** Five taps on the version line show the admin tools. */
function tapVersion(): void {
  versionTaps++;
  window.clearTimeout(versionTapTimer);
  versionTapTimer = window.setTimeout(() => (versionTaps = 0), 1500);
  if (versionTaps < 5 || state.adminOpen) return;
  versionTaps = 0;
  state.adminOpen = true;
  render();
  toast("Admin tools shown", "ok");
}

function adminBox(): HTMLElement {
  const s = state.settings;
  return h(
    "div",
    { class: "admin-box" },
    h("strong", {}, "Admin"),
    h(
      "label",
      { class: "switch" },
      h("input", {
        type: "checkbox",
        checked: Boolean(s.testMode),
        onchange: async (e: Event) => {
          s.testMode = (e.target as HTMLInputElement).checked;
          await persist();
          render();
          toast(s.testMode ? "Test mode on: renders are sample images, no key or credits" : "Test mode off: renders use your AI service again", "ok");
          if (!s.testMode) refreshCredits();
        },
      }),
      h("span", { class: "track" }),
      "Test mode (no API key, no credits)",
    ),
    h("p", { class: "hint" }, "Every button runs as usual, but renders, edits and scans return sample results after a few seconds. Use it to test the app without paying for renders."),
  );
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

// Folding sections: the header becomes a toggle, and a closed section shows
// a one-line summary of its current value. Open/closed is remembered per
// section on this computer.
const FOLD_KEY = "airs.folds";
function foldState(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(FOLD_KEY) || "{}") as Record<string, boolean>;
  } catch {
    return {};
  }
}

function fold(el: HTMLElement, id: string, summary: string, openByDefault: boolean): HTMLElement {
  const saved = foldState()[id];
  let open = saved === undefined ? openByDefault : saved;
  const head = el.querySelector(":scope > .section-head") as HTMLElement | null;
  const title = head?.querySelector("h3");
  if (!head || !title) return el;
  const bodyId = `fold-${id}`;
  const sum = h("span", { class: "fold-sum" }, summary);
  const toggle = h(
    "button",
    { class: "fold-toggle", type: "button", "aria-expanded": String(open), "aria-controls": bodyId },
    icon("chevron", 16),
    h("h3", {}, title.textContent ?? ""),
    sum,
  ) as HTMLButtonElement;
  title.replaceWith(toggle);
  const inner = h("div", { class: "fold-body", id: bodyId });
  while (head.nextSibling) inner.append(head.nextSibling);
  el.append(inner);
  const apply = () => {
    el.classList.toggle("closed", !open);
    toggle.setAttribute("aria-expanded", String(open));
  };
  toggle.addEventListener("click", () => {
    open = !open;
    try {
      localStorage.setItem(FOLD_KEY, JSON.stringify({ ...foldState(), [id]: open }));
    } catch {
      /* storage blocked: folding still works for this session */
    }
    apply();
  });
  el.classList.add("fold");
  apply();
  return el;
}

/** A link that opens in the system browser (from SketchUp) or a new tab. */
function extLink(url: string, label: string): HTMLElement {
  return h(
    "a",
    {
      href: url,
      target: "_blank",
      rel: "noopener",
      class: "link",
      onclick: (e: Event) => {
        if (host.kind !== "sketchup") return;
        e.preventDefault();
        host.call("openUrl", { url }).catch(() => undefined);
      },
    },
    label,
  );
}

function chip(label: string, active: boolean, onclick: () => void, extra?: Node, title?: string): HTMLElement {
  return h("button", { class: active ? "chip active" : "chip", onclick, title, type: "button", "aria-pressed": active ? "true" : "false" }, extra ?? null, label);
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
        { class: it.id === value ? "active" : "", type: "button", title: it.label, "aria-pressed": it.id === value ? "true" : "false", onclick: () => onPick(it.id) },
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

// Feedback for every button. When a click starts async work, the button
// shows a spinner (and the seconds after a moment) until it finishes, then a
// short tick or cross. A toast shown while it runs decides which: an error
// toast means it failed.
let working: { btn: HTMLElement; failed: boolean } | null = null;

function withFeedback(onclick: () => unknown): (e: Event) => void {
  return (e: Event) => {
    const btn = e.currentTarget as HTMLButtonElement;
    if (btn.classList.contains("working")) return;
    lastAction = onclick;
    const out = onclick();
    if (!(out instanceof Promise)) return;
    const job = { btn, failed: false };
    working = job;
    btn.classList.add("working");
    btn.setAttribute("aria-busy", "true");
    const label = btn.querySelector(":scope > span");
    const text = label?.textContent ?? "";
    const end = (failed: boolean) => {
      if (working === job) working = null;
      if (label) label.textContent = text;
      btn.classList.remove("working");
      btn.removeAttribute("aria-busy");
      // The button may have been redrawn already; then nothing to flash.
      if (!btn.isConnected) return;
      const cls = failed ? "failed" : "done";
      btn.classList.add(cls);
      window.setTimeout(() => btn.classList.remove(cls), 1600);
    };
    out.then(
      () => end(job.failed),
      (err: unknown) => {
        toast((err as Error)?.message || "Something went wrong.", "error");
        end(true);
      },
    );
  };
}

function primaryButton(label: string, iconName: string, onclick: () => void, disabled = false, cls = ""): HTMLElement {
  return h("button", { class: `btn primary ${cls}`, onclick: withFeedback(onclick), disabled, type: "button" }, icon(iconName, 18), h("span", {}, label));
}

function button(label: string, iconName: string | null, onclick: () => void, cls = "", disabled = false): HTMLElement {
  return h("button", { class: `btn ${cls}`, onclick: withFeedback(onclick), disabled, type: "button" }, iconName ? icon(iconName, 16) : null, h("span", {}, label));
}

function iconButton(iconName: string, title: string, onclick: () => void, cls = ""): HTMLElement {
  return h("button", { class: `icon-btn ${cls}`, onclick: withFeedback(onclick), title, "aria-label": title, type: "button" }, icon(iconName, 18));
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

/** True when the chosen AI service has what it needs to render. */
function isConnected(): boolean {
  const s = state.settings;
  if (s.testMode) return true;
  return s.backend === "comfyui" ? Boolean(s.comfyWorkflow.trim()) : s.backend === "browser" ? true : s.backend === "kie" ? Boolean(s.kieKey.trim()) && state.kieKeyStatus !== "bad" : Boolean(s.geminiKey.trim());
}

function backendPill(): HTMLElement {
  const s = state.settings;
  const site = BROWSER_SITES.find((x) => x.id === s.browserSite) ?? BROWSER_SITES[0];
  const ready = isConnected();
  const rejected = s.backend === "kie" && state.kieKeyStatus === "bad";
  const platform =
    s.backend === "comfyui" ? "ComfyUI" : s.backend === "browser" ? site.label : s.backend === "kie" ? findKieModel(s.kieModel).label : "Gemini API";
  const title =
    s.backend === "gemini" ? `Gemini API key, model ${s.geminiModel}` : s.backend === "kie" ? `Kie.ai, ${findKieModel(s.kieModel).label}` : "Backend settings";
  return h(
    "button",
    { class: s.testMode ? "pill test" : ready ? "pill ok" : "pill warn", onclick: () => openSettings(), title: ready ? `${platform}. ${title}` : rejected ? "Kie.ai rejected this key. Open Settings to fix it." : "Not connected. Open Settings to add a key.", type: "button" },
    h("span", { class: "dot" }),
    h("span", {}, s.testMode ? "Test mode" : ready ? "Connected" : rejected ? "Key rejected" : "Not connected"),
  );
}

// A click outside the globe menu closes it.
document.addEventListener("click", (e) => {
  if (state?.browserMenu && !(e.target as Element).closest?.(".browser-wrap")) {
    state.browserMenu = false;
    render();
  }
});

/**
 * Globe button (SketchUp only): opens Gemini, ChatGPT or Google Flow in a
 * browser window docked beside the panel, with your own login. The sites
 * block being shown inside another page, so it is a real browser window.
 */
function browserButton(): HTMLElement | null {
  if (host.kind !== "sketchup") return null;
  const btn = iconButton("globe", state.browserOpen ? "Browser: switch site or close" : "Open a browser beside the panel", () => {
    state.browserMenu = !state.browserMenu;
    render();
  }, state.browserOpen ? "browser-btn active" : "browser-btn");
  return h("div", { class: "browser-wrap" }, btn, state.browserMenu ? browserMenu() : null);
}

function browserMenu(): HTMLElement {
  const current = state.settings.browserSite;
  const go = async (id: Settings["browserSite"]) => {
    state.browserMenu = false;
    state.settings.browserSite = id;
    await persist();
    try {
      await host.call("browserOpen", { site: id });
      state.browserOpen = true;
    } catch (e) {
      toast((e as Error).message, "error");
    }
    render();
  };
  return h(
    "div",
    { class: "browser-menu", role: "menu" },
    BROWSER_SITES.map((x) =>
      h(
        "button",
        { class: state.browserOpen && x.id === current ? "active" : "", type: "button", role: "menuitem", onclick: () => go(x.id) },
        h("strong", {}, x.label),
        h("small", {}, state.browserOpen && x.id === current ? "Open" : new URL(x.url).host),
      ),
    ),
    h(
      "button",
      { type: "button", role: "menuitem", class: "ext", onclick: () => ((state.browserMenu = false), openExternal((BROWSER_SITES.find((x) => x.id === current) ?? BROWSER_SITES[0]).url), render()) },
      icon("share", 14),
      h("span", {}, "Open in my normal browser"),
    ),
    state.browserOpen
      ? h(
          "button",
          {
            type: "button",
            role: "menuitem",
            class: "ext",
            onclick: async () => {
              state.browserMenu = false;
              state.browserOpen = await host.call<boolean>("browserClose", {}).catch(() => false);
              render();
            },
          },
          icon("close", 14),
          h("span", {}, "Close browser"),
        )
      : null,
  );
}

function openSettings(): void {
  state.settingsOpen = true;
  render();
}

// The whole panel is rebuilt on every change, so remember which control had
// keyboard focus (by its position in the tree) and put focus back after.
function focusPath(): number[] | null {
  let el = document.activeElement;
  if (!el || el === document.body || !root.contains(el)) return null;
  const path: number[] = [];
  while (el && el !== root) {
    const parent: Element | null = el.parentElement;
    if (!parent) return null;
    path.unshift(Array.prototype.indexOf.call(parent.children, el));
    el = parent;
  }
  return path;
}

function restoreFocus(path: number[] | null): void {
  if (!path) return;
  let el: Element | undefined = root;
  for (const i of path) el = el?.children[i];
  if (el instanceof HTMLElement || el instanceof SVGElement) el.focus({ preventScroll: true });
}

const SHORTCUTS: [string, string][] = [
  ["R", "Render"],
  ["T", "Try again (keeps the renders on screen)"],
  ["C", "Capture the SketchUp view (Upload in the web app)"],
  ["L", "Open or close the style library"],
  ["M", "Open or close the AI model list"],
  ["1 to 5", "Render, Edit, Lights, Mirror, History tabs"],
  ["Ctrl + Z", "Undo: last paint stroke, then the last edit"],
  ["H or ?", "Open or close this list"],
  ["Esc", "Close the open panel"],
];

function shortcutsSheet(): HTMLElement {
  const close = () => {
    state.keysOpen = false;
    render();
  };
  return h(
    "div",
    { class: "sheet-backdrop", onclick: (e: Event) => e.target === e.currentTarget && close() },
    h(
      "div",
      { class: "sheet", role: "dialog", "aria-modal": "true", "aria-label": "Keyboard shortcuts" },
      h("div", { class: "sheet-head" }, h("h2", {}, "Keyboard shortcuts"), iconButton("close", "Close", close)),
      h("table", { class: "keys" }, SHORTCUTS.map(([k, what]) => h("tr", {}, h("td", {}, h("kbd", {}, k)), h("td", {}, what)))),
      h("p", { class: "hint" }, "Shortcuts are ignored while you type in a box."),
    ),
  );
}

function typingIn(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null;
  return Boolean(t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable));
}

function anySheetOpen(): boolean {
  return Boolean(document.querySelector(".sheet-backdrop, .onboard-backdrop, .tour"));
}

// No browser right-click menu (Back, Reload, Inspect) in the panel; text fields keep theirs for copy and paste.
document.addEventListener("contextmenu", (e) => {
  if (!typingIn(e.target)) e.preventDefault();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" || typingIn(e.target) || e.altKey || !state) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === "z" && state.tab === "edit") {
    e.preventDefault();
    if (painter?.canUndo()) painter.undo();
    else undoEdit();
    return;
  }
  if (mod) return;
  const k = e.key.toLowerCase();
  // The key that opened a window closes it again.
  const toggle = (open: boolean, shut: () => void) => {
    if (!open) return false;
    e.preventDefault();
    shut();
    render();
    return true;
  };
  // "?" still works for people used to it.
  const help = k === "h" || e.key === "?";
  if (toggle(state.keysOpen && help, () => (state.keysOpen = false))) return;
  if (toggle(state.lib.open && k === "l", () => (state.lib.open = false))) return;
  if (toggle(state.modelSheet && k === "m", () => (state.modelSheet = false))) return;
  if (anySheetOpen()) return;
  if (help) {
    e.preventDefault();
    state.keysOpen = true;
    render();
    return;
  }
  const tabs: Tab[] = ["render", "edit", "lights", "mirror", "history"];
  if (/^[1-5]$/.test(k)) {
    state.tab = tabs[Number(k) - 1];
    render();
  } else if (k === "r" && state.tab === "render" && state.capture && !state.busy) runRender();
  else if (k === "t" && state.tab === "render" && state.capture && state.result && !state.busy) runRender(true);
  else if (k === "c" && state.tab === "render" && !state.busy) {
    if (host.kind === "sketchup") doCapture();
    else (document.querySelector(".stage-actions input[type=file]") as HTMLInputElement | null)?.click();
  } else if (k === "l") openLibrary();
  else if (k === "m" && state.settings.backend === "kie") {
    state.modelSheet = true;
    render();
  } else return;
  e.preventDefault();
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (state.browserMenu) state.browserMenu = false;
  else if (state.ctxOpen) state.ctxOpen = false;
  else if (state.analyseOpen) {
    keepAnalysisDraft?.();
    state.analyseOpen = null;
  }
  else if (state.anglesOpen) {
    state.anglesOpen = false;
    state.anglesFrom = null;
  }
  else if (state.dynOpen) state.dynOpen = null;
  else if (state.lookOpen) state.lookOpen = false;
  else if (state.settingsOpen) state.settingsOpen = false;
  else if (state.modelSheet) state.modelSheet = false;
  else if (state.keysOpen) state.keysOpen = false;
  else if (state.lib.open) state.lib.open = false;
  else return;
  e.preventDefault();
  render();
});

/** Page scroll saved while a window is open, so the page behind it cannot move. */
let lockedY: number | null = null;

/** Freezes the page behind an open window. iPhone Safari ignores overflow:hidden, so the body is pinned instead. */
function lockScroll(on: boolean): void {
  const b = document.body.style;
  if (on && lockedY === null) {
    lockedY = window.scrollY;
    Object.assign(b, { position: "fixed", top: `-${lockedY}px`, left: "0", right: "0", width: "100%" });
  } else if (!on && lockedY !== null) {
    const y = lockedY;
    lockedY = null;
    Object.assign(b, { position: "", top: "", left: "", right: "", width: "" });
    window.scrollTo(0, y);
  }
}

// Windows added outside render() (crop, log) pin the page too.
new MutationObserver(() => lockScroll(Boolean(document.querySelector(".sheet-backdrop, .onboard-backdrop")))).observe(document.body, { childList: true, subtree: true });

function render(): void {
  const focused = focusPath();
  // Keep the page height while redrawing, so a tap does not make the page jump.
  const y = lockedY ?? window.scrollY;
  root.style.minHeight = `${root.offsetHeight}px`;
  // A message on screen survives the redraw (an error used to vanish at once).
  const oldBar = document.getElementById("status") as (HTMLElement & { _t?: number }) | null;
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
      h("div", { class: "brand" }, h("strong", {}, "David Render Studio"), h("small", {}, host.kind === "sketchup" ? "for SketchUp" : "web")),
      browserButton(),
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
      { class: "tabs", role: "tablist", "aria-label": "Tools" },
      tabs.map((t) =>
        h(
          "button",
          {
            class: t.id === state.tab ? "tab active" : "tab",
            type: "button",
            role: "tab",
            "aria-selected": t.id === state.tab ? "true" : "false",
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
  const body = h("main", { class: `body tab-${state.tab}` });
  if (state.tab === "render") renderTab(body);
  if (state.tab === "edit") editTab(body);
  if (state.tab === "lights") lightsTab(body);
  if (state.tab === "mirror") mirrorTab(body);
  if (state.tab === "history") historyTab(body);
  root.append(body);
  if (state.tab === "render" && !WIDE.matches) root.append(renderBar());
  root.append(oldBar ?? h("div", { id: "status", class: "toast", role: "status", "aria-live": "polite" }));
  if (state.settingsOpen) root.append(settingsSheet());
  if (!state.settings.onboarded) root.append(onboarding());
  else if (!state.settings.tourDone && state.tab === "render" && !anySheetOpen()) showTour();
  if (state.lookOpen) root.append(lookSheet());
  if (state.ctxOpen) root.append(contextSheet());
  if (state.anglesOpen) root.append(anglesSheet());
  if (state.lib.open) root.append(librarySheet());
  if (state.previewsOpen) root.append(previewsSheet());
  if (state.modelSheet) root.append(modelSheet());
  if (state.keysOpen) root.append(shortcutsSheet());
  if (state.analyseOpen === "dna") root.append(dnaSheet());
  if (state.analyseOpen === "people") root.append(peopleSheet());
  if (state.analyseOpen === "scene") root.append(sceneSheet());
  if (state.dynOpen) {
    const g = findGenerator(state.dynOpen);
    if (g) root.append(dynamicSheet(g));
  }
  root.style.minHeight = "";
  // The header height, for the sticky header and side panel on wide screens.
  const head = (root.querySelector(".topbar") as HTMLElement | null)?.offsetHeight ?? 0;
  document.documentElement.style.setProperty("--topbar-h", `${head}px`);
  lockScroll(Boolean(document.querySelector(".sheet-backdrop, .onboard-backdrop")));
  if (lockedY === null && Math.abs(window.scrollY - y) > 1) window.scrollTo(0, y);
  restoreFocus(focused);
}

// ---------- Render tab ----------

function frameLabel(): string {
  const cap = state.capture;
  if (!cap) return findFrame(state.frameId).label;
  return `${findFrame(state.capturedFrameId || state.frameId).label} · ${cap.view.width ?? "?"} × ${cap.view.height ?? "?"} px`;
}

/** The radiating scan on the stage, for short jobs that do not set busy. */
function stageScan(on: boolean): void {
  const frame = document.querySelector(".stage-frame");
  frame?.querySelector(":scope > .scan.temp")?.remove();
  if (on) frame?.append(h("div", { class: "scan temp" }));
}

async function doCapture(): Promise<void> {
  stageScan(true);
  try {
    toast("Capturing...");
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
    stageScan(false);
    toast((e as Error).message, "error");
  }
}

interface CropChoice {
  rect: [number, number, number, number];
  /** frame id the crop was drawn at, "free" when not locked to a ratio */
  frameId: string;
}

/**
 * Crop popup for an uploaded picture. Resolves with the chosen rectangle in
 * image pixels, or null when the user keeps the whole image.
 */
function cropUpload(img: ImageData64, natural: { width: number; height: number }): Promise<CropChoice | null> {
  return new Promise((resolve) => {
    const W = natural.width;
    const H = natural.height;
    const startFrame = findFrame(state.frameId);
    let frameId = startFrame.ratio ? startFrame.id : "free";
    // Box in image pixels.
    let box = { x: 0, y: 0, w: W, h: H };
    const ratioOf = (id: string) => (id === "free" ? 0 : findFrame(id).ratio);
    const fit = (ratio: number) => {
      if (!ratio) return { x: 0, y: 0, w: W, h: H };
      let w = W;
      let h = w / ratio;
      if (h > H) {
        h = H;
        w = h * ratio;
      }
      return { x: (W - w) / 2, y: (H - h) / 2, w, h };
    };
    box = fit(ratioOf(frameId));

    const frameEl = h("div", { class: "crop-box" },
      ...["nw", "ne", "sw", "se"].map((c) => h("i", { class: `crop-handle ${c}`, "data-corner": c })),
    );
    const imgEl = h("img", { src: toDataUrl(img), alt: "Uploaded image", draggable: "false" });
    const wrap = h("div", { class: "crop-stage" }, imgEl, frameEl);
    const sizeOut = h("small", { class: "muted" });
    const place = () => {
      frameEl.style.left = `${(box.x / W) * 100}%`;
      frameEl.style.top = `${(box.y / H) * 100}%`;
      frameEl.style.width = `${(box.w / W) * 100}%`;
      frameEl.style.height = `${(box.h / H) * 100}%`;
      sizeOut.textContent = `${Math.round(box.w)} × ${Math.round(box.h)} px`;
    };

    let drag: { mode: string; px: number; py: number; start: typeof box } | null = null;
    wrap.addEventListener("pointerdown", (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      const corner = t.dataset.corner;
      if (!corner && !frameEl.contains(t)) return;
      e.preventDefault();
      wrap.setPointerCapture(e.pointerId);
      drag = { mode: corner ?? "move", px: e.clientX, py: e.clientY, start: { ...box } };
    });
    wrap.addEventListener("pointermove", (e: PointerEvent) => {
      if (!drag) return;
      const scale = W / wrap.getBoundingClientRect().width;
      const dx = (e.clientX - drag.px) * scale;
      const dy = (e.clientY - drag.py) * scale;
      const b = { ...drag.start };
      const ratio = ratioOf(frameId);
      const min = Math.min(W, H) * 0.08;
      if (drag.mode === "move") {
        b.x = Math.min(Math.max(0, b.x + dx), W - b.w);
        b.y = Math.min(Math.max(0, b.y + dy), H - b.h);
      } else {
        const left = drag.mode.includes("w");
        const top = drag.mode.includes("n");
        // Fixed corner stays put; the dragged one follows the pointer.
        const fx = left ? b.x + b.w : b.x;
        const fy = top ? b.y + b.h : b.y;
        let w = Math.max(min, left ? b.w - dx : b.w + dx);
        let hh = Math.max(min, top ? b.h - dy : b.h + dy);
        w = Math.min(w, left ? fx : W - fx);
        hh = Math.min(hh, top ? fy : H - fy);
        if (ratio) {
          if (w / hh > ratio) w = hh * ratio;
          else hh = w / ratio;
        }
        b.w = w;
        b.h = hh;
        b.x = left ? fx - w : fx;
        b.y = top ? fy - hh : fy;
      }
      box = b;
      place();
    });
    const end = () => (drag = null);
    wrap.addEventListener("pointerup", end);
    wrap.addEventListener("pointercancel", end);

    const chips = h("div", { class: "chips" });
    const drawChips = () => {
      clear(chips);
      const opts = [{ id: "free", label: "Free" }, ...FRAMES.filter((f) => f.ratio).map((f) => ({ id: f.id, label: f.label }))];
      for (const o of opts) {
        chips.append(chip(o.label, o.id === frameId, () => {
          frameId = o.id;
          box = fit(ratioOf(frameId));
          place();
          drawChips();
        }));
      }
    };
    drawChips();

    const done = (choice: CropChoice | null) => {
      backdrop.remove();
      document.removeEventListener("keydown", onKey);
      resolve(choice);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && done(null);
    document.addEventListener("keydown", onKey);
    const sheet = h(
      "div",
      { class: "sheet wide crop-sheet", role: "dialog", "aria-modal": "true", "aria-label": "Crop image" },
      h("div", { class: "sheet-head" }, h("h2", {}, "Crop image"), iconButton("close", "Use whole image", () => done(null))),
      h("p", { class: "hint" }, "Drag the box to move it, drag a corner to resize. The render comes out at this shape."),
      chips,
      wrap,
      h(
        "div",
        { class: "sheet-actions" },
        sizeOut,
        button("Use whole image", "close", async () => done(null), "ghost"),
        primaryButton("Crop", "check", async () => done({ rect: [box.x, box.y, box.w, box.h], frameId }), false),
      ),
    );
    const backdrop = h("div", { class: "sheet-backdrop crop-backdrop" }, sheet);
    root.append(backdrop);
    place();
  });
}

async function useUpload(file: File, target: "render" | "edit"): Promise<void> {
  let img = await fileToImage(file);
  const natural = await imageSize(img);
  const choice = await cropUpload(img, natural);
  if (choice) {
    img = await cropImage(img, choice.rect);
    if (target === "render") state.frameId = choice.frameId;
  }
  if (target === "edit") {
    state.editStack = [];
    state.editSource = img;
    painter = null;
    render();
    return;
  }
  state.original = img;
  const view = choice ? img : await cropToRatio(img, findFrame(state.frameId).ratio);
  state.capture = { view, source: "upload" };
  state.capturedFrameId = state.frameId;
  state.result = null;
  // A different picture: its material tags and people no longer apply.
  if (state.dna.length || state.people) toast("New image: Material Scan and people were cleared.");
  state.dna = [];
  state.people = "";
  state.dnaDraft = null;
  state.peopleDraft = null;
  state.sceneLast = null;
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

/** Width over height of what the stage shows. */
function stageRatio(cap: State["capture"]): number {
  const v = cap?.view;
  if (v?.width && v.height) return v.width / v.height;
  return findFrame(state.frameId).ratio || 16 / 9;
}

function stage(): HTMLElement {
  const cap = state.capture;
  const input = uploadInput("render");
  const actions = h(
    "div",
    { class: "stage-actions" },
    host.kind === "sketchup" ? primaryButton(t(cap ? "Recapture" : "Capture view"), "capture", doCapture, state.busy) : null,
    button(t("Upload"), "upload", () => input.click(), host.kind === "sketchup" ? "ghost" : "primary", state.busy),
    cap ? button("Add to queue", "plus", addToQueue, "ghost") : null,
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
      // Tall pictures get narrower instead of taller, so the buttons stay on screen.
      { class: freshResult && state.result ? "stage-frame fresh" : "stage-frame", style: `max-width:calc(60vh * ${stageRatio(cap).toFixed(3)})` },
      content,
      cap ? h("span", { class: "badge" }, frameLabel()) : null,
      state.result ? h("span", { class: "badge right" }, "Drag to compare") : null,
      state.busy ? h("div", { class: "scan" }) : null,
    ),
    stale ? h("div", { class: "notice" }, icon("info", 16), "The frame changed. Recapture to use it.", button("Recapture", "capture", doCapture, "small")) : null,
    state.result && state.results.length > 1 && state.results.includes(state.result)
      ? h(
          "div",
          { class: "result-strip", role: "listbox", "aria-label": "Renders" },
          state.results.map((img, i) =>
            h(
              "button",
              {
                class: img === state.result ? "result-thumb active" : "result-thumb",
                type: "button",
                role: "option",
                "aria-selected": String(img === state.result),
                title: `Render ${i + 1}`,
                onclick: () => {
                  state.result = img;
                  render();
                },
              },
              h("img", { src: toDataUrl(img), alt: `Render ${i + 1}` }),
            ),
          ),
        )
      : null,
    state.result ? resultActions(state.result, "render") : actions,
  );
}

async function chooseFrame(id: string): Promise<void> {
  state.frameId = id;
  state.settings.frameId = id;
  const picked = findFrame(id).ratio;
  if (picked && picked !== 1) state.framePortrait = picked < 1;
  persist();
  syncFrame();
  const f = findFrame(id);
  if (state.original && state.capture?.source === "upload") {
    state.capture = { ...state.capture, view: await cropToRatio(state.original, f.ratio) };
    state.capturedFrameId = id;
    state.result = null;
  }
  render();
}

function ratioShape(ratio: number): HTMLElement {
  const r = ratio || 1.5;
  const w = r >= 1 ? 22 : Math.round(22 * r);
  const hh = r >= 1 ? Math.round(22 / r) : 22;
  return h("span", { class: ratio ? "ratio-shape" : "ratio-shape free", style: `width:${w}px;height:${Math.max(6, hh)}px` });
}

/** True when the frame row shows portrait ratios (9:16, 4:5, 3:4). */
function framePortrait(): boolean {
  return state.framePortrait ?? findFrame(state.frameId).ratio < 1;
}

/** One row of frames above the picture. Swap flips the row between landscape and portrait. */
function frameBar(): HTMLElement {
  const current = findFrame(state.frameId);
  const portrait = framePortrait();
  const ids = FRAME_ROW.map((id) => (portrait ? swapFrameId(id) : id));
  const custom = !ids.includes(state.frameId) && !FRAME_ROW.includes(swapFrameId(state.frameId));
  const cell = (id: string, label: string, shape: HTMLElement, active: boolean, title: string, onclick: () => void) =>
    h(
      "button",
      { class: active ? "frame active" : "frame", type: "button", title, "aria-pressed": String(active), onclick },
      h("span", { class: "frame-box" }, shape),
      h("span", {}, label),
    );
  const row = h(
    "div",
    { class: "frame-bar", role: "group", "aria-label": t("Frame") },
    ids.map((id) => {
      const f = findFrame(id);
      return cell(id, f.label, ratioShape(f.ratio), id === state.frameId, f.hint, () => chooseFrame(id));
    }),
    cell("custom", custom ? current.label : "Custom", custom ? ratioShape(current.ratio) : icon("plus", 14), custom || state.frameEditor, "Your own ratio or pixel size", () => {
      state.frameEditor = !state.frameEditor;
      render();
    }),
    h(
      "button",
      {
        class: portrait ? "icon-btn small ghost frame-swap on" : "icon-btn small ghost frame-swap",
        type: "button",
        title: portrait ? "Show landscape frames" : "Show portrait frames",
        "aria-label": "Swap portrait and landscape",
        "aria-pressed": String(portrait),
        onclick: () => {
          const next = !portrait;
          state.framePortrait = next;
          // A ratio already picked flips with the row; View, square and custom stay.
          const flipped = swapFrameId(state.frameId);
          if (!custom && flipped !== state.frameId) chooseFrame(flipped);
          else render();
        },
      },
      icon("swap", 16),
    ),
    host.kind === "sketchup"
      ? h(
          "button",
          {
            class: state.showFrame ? "icon-btn small ghost on" : "icon-btn small ghost",
            type: "button",
            title: state.showFrame ? "Hide the frame in SketchUp" : "Show the frame in SketchUp",
            "aria-pressed": String(state.showFrame),
            onclick: () => {
              state.showFrame = !state.showFrame;
              syncFrame();
              render();
            },
          },
          icon("eye", 16),
        )
      : null,
  );
  return h("div", { class: "frame-wrap" }, row, state.frameEditor || custom ? frameEditor() : null);
}

function frameEditor(): HTMLElement {
  const cur = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(isListed(state.frameId) ? "" : state.frameId);
  const rw = h("input", { type: "number", min: 1, step: 1, value: cur ? cur[1] : "", placeholder: "W", class: "num", "aria-label": "Ratio width" }) as HTMLInputElement;
  const rh = h("input", { type: "number", min: 1, step: 1, value: cur ? cur[2] : "", placeholder: "H", class: "num", "aria-label": "Ratio height" }) as HTMLInputElement;
  const pw = h("input", { type: "number", min: 1, step: 1, placeholder: "2500", class: "num wide", "aria-label": "Width in pixels" }) as HTMLInputElement;
  const ph = h("input", { type: "number", min: 1, step: 1, placeholder: "2000", class: "num wide", "aria-label": "Height in pixels" }) as HTMLInputElement;
  const result = h("div", { class: "conv-result" }, h("span", { class: "hint" }, "Type a pixel size to get its ratio."));
  let found: { id: string; long: number } | null = null;
  const useBtn = button("Use", "check", () => {
    if (!found) return;
    if (host.kind === "sketchup") state.settings.captureSize = found.long;
    chooseFrame(found.id);
    toast(host.kind === "sketchup" ? `Frame set to ${found.id}, captures at ${found.long} px on the long side.` : `Frame set to ${found.id}.`, "ok");
  }, "primary small", true);
  const convert = () => {
    const r = ratioFromPixels(Number(pw.value), Number(ph.value));
    clear(result);
    found = null;
    (useBtn as HTMLButtonElement).disabled = true;
    if (!r) {
      result.append(h("span", { class: "hint" }, "Type a pixel size to get its ratio."));
      return;
    }
    const id = r.simple;
    const near = nearestAspectRatio(Number(pw.value), Number(ph.value));
    found = { id: FRAMES.some((f) => f.id === id) ? id : id, long: Math.max(Number(pw.value), Number(ph.value)) };
    (useBtn as HTMLButtonElement).disabled = false;
    result.append(
      h("strong", {}, r.exact === r.simple ? r.exact : `${r.simple} (exactly ${r.exact})`),
      h("span", { class: "hint" }, r.simple === near ? "A native AI ratio." : `AI renders at ${near}, then it is trimmed to ${r.simple}.`),
    );
  };
  pw.addEventListener("input", convert);
  ph.addEventListener("input", convert);
  const apply = () => {
    const a = Number(rw.value);
    const b = Number(rh.value);
    if (!(a > 0 && b > 0)) return toast("Type both sides of the ratio, e.g. 7 and 3.", "error");
    chooseFrame(`${a}:${b}`);
  };
  rh.addEventListener("keydown", (e) => e.key === "Enter" && apply());
  return h(
    "div",
    { class: "frame-editor" },
    h("div", { class: "fe-row" }, h("span", { class: "fe-label" }, "Ratio"), rw, h("span", { class: "colon" }, ":"), rh, button("Set", null, apply, "ghost small")),
    h("div", { class: "fe-row" }, h("span", { class: "fe-label" }, "Pixels"), pw, h("span", { class: "colon" }, "×"), ph, useBtn),
    result,
  );
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

// Quick render offers four starter looks per scene type. They are the
// built-in presets with the plainest, most reliable wording; David's own
// test renders should decide the final four.
const QUICK_LOOKS: Record<ProjectType, string[]> = {
  exterior: ["shophouse-row-day", "twin-villa-golden", "borey-villa-dusk", "link-house-overcast"],
  interior: ["living-room-warm", "kitchen-white-oak", "bedroom-soft", "condo-lobby-evening"],
  aerial: ["borey-masterplan", "masterplan-aerial", "mixed-use-district", "township-blue-hour"],
  sketch: ["sketch-to-photo", "massing-to-photo", "sketch-interior", "elevation-to-photo"],
};

function quickLooks(type: ProjectType): Preset[] {
  const find = (id: string): Preset | undefined => allPresets().find((x) => x.id === id) ?? findLibraryItem(id);
  // Starred styles come first, then the four starters, six at most.
  const ids = [...state.settings.favorites, ...QUICK_LOOKS[type]];
  const out: Preset[] = [];
  for (const id of ids) {
    const p = find(id);
    if (p && p.projectType === type && !out.some((x) => x.id === p.id)) out.push(p);
  }
  return out.slice(0, 6);
}

function isFavorite(id: string): boolean {
  return state.settings.favorites.includes(id);
}

async function toggleFavorite(id: string, name: string): Promise<void> {
  const fav = isFavorite(id);
  state.settings.favorites = fav ? state.settings.favorites.filter((x) => x !== id) : [id, ...state.settings.favorites];
  await persist();
  render();
  toast(fav ? `${name} removed from favourites` : `${name} starred. It shows first in Quick`, "ok");
}

function starButton(id: string, name: string): HTMLElement {
  const on = isFavorite(id);
  return h(
    "button",
    {
      class: `star-btn${on ? " on" : ""}`,
      type: "button",
      "aria-pressed": on ? "true" : "false",
      "aria-label": on ? `Remove ${name} from favourites` : `Star ${name}`,
      title: on ? "Starred: shows first in Quick" : "Star: show first in Quick",
      onclick: (e: Event) => {
        e.stopPropagation();
        toggleFavorite(id, name);
      },
    },
    icon("star", 16),
  );
}

/**
 * Saves the current look for every later view of the project. With a render,
 * that render becomes the reference so the next views match it.
 */
async function lockLook(fromRender?: ImageData64): Promise<void> {
  const lock: StyleLock = {
    preset: { ...state.preset },
    look: state.settings.styleLock?.look ?? state.settings.look,
    dna: activeDna(),
    reference: fromRender ? await shrinkJpeg(fromRender, 768, 0.85) : state.reference ? await shrinkJpeg(state.reference, 768, 0.85) : null,
    referenceIsRender: Boolean(fromRender),
    savedAt: new Date().toISOString(),
  };
  state.settings.styleLock = lock;
  await persist();
  toast("Look locked", "ok");
  render();
}

async function unlockLook(): Promise<void> {
  state.settings.styleLock = null;
  await persist();
  render();
}

function lockBanner(): HTMLElement {
  const lock = state.settings.styleLock;
  if (!lock) {
    return h(
      "div",
      { class: "lock-bar" },
      icon("unlock", 16),
      h("span", { class: "grow" }, h("strong", {}, "Project look"), h("small", {}, "Lock it so every view gets the same materials and sky.")),
      button("Lock", "lock", () => lockLook(), "ghost small", !state.capture),
    );
  }
  return h(
    "div",
    { class: "lock-bar on" },
    lock.reference ? h("img", { class: "ref-thumb", src: toDataUrl(lock.reference), alt: "Locked reference" }) : icon("lock", 16),
    h(
      "span",
      { class: "grow" },
      h("strong", {}, `Locked: ${lock.preset.name}`),
      h(
        "small",
        {},
        [lock.look === "cgi" ? "3D render" : "Photo", lock.dna.length ? `${lock.dna.length} materials` : "", lock.referenceIsRender ? "matches a saved render" : lock.reference ? "with reference" : ""].filter(Boolean).join(" · "),
      ),
    ),
    button("Unlock", "unlock", unlockLook, "ghost small"),
  );
}

function modeSwitch(): HTMLElement {
  return h(
    "div",
    { class: "mode-row" },
    segmented(
      [
        { id: "quick", label: "Quick" },
        { id: "all", label: "All controls" },
      ],
      state.settings.simple ? "quick" : "all",
      async (v) => {
        state.settings.simple = v === "quick";
        await persist();
        render();
      },
    ),
  );
}

function sceneTypeControl(): HTMLElement {
  const typeIcons: Record<ProjectType, string> = { exterior: "exterior", interior: "interior", aerial: "aerial", sketch: "sketch" };
  return segmented(
    (Object.keys(PROJECT_TYPES) as ProjectType[]).map((id) => ({ id, label: t(id === "sketch" ? "Sketch" : PROJECT_TYPES[id].label.replace(" / masterplan", "")), icon: typeIcons[id] })),
    state.preset.projectType,
    async (v) => {
      if (v === state.preset.projectType) return;
      rememberSetup();
      const saved = state.settings.lastSetup[v];
      if (saved && !state.settings.styleLock) {
        state.preset = { ...saved.preset };
        if (saved.kieModel) state.settings.kieModel = saved.kieModel;
        if (saved.frameId) state.frameId = saved.frameId;
      } else if (state.settings.simple) state.preset = { ...(quickLooks(v)[0] ?? state.preset), projectType: v };
      else state.preset.projectType = v;
      await persist();
      render();
    },
  );
}

/** Keeps the current style, model and frame for this scene type. */
function rememberSetup(): void {
  const p = state.preset;
  state.settings.lastSetup = { ...state.settings.lastSetup, [p.projectType]: { preset: { ...p }, kieModel: state.settings.kieModel, frameId: state.frameId } };
}

function presetCard(x: Preset): HTMLElement {
  return h(
    "button",
    {
      class: x.id === state.preset.id ? "preset active" : "preset",
      type: "button",
      "aria-pressed": String(x.id === state.preset.id),
      onclick: () => {
        state.preset = { ...x };
        render();
      },
    },
    x.id === "none" ? h("span", { class: "swatches none" }, icon("close", 14)) : h("span", { class: "swatches" }, presetSwatches(x).map((c) => h("i", { style: `background:${c}` }))),
    h("strong", {}, x.name),
    x.builtIn ? null : h("small", {}, "Your preset"),
  );
}

function quickTab(body: HTMLElement): void {
  const lock = state.settings.styleLock;
  body.append(modeSwitch());
  body.append(lockBanner());
  if (!lock) {
    body.append(
      section(
        t("Scene"),
        sceneTypeControl(),
        h(
          "div",
          { class: "preset-grid" },
          presetCard(nonePreset(state.preset.projectType)),
          // A style picked elsewhere (Browse all, Smart Detect) sits in the grid like the others.
          state.preset.id === "none" || quickLooks(state.preset.projectType).some((x) => x.id === state.preset.id) ? null : h("div", { class: "lib-cell" }, presetCard(state.preset)),
          quickLooks(state.preset.projectType).map((x) => h("div", { class: "lib-cell" }, presetCard(x), starButton(x.id, x.name))),
        ),
        h("div", { class: "row" },
          button("Smart Detect", "wand", () => openSceneScan(), "ghost grow"),
          button("Browse all", "search", () => openLibrary(), "ghost grow"),
        ),
      ),
    );
  }
  body.append(
    section(
      t("Notes for this view"),
      textarea(state.notes, "e.g. add a parked Honda Dream by the gate", 2, (v) => {
        state.notes = v;
      }),
      h("p", { class: "hint" }, "Lighting, people, cars, material lists and the prompt itself are under All controls. In Quick they are not sent."),
    ),
  );
}

function modelSummaryText(): string {
  const m = findKieModel(state.settings.kieModel);
  if (state.settings.backend === "browser") return `${BROWSER_SITES.find((x) => x.id === state.settings.browserSite)?.label ?? "Browser"} (fallback)`;
  if (state.settings.backend !== "kie") return state.settings.backend === "gemini" ? "Gemini API key" : "ComfyUI";
  return state.settings.kieKey
    ? `${m.label} · ${resolutionFor(m, state.settings.kieResolution)}${state.settings.imageCount > 1 ? ` · ×${state.settings.imageCount}` : ""}`
    : "Add a Kie.ai key";
}

// ---------- Template library ----------

function openLibrary(): void {
  state.lib = { open: true, type: "home", style: "all", subject: "all", query: "" };
  render();
}

function lightSwatch(id: string): [string, string] {
  if (id.startsWith("time:")) {
    const hour = Number(id.slice(5, 7));
    return hour >= 18 ? ["#1d2748", "#d08a4a"] : hour >= 16 ? ["#58608c", "#f0a050"] : ["#4d8fd6", "#cfe3f2"];
  }
  const o = [...LIGHTING, ...INTERIOR_RELIGHT, ...URBAN_RELIGHT].find((x) => x.id === id);
  return o?.swatch ?? ["#6d7a88", "#c9cfd4"];
}

/** Your own render for a preset: a thumbs-up one first, else the latest. */
function ownThumb(id: string): ImageData64 | null {
  const mine = state.history.filter((x) => x.presetId === id && x.tool === "render" && x.rating !== -1);
  return (mine.find((x) => x.rating === 1) ?? mine[0])?.after ?? null;
}

/** The card base subject each preview sheet was drawn on. */
const SAMPLE_SUBJECT: Partial<Record<ProjectType, string>> = { exterior: "villa", interior: "living", aerial: "borey" };

/** The picture on a library card: your own render, then its own preview file, then a style sample, then a colour board. */
function libArt(x: LibItem): { art: HTMLElement; badge: string | null } {
  const thumb = ownThumb(x.id);
  // A picture made for this exact card beats a style sample shared by all.
  const file = thumb ? null : previewFile(x.id);
  const key = thumb ? null : previewKey(x.projectType, x.styleId);
  const sample = key ? state.previews.get(key) : undefined;
  const [sky, glow] = lightSwatch(x.lighting);
  const blocks = x.colors.length ? x.colors : presetSwatches(x);
  const board = () =>
    h(
      "span",
      { class: "lib-board", style: `background:linear-gradient(180deg, ${sky}, ${glow})` },
      h("span", { class: "lib-blocks" }, blocks.slice(0, 3).map((c) => h("i", { style: `background:${c}` }))),
    );
  const badge = thumb ? "Your render" : !file && sample && x.subjectId !== SAMPLE_SUBJECT[x.projectType] ? "Style sample" : null;
  const art = thumb
    ? h("img", { src: toDataUrl(thumb), alt: "", loading: "lazy" })
    : file
    ? h("img", {
        src: file,
        alt: "",
        loading: "lazy",
        // Offline in SketchUp with a missing file: fall back quietly.
        onerror: (e: Event) => {
          const img = e.currentTarget as HTMLImageElement;
          if (sample && img.src !== sample) img.src = sample;
          else img.replaceWith(board());
        },
      })
    : sample
    ? h("img", { src: sample, alt: "", loading: "lazy" })
    : board();
  return { art, badge };
}

function libCard(x: LibItem, current = false, label?: string): HTMLElement {
  const { art, badge } = libArt(x);
  const active = x.id === state.preset.id;
  const card = h(
    "button",
    {
      class: `lib-card${active ? " active" : ""}${current ? " current" : ""}`,
      type: "button",
      "aria-pressed": String(active),
      title: x.style,
      onclick: () => {
        if (current) return openLibrary();
        state.preset = { id: x.id, name: x.name, projectType: x.projectType, lighting: x.lighting, environment: x.environment, style: x.style, builtIn: x.builtIn };
        state.lib.open = false;
        render();
        toast(x.name, "ok");
      },
    },
    h("span", { class: "lib-art" }, art, badge ? h("em", { class: "lib-badge" }, badge) : null, active ? h("span", { class: "lib-check" }, icon("check", 14)) : null),
    h("strong", {}, label ?? x.name),
  );
  return current ? card : h("div", { class: "lib-cell" }, card, starButton(x.id, x.name));
}

/** A big picture card that opens the next level of the library. */
function libFolder(label: string, art: HTMLElement, active: boolean, onclick: () => void, sub = ""): HTMLElement {
  return h(
    "button",
    { class: `lib-card lib-folder${active ? " active" : ""}`, type: "button", "aria-pressed": String(active), title: label, onclick },
    h("span", { class: "lib-art" }, art, active ? h("span", { class: "lib-check" }, icon("check", 14)) : null),
    h("strong", {}, label, sub ? h("small", {}, sub) : null),
  );
}

/** Picture for a category, room or building card: one of its styles, rotated so cards differ. */
function folderArt(type: ProjectType, subject: string | null, n = 0): HTMLElement {
  const items = libraryItems().filter((x) => x.projectType === type && (subject ? x.subjectId === subject : x.styleId !== "featured"));
  const own = items.find((x) => ownThumb(x.id));
  const pick = own ?? items[n % Math.max(items.length, 1)];
  return pick ? libArt(pick).art : h("span", { class: "lib-board" });
}

function iconArt(name: string): HTMLElement {
  return h("span", { class: "lib-icon-art" }, icon(name, 34));
}

/** "Mine": starred styles first, then presets you saved yourself. */
function customItems(q = ""): LibItem[] {
  const words = searchWords(q);
  const starred = state.settings.favorites.map((id) => findLibraryItem(id) ?? allPresets().find((x) => x.id === id)).filter((x): x is Preset => Boolean(x));
  return [...starred, ...state.settings.userPresets.filter((x) => !starred.some((y) => y.id === x.id))]
    .filter((x) => !words.length || matchesWords(`${x.name} ${x.style}`, words))
    .map((x) => ({ ...x, styleId: "mine", subjectId: "mine", colors: (x as Partial<LibItem>).colors ?? [] }));
}

const LIB_CATEGORIES: { id: ProjectType; label: string }[] = [
  { id: "exterior", label: "Exterior" },
  { id: "interior", label: "Interior" },
  { id: "aerial", label: "Aerial" },
  { id: "sketch", label: "Sketch" },
];

function styleName(x: LibItem): string {
  const styles: { id: string; label: string }[] = x.projectType === "exterior" ? EXT_STYLES : x.projectType === "interior" ? INT_STYLES : x.projectType === "aerial" ? AERIAL_LOOKS : [];
  return styles.find((s) => s.id === x.styleId)?.label ?? x.name;
}

function subjectsOf(type: ProjectType): { id: string; label: string; group?: string }[] {
  return type === "exterior" ? EXT_TYPES : type === "interior" ? ROOMS : type === "aerial" ? AERIAL_TYPES : [];
}

function librarySheet(): HTMLElement {
  const L = state.lib;
  const close = () => {
    state.lib.open = false;
    render();
  };
  const go = (type: LibLevel, subject = "all") => {
    state.lib = { ...L, type, subject, query: "" };
    render();
  };
  const body = h("div", { class: "lib-body" });
  const count = h("span", { class: "lib-count" });
  const p = state.preset;
  const pItem = findLibraryItem(p.id);
  const isCustom = state.settings.userPresets.some((x) => x.id === p.id);

  const divided = (groups: { label: string; cards: HTMLElement[] }[]): HTMLElement[] =>
    groups.flatMap((g) => (g.cards.length ? [h("div", { class: "lib-divider", role: "heading", "aria-level": "3" }, h("span", {}, g.label)), h("div", { class: "lib-grid big" }, g.cards)] : []));

  const grid = (cards: HTMLElement[], empty: string, cls = "lib-grid big"): HTMLElement[] =>
    cards.length ? [h("div", { class: cls }, cards)] : [h("p", { class: "hint lib-empty" }, empty)];

  let title = "Template library";
  let back: (() => void) | null = null;

  const draw = () => {
    const q = L.query.trim();
    if (q) {
      // Search runs across every category, flat.
      const list = [...filterLibrary("exterior", "all", "all", q), ...customItems(q).filter((x) => !findLibraryItem(x.id))];
      count.textContent = `${list.length} ${list.length === 1 ? "match" : "matches"}`;
      body.replaceChildren(...grid(list.slice(0, 240).map((x) => libCard(x)), "Nothing matches. Try a room, a building or a style, e.g. kitchen, villa, Khmer."));
      return;
    }
    if (L.type === "home") {
      const total = libraryItems().length;
      count.textContent = `${total} professional styles`;
      body.replaceChildren(
        h(
          "div",
          { class: "lib-grid big home" },
          libFolder("None", iconArt("close"), p.id === "none", () => {
            state.preset = nonePreset(p.projectType);
            state.lib.open = false;
            void persist();
            render();
            toast("No preset", "ok");
          }, "Your own words"),
          LIB_CATEGORIES.map((c, i) =>
            libFolder(c.label, c.id === "sketch" ? folderArt("sketch", "sketch") : folderArt(c.id, null, i * 5), p.id !== "none" && !isCustom && p.projectType === c.id, () => go(c.id), `${libraryItems().filter((x) => x.projectType === c.id).length} styles`),
          ),
          libFolder("Custom", iconArt("star"), isCustom, () => go("mine"), `${customItems().length} saved`),
        ),
      );
      return;
    }
    back = () => go("home");
    if (L.type === "mine") {
      title = "Custom";
      const list = customItems();
      count.textContent = `${list.length} saved`;
      body.replaceChildren(...grid(list.map((x) => libCard(x)), "Nothing here yet. Tap the star on any style, or save your own preset with + under Style preset, and it shows here."));
      return;
    }
    const type = L.type;
    const cat = LIB_CATEGORIES.find((c) => c.id === type)?.label ?? "";
    if (type === "sketch" || L.subject !== "all") {
      const subjects = subjectsOf(type);
      const name = subjects.find((s) => s.id === L.subject)?.label ?? "";
      title = type === "sketch" ? cat : `${cat} · ${name}`;
      if (type !== "sketch") back = () => go(type);
      const list = type === "sketch" ? filterLibrary("sketch", "all", "all") : filterLibrary(type, "all", L.subject);
      count.textContent = `${list.length} ${list.length === 1 ? "style" : "styles"}`;
      // Inside a room or building the room is already named, so cards say only the style.
      body.replaceChildren(...grid(list.map((x) => libCard(x, false, type === "sketch" ? undefined : styleName(x))), "Nothing here yet."));
      return;
    }
    // A category: its rooms, buildings or developments as big pictures.
    title = cat;
    const subjects = subjectsOf(type);
    const activeSubject = pItem && pItem.projectType === type ? pItem.subjectId : null;
    const card = (s: { id: string; label: string }, i: number) =>
      libFolder(s.label, folderArt(type, s.id, i), activeSubject === s.id, () => go(type, s.id));
    const featured = { label: "Featured", cards: filterLibrary(type, "featured", "featured").map((x) => libCard(x)) };
    count.textContent = `${subjects.length} ${type === "interior" ? "rooms" : type === "aerial" ? "developments" : "building types"}`;
    const groups = ["Residential", "Hospitality", "Work and Public"].filter((g) => subjects.some((s) => s.group === g));
    body.replaceChildren(
      ...(groups.length
        ? divided([...groups.map((g) => ({ label: g, cards: subjects.filter((s) => s.group === g).map((s) => card(s, subjects.indexOf(s))) })), featured])
        : [...grid(subjects.map(card), "", "lib-grid big"), ...divided([featured])]),
    );
  };

  const search = h("input", { type: "search", class: "lib-search", placeholder: "Search, e.g. kitchen, shophouse, Khmer", value: L.query, "aria-label": "Search templates" }) as HTMLInputElement;
  search.addEventListener("input", () => {
    L.query = search.value;
    draw();
  });
  draw();
  const head = h(
    "div",
    { class: "sheet-head lib-head" },
    back ? iconButton("chevron", "Back", back, "lib-back") : null,
    h("div", { class: "grow" }, h("h2", {}, title), count),
    iconButton("close", "Close", close),
  );
  return h(
    "div",
    { class: "sheet-backdrop", onclick: (e: Event) => e.target === e.currentTarget && close() },
    h(
      "div",
      { class: "sheet lib-sheet", role: "dialog", "aria-modal": "true", "aria-label": "Template library" },
      head,
      h("label", { class: "lib-search-wrap" }, icon("search", 16), search),
      body,
      h("div", { class: "lib-foot" }, h("span", { class: "hint" }, L.type === "home" ? "Pick a category, then a room or building, then a style." : "Tap a style to use it. The star keeps it in Custom."), button("Close", null, close, "ghost")),
    ),
  );
}

// ---------- Style previews ----------

/** Credits for one sheet, from the model list so it follows price changes. */
function sheetCredits(): number {
  return creditsFor(findKieModel(SHEET_MODEL), SHEET_RESOLUTION) ?? 6;
}

/** Credits for redoing one tile as its own 1K render. */
function tileCredits(): number {
  return creditsFor(findKieModel(SHEET_MODEL), "1K") ?? 4;
}

/** Redoes one style as a single 1K render, following a good tile from the same sheet. */
async function redoTile(def: SheetDef, i: number): Promise<void> {
  const rec = state.sheets[def.id];
  const key = state.settings.kieKey.trim();
  if (!rec) return;
  if (!key) throw new Error("Style previews run on your Kie.ai key. Add it in Settings first.");
  if (sheetJob) throw new Error("A preview is already being made. Wait for it to finish.");
  sheetJob = new AbortController();
  try {
    // Prefer the first tile, which sets the room for the whole sheet.
    const ref = rec.tiles.findIndex((x, n) => n !== i && x && !rec.hidden.includes(n));
    const images = ref >= 0 ? [tileImage(rec.tiles[ref])] : [];
    const p = new KieProvider(key, SHEET_MODEL, "1K", host.kind === "sketchup" ? hostTransport(host) : fetchTransport);
    toast(`Redoing ${def.tiles[i].label}...`);
    const res = await p.render({ prompt: tilePrompt(def, i, images.length > 0), images, aspectRatio: "4:3" }, sheetJob.signal);
    rec.tiles[i] = await tileFromImage(res.image);
    rec.hidden = rec.hidden.filter((n) => n !== i);
    rec.redone = [...new Set([...(rec.redone ?? []), i])];
    rec.credits = (rec.credits ?? 0) + tileCredits();
    await saveSheet(rec);
    state.previews = previewMap(state.sheets);
    toast(`${def.tiles[i].label} redone.`, "ok");
  } finally {
    sheetJob = null;
    refreshCredits();
  }
}

function previewsRow(): HTMLElement {
  const made = SHEETS.filter((d) => state.sheets[d.id]).length;
  const total = SHEETS.reduce((n, d) => n + d.tiles.length, 0);
  return h(
    "div",
    { class: "pv-row" },
    icon("wand", 16),
    h(
      "span",
      { class: "grow" },
      made
        ? `Style previews: ${made} of ${SHEETS.length} sheets made on this computer.`
        : Object.keys(PREVIEW_PACK).length
        ? `Card pictures come with the app. Make your own set of ${total} on your key for about ${sheetCredits() * SHEETS.length} credits.`
        : `Real pictures on the cards: ${total} styles in ${SHEETS.length} images, about ${sheetCredits() * SHEETS.length} credits.`,
    ),
    button(made ? "Manage" : Object.keys(PREVIEW_PACK).length ? "Make my own" : "Make style previews", null, () => {
      state.previewsOpen = true;
      render();
    }, "ghost small"),
  );
}

let sheetJob: AbortController | null = null;

/** Asks Kie for one contact sheet, cuts it and keeps the tiles. */
async function makeSheet(def: SheetDef): Promise<void> {
  const key = state.settings.kieKey.trim();
  if (!key) throw new Error("Style previews run on your Kie.ai key. Add it in Settings first.");
  if (sheetJob) throw new Error("A preview sheet is already being made. Wait for it to finish.");
  sheetJob = new AbortController();
  try {
    const p = new KieProvider(key, SHEET_MODEL, SHEET_RESOLUTION, host.kind === "sketchup" ? hostTransport(host) : fetchTransport);
    toast(`Making ${def.label.toLowerCase()} sheet...`);
    const res = await p.render({ prompt: sheetPrompt(def), images: [], aspectRatio: def.ratio }, sheetJob.signal);
    const cut = await cutSheet(res.image, def);
    const rec: SheetRecord = { id: def.id, createdAt: Date.now(), sheet: res.image, tiles: cut.tiles, hidden: [], issues: cut.check.issues, credits: sheetCredits() };
    await saveSheet(rec);
    state.sheets = { ...state.sheets, [def.id]: rec };
    state.previews = previewMap(state.sheets);
    toast(cut.check.ok ? `${def.label}: ${cut.tiles.length} previews ready.` : `${def.label}: made, but check the tiles.`, cut.check.ok ? "ok" : "info", cut.check.issues.join(" "));
  } finally {
    sheetJob = null;
    refreshCredits();
  }
}

function exportPreviews(): void {
  const json = exportJson(state.sheets);
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const a = h("a", { href: url, download: "style-previews.json" });
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
  toast("Saved style-previews.json. Send it to David's Telegram to add these to the app for everyone.", "ok");
}

function previewsSheet(): HTMLElement {
  const close = () => {
    state.previewsOpen = false;
    render();
  };
  const per = sheetCredits();
  const missing = SHEETS.filter((d) => !state.sheets[d.id]);
  const keyless = !state.settings.kieKey.trim();
  const sheetBlock = (def: SheetDef): HTMLElement => {
    const rec = state.sheets[def.id];
    const tiles = h(
      "div",
      { class: "pv-tiles", style: `grid-template-columns:repeat(${Math.min(def.cols, 4)}, minmax(0, 1fr))` },
      def.tiles.map((t, i) => {
        const src = rec?.tiles[i];
        const off = rec?.hidden.includes(i) ?? false;
        const toggle = async () => {
          if (!rec) return;
          rec.hidden = off ? rec.hidden.filter((n) => n !== i) : [...rec.hidden, i];
          await saveSheet(rec);
          state.previews = previewMap(state.sheets);
          render();
        };
        return h(
          "div",
          { class: `pv-tile${off ? " off" : ""}${rec?.redone?.includes(i) ? " redone" : ""}` },
          src ? h("img", { src, alt: `${t.label} preview` }) : h("span", { class: "pv-empty" }),
          src
            ? h(
                "span",
                { class: "pv-tools" },
                iconButton("refresh", `Redo ${t.label} on its own · ${tileCredits()} credits`, () => redoTile(def, i).then(render), "ghost"),
                iconButton(off ? "eye" : "eyeOff", off ? `Use ${t.label} again` : `Hide ${t.label}: wrong or out of order`, toggle, "ghost"),
              )
            : null,
          h("small", {}, t.label),
        );
      }),
    );
    return h(
      "div",
      { class: "pv-sheet" },
      h(
        "div",
        { class: "pv-head" },
        h("div", { class: "grow" }, h("strong", {}, def.label), h("small", { class: "muted" }, ` ${def.tiles.length} styles · ${per} credits`)),
        rec
          ? button("Re-run", "refresh", () => makeSheet(def).then(render), "ghost small", keyless)
          : button("Make", "wand", () => makeSheet(def).then(render), "small", keyless),
        rec
          ? iconButton("trash", `Remove ${def.label.toLowerCase()} previews`, async () => {
              await removeSheet(def.id);
              const { [def.id]: _gone, ...rest } = state.sheets;
              state.sheets = rest;
              state.previews = previewMap(state.sheets);
              render();
            }, "ghost")
          : null,
      ),
      rec?.issues.length ? h("p", { class: "pv-warn" }, icon("info", 14), h("span", {}, rec.issues.join(" "))) : null,
      tiles,
    );
  };
  const sheet = h(
    "div",
    { class: "sheet pv-sheet-wrap", role: "dialog", "aria-modal": "true", "aria-label": "Style previews" },
    h("div", { class: "sheet-head" }, h("h2", {}, "Style previews"), iconButton("close", "Close", close)),
    h(
      "p",
      { class: "hint" },
      `The AI draws one picture with the same villa, living room or estate in a grid of styles, then the app cuts it into card pictures. Runs on your Kie key with ${findKieModel(SHEET_MODEL).label} at ${SHEET_RESOLUTION}: ${per} credits per sheet. Your own render for a style still takes the card first. If one tile is wrong, redo just that style (${tileCredits()} credits) or hide it so its card goes back to colours.`,
    ),
    keyless ? h("p", { class: "pv-warn" }, icon("key", 14), h("span", {}, "Add your Kie.ai key in Settings to make previews.")) : null,
    ...SHEETS.map(sheetBlock),
    h(
      "div",
      { class: "sheet-actions" },
      Object.keys(state.sheets).length ? button("Export for the app", "save", exportPreviews, "ghost") : null,
      missing.length
        ? primaryButton(`Make ${missing.length === SHEETS.length ? "all" : "the rest"} · ${per * missing.length} credits`, "wand", async () => {
            for (const d of missing) await makeSheet(d);
            render();
          }, keyless)
        : null,
    ),
  );
  return h("div", { class: "sheet-backdrop", onclick: (e: Event) => e.target === e.currentTarget && !sheetJob && close() }, sheet);
}

// ---------- Render queue: line up views, walk away ----------

interface QueueItem {
  id: string;
  label: string;
  preset: Preset;
  prompt: string;
  images: ImageData64[];
  aspect: string | undefined;
  status: "waiting" | "running" | "done" | "failed";
  error?: string;
  cost: number | null;
  setup: RenderSetup;
}

const queue: QueueItem[] = [];
let queueRunning = false;

function queueCost(): number {
  return queue.filter((q) => q.status === "waiting" || q.status === "running").reduce((n, q) => n + (q.cost ?? 0), 0);
}

/** Snapshots the current view and settings; renders run one after another. */
async function addToQueue(): Promise<void> {
  const cap = state.capture;
  if (!cap) return;
  if (!isConnected()) return toast("Add a key in Settings to render", "error");
  const cost = renderCost();
  if (cost !== null && state.kieCredits !== null && queueCost() + cost > state.kieCredits) {
    return toast(`Not enough Kie credits: the queue needs ${queueCost() + cost}, you have ${Math.floor(state.kieCredits)}`, "error");
  }
  const ref = activeReference();
  const size = await imageSize(cap.view);
  const label = cap.facts?.sceneName || `View ${queue.length + 1}`;
  queue.push({
    id: Math.random().toString(36).slice(2, 9),
    label,
    preset: { ...state.preset },
    prompt: renderPrompt(),
    images: [cap.view, ...(cap.lines ? [cap.lines] : []), ...(ref ? [ref] : [])],
    aspect: nearestAspectRatio(size.width, size.height),
    status: "waiting",
    cost,
    setup: currentSetup(),
  });
  render();
  toast(`${label} added. Capture the next view, then press Render to run the queue`, "ok");
}

function queueWaiting(): number {
  return queue.filter((q) => q.status === "waiting").length;
}

function startQueue(): void {
  if (!isConnected()) {
    state.settingsKie = state.settings.backend === "kie";
    openSettings();
    return toast("Add a key in Settings to render", "error");
  }
  const cost = queueCost();
  if (cost !== null && state.kieCredits !== null && cost > state.kieCredits) {
    return toast(`Not enough Kie credits: the queue needs ${creditNumber(cost)}, you have ${Math.floor(state.kieCredits)}`, "error");
  }
  void runQueue();
  for (const bar of document.querySelectorAll(".render-bar")) bar.replaceWith(renderBar());
}

async function runQueue(): Promise<void> {
  if (queueRunning) return;
  queueRunning = true;
  try {
    for (;;) {
      const item = queue.find((q) => q.status === "waiting");
      if (!item) break;
      item.status = "running";
      drawQueue();
      const pendingIds: string[] = [];
      try {
        const provider = makeProvider(state.settings, host);
        const out = await provider.render({
          prompt: item.prompt,
          images: item.images,
          aspectRatio: item.aspect,
          onJob: (job) => void notePending(job, item.prompt, item.images[0]).then((id) => id && pendingIds.push(id)),
        });
        for (const id of pendingIds) await removeHistory(id).catch(() => undefined);
        await record("render", item.prompt, item.images[0], out.image, item.preset, item.setup);
        item.status = "done";
      } catch (e) {
        for (const id of pendingIds) await removeHistory(id).catch(() => undefined);
        item.status = "failed";
        item.error = (e as Error).message;
        toast(`Queue: ${item.label} failed. ${item.error}`, "error");
      }
      drawQueue();
      refreshCredits();
    }
    const done = queue.filter((q) => q.status === "done").length;
    if (done) toast(`Queue finished: ${done} render${done > 1 ? "s" : ""} in History`, "ok");
  } finally {
    queueRunning = false;
    drawQueue();
    for (const bar of document.querySelectorAll(".render-bar")) bar.replaceWith(renderBar());
  }
}

function queueSection(): HTMLElement {
  const waiting = queue.filter((q) => q.status === "waiting").length;
  const done = queue.filter((q) => q.status === "done").length;
  return h(
    "section",
    { class: "section queue", id: "queue" },
    h(
      "div",
      { class: "section-head" },
      h("h3", {}, `Queue · ${done} of ${queue.length} done`),
      h(
        "div",
        { class: "row" },
        done ? button("See in History", "history", () => ((state.tab = "history"), render()), "ghost small") : null,
        !queueRunning || waiting === 0
          ? button("Clear finished", "close", () => {
              for (let i = queue.length - 1; i >= 0; i--) if (queue[i].status === "done" || queue[i].status === "failed") queue.splice(i, 1);
              render();
            }, "ghost small")
          : null,
      ),
    ),
    h(
      "ol",
      { class: "queue-list" },
      queue.map((q) =>
        h(
          "li",
          { class: `q-${q.status}` },
          h("img", { src: toDataUrl(q.images[0]), alt: "" }),
          h("span", { class: "grow" }, h("strong", {}, q.label), h("small", {}, `${q.preset.name}${q.cost !== null ? ` · ${q.cost} credits` : ""}`)),
          h("em", { title: q.error ?? "" }, q.status === "waiting" ? "Waiting" : q.status === "running" ? "Rendering…" : q.status === "done" ? "Done" : "Failed"),
          q.status === "waiting"
            ? iconButton("close", `Remove ${q.label}`, () => {
                queue.splice(queue.indexOf(q), 1);
                render();
              }, "ghost")
            : null,
        ),
      ),
    ),
    h("p", { class: "hint" }, queueRunning ? "Each view renders with the settings it had when you added it. You can keep working, or walk away." : "Each view keeps the settings it had when you added it. Press Render to run the whole queue."),
  );
}

/** Redraws only the queue box, so a running queue does not reset what you are doing. */
function drawQueue(): void {
  const el = document.getElementById("queue");
  if (!queue.length) return el?.remove();
  if (el) el.replaceWith(queueSection());
  else if (state.tab === "render") render();
}

/**
 * Wide landscape window (desktop, iPad sideways): the model list gets its own
 * left panel, always open, so most of the panel fits on one screen.
 * Portrait or narrow windows use the phone layout.
 */
const WIDE = window.matchMedia("(min-width: 1000px) and (orientation: landscape)");
WIDE.addEventListener?.("change", () => render());

function renderTab(main: HTMLElement): void {
  const p = state.preset;
  // Picture column and controls column. Stacked on phones and in the
  // SketchUp panel, side by side on a wide screen (see styles.css).
  main.classList.add("render-layout");
  const pictureCol = h("div", { class: "picture-col" }, frameBar(), stage(), queue.length ? queueSection() : null);
  const body = h("div", { class: "controls-col" });
  main.append(pictureCol, body);
  // Wide screens: the model list and the Render button share the left panel.
  if (WIDE.matches) main.prepend(h("div", { class: "model-col" }, modelSection(), renderBar()));
  if (state.settings.simple) {
    quickTab(body);
    return;
  }
  const lock = state.settings.styleLock;
  body.append(modeSwitch());
  body.append(lockBanner());
  if (!lock) {
    body.append(
      section(
        t("Scene"),
        sceneTypeControl(),
        h(
          "div",
          { class: "look-row" },
          h("span", { class: "muted small" }, "Look"),
          segmented(
            [
              { id: "photo", label: "Photo", icon: "capture" },
              { id: "cgi", label: "3D render", icon: "render" },
            ],
            state.settings.look,
            async (v) => {
              state.settings.look = v as Settings["look"];
              await persist();
              render();
            },
          ),
        ),
      ),
    );
  }

  const presetCards = h(
    "div",
    { class: "lib-current" },
    libCard({ ...p, styleId: "", subjectId: "", colors: [] } as LibItem, true),
    h("div", { class: "preset-buttons" },
      button("Browse all", "search", () => openLibrary(), "primary"),
      button("Smart Detect", "wand", () => openSceneScan(), "ghost"),
      p.id !== "none" ? button("Clear", "close", clearPreset, "ghost") : null,
    ),
  );
  if (!lock) body.append(
    fold(sectionWith(
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
      notesField(),
      referenceField(),
    ), "preset", p.name, true));

  body.append(analysisFold());

  const timeSet = Boolean(state.settings.dynamic.time?.time);
  if (!lock) body.append(
    fold(section(
      t("Environment"),
      timeSet
        ? h("p", { class: "notice" }, icon("info", 16), h("span", {}, "Time of day is set under Dynamic, Time and weather, so this lighting is not sent. Clear it there to use this one."))
        : null,
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
    ), "environment", lightingOptions().find((o) => o.id === p.lighting)?.label ?? "", true));

  if (!lock) body.append(fold(surroundingsSection(), "surroundings", parseContexts(p.environment).map(contextLabel).join(", ") || "As modelled", false));
  body.append(fixturesFold());
  const st = state.settings;
  const geoBits = [host.kind === "sketchup" && st.linePass ? `Lines ${st.lineStrength.toFixed(2)}` : "", st.materialLock ? "Materials" : "", st.boundaryLock ? "Boundaries" : ""].filter(Boolean);
  // Less-used controls live under Advanced; it opens by itself when one is in use.
  const advancedInUse = dynamicSummary() !== "Off" || st.materialLock || st.boundaryLock || state.promptEdit !== null;
  body.append(
    h(
      "details",
      { class: "section advanced", open: advancedInUse || undefined },
      h("summary", {}, t("Advanced"), h("small", { class: "muted" }, " · dynamic prompts, geometry, prompt")),
      fold(dynamicSection(), "dynamic", dynamicSummary(), false),
      fold(geometrySection(), "geometry", geoBits.join(" · ") || "Off", false),
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
      h(
        "label",
        { class: "field" },
        h("span", {}, "Avoid (added to every render)"),
        textarea(state.settings.avoid, DEFAULT_AVOID, 2, (v) => {
          state.settings.avoid = v;
          persist();
          updatePromptPreview();
        }),
      ),
      promptEditor(),
    ),
  );
}

/** Quick note chips. The plate one uses the plate text set under Vehicles (D4VID when empty). */
const quickTemplates = (): { label: string; text: string }[] => [
  { label: "Cambodian plates", text: `Give every vehicle ${platePhrase(state.settings.dynamic.vehicles?.plate)}.` },
  { label: "Ground mist", text: "Add a thin, low ground mist that softens the base of the trees and the distance." },
  { label: "Green to glass", text: "Turn the transparent green-coloured surfaces into real glass material." },
  { label: "Orange to LED", text: "Turn the orange and yellow lines on the ceiling into glowing warm-white LED strips." },
  { label: "Blue to water", text: "Turn the flat blue-coloured areas into real clear water with ripples and reflections." },
  { label: "Clean site", text: "Remove any construction clutter; the site is finished, clean and tidy." },
];

function notesField(): HTMLElement {
  const ta = textarea(state.notes, "e.g. add a parked Honda Dream by the gate", 2, (v) => {
    state.notes = v;
    updatePromptPreview();
  });
  return h(
    "div",
    { class: "field" },
    h("span", {}, t("Notes for this view")),
    ta,
    h(
      "div",
      { class: "chips quick" },
      quickTemplates().map((q) =>
        chip(`+ ${q.label}`, state.notes.includes(q.text), () => {
          state.notes = state.notes.includes(q.text) ? state.notes.replace(q.text, "").replace(/\s{2,}/g, " ").trim() : `${state.notes.trim()}${state.notes.trim() && !/[.!?។]$/.test(state.notes.trim()) ? "." : ""} ${q.text}`.trim();
          render();
        }, undefined, q.text),
      ),
    ),
    plateInNotes(),
  );
}

/** Plate text box, shown while the Cambodian plates note is in use. Shares its value with Vehicles. */
function plateInNotes(): HTMLElement | null {
  const current = quickTemplates()[0].text;
  if (!state.notes.includes(current)) return null;
  const input = h("input", { type: "text", value: String(state.settings.dynamic.vehicles?.plate ?? ""), placeholder: `Plate text, empty = ${DEFAULT_PLATE}`, maxlength: 12, autocapitalize: "characters", spellcheck: false, "aria-label": "Plate text" }) as HTMLInputElement;
  input.addEventListener("change", async () => {
    const before = quickTemplates()[0].text;
    state.settings.dynamic = { ...state.settings.dynamic, vehicles: { ...(state.settings.dynamic.vehicles ?? {}), plate: input.value } };
    state.notes = state.notes.replace(before, quickTemplates()[0].text);
    await persist();
    render();
  });
  return h("label", { class: "field plate-field" }, h("span", {}, "Plate text"), input, h("small", { class: "muted" }, "AI models sometimes misspell plate text. Short plates (5 to 7 characters) come out best."));
}

function referenceField(): HTMLElement {
  const input = h("input", { type: "file", accept: "image/*", class: "hidden" }) as HTMLInputElement;
  input.addEventListener("change", async () => {
    const f = input.files?.[0];
    if (!f) return;
    state.reference = await fileToImage(f, 1536);
    render();
  });
  const ref = state.reference;
  return h(
    "div",
    { class: "field" },
    h("span", {}, "Style reference (optional)"),
    h(
      "div",
      { class: "ref-row" },
      ref ? h("img", { class: "ref-thumb", src: toDataUrl(ref), alt: "Style reference" }) : h("span", { class: "ref-thumb empty" }, icon("upload", 16)),
      h("small", { class: "muted" }, ref ? "Mood, colours and material quality are matched. Its geometry is never copied." : "A photo whose mood and materials you like. Sent as an extra image."),
      ref
        ? iconButton("trash", "Remove reference", () => {
            state.reference = null;
            render();
          }, "small")
        : button("Add", "upload", () => input.click(), "ghost small"),
      input,
    ),
    ref ? button(state.borrowedLook ? "Read the look again" : "Borrow this look", "wand", borrowLook, "ghost small borrow-btn") : null,
    state.borrowedLook ? borrowedLookBox() : null,
  );
}

/** The AI reads the reference photo's style, mood and materials into words for the prompt. */
async function borrowLook(): Promise<void> {
  const ref = state.reference;
  if (!ref) return;
  const text = await analyse(BORROW_LOOK_PROMPT, ref);
  if (text === null) return;
  const look = cleanBorrowedLook(text);
  if (!look) return toast("Couldn't read the look, try again", "error", `Borrow this look reply: ${text.slice(0, 300)}`);
  state.borrowedLook = look;
  state.promptEdit = null;
  render();
  toast("Look borrowed. It is now part of the prompt", "ok");
}

function borrowedLookBox(): HTMLElement {
  return h(
    "div",
    { class: "borrowed-look" },
    h("span", { class: "muted" }, "Borrowed look (added to the prompt, edit if needed)"),
    textarea(state.borrowedLook, "", 3, (v) => (state.borrowedLook = v)),
    button("Clear", "trash", async () => {
      state.borrowedLook = "";
      render();
    }, "ghost small"),
  );
}

function borrowedLookLine(): string | null {
  const look = state.borrowedLook.trim().replace(/\.$/, "");
  return look ? `Match this look from the style reference: ${look}.` : null;
}

function activeDna(): string[] {
  const lock = state.settings.styleLock;
  if (lock) return lock.dna;
  if (state.settings.simple) return [];
  return state.dna.filter((t) => t.on && t.text.trim()).map((t) => t.text.trim());
}

function dynamicSummary(): string {
  const n = GENERATORS.filter((g) => dynamicLines({ [g.id]: state.settings.dynamic[g.id] ?? {} }).length).length;
  return n ? `${n} on` : "Off";
}

function fixturesFold(): HTMLElement {
  const f = state.settings.fixtures;
  const interior = state.preset.projectType === "interior";
  const on = interior ? [f.led && "LED", f.strip && "Strip", f.cabinet && "Cabinet"].filter(Boolean).join(", ") : f.exterior === true ? "On" : f.exterior === false ? "Off" : "";
  return fold(fixturesSection(), "fixtures", on ? `${on} · ${f.kelvin}K` : "As modelled", false);
}

function renderBar(): HTMLElement {
  // Views waiting in the queue: Render runs the whole queue instead of one view.
  const waiting = queueRunning ? 0 : queueWaiting();
  const disabled = state.busy || (!state.capture && !waiting);
  const cost = waiting ? queueCost() : renderCost();
  const btn = h(
    "button",
    {
      class: state.busy ? "render-btn busy" : "render-btn",
      disabled,
      onclick: () => (waiting ? startQueue() : runRender()),
      type: "button",
      title: !state.capture && !state.busy && !waiting ? (host.kind === "sketchup" ? "Capture a view first" : "Upload an image first") : undefined,
    },
    icon("render", 20),
    state.busy ? h("span", { class: "render-progress", "aria-hidden": "true" }, h("i", { id: "render-fill", style: `transform:scaleX(${busyProgress().toFixed(3)})` })) : null,
    h("span", { id: "render-label" }, state.busy ? busyLabel() : waiting ? `Render queue (${waiting})` : t(state.result ? "Render again" : "Render")),
    !state.busy && cost !== null ? h("small", { class: "render-cost", title: waiting ? "Kie credits the queue costs" : "Kie credits this render costs" }, `${creditNumber(cost ?? 0)} credits`) : null,
  );
  return h(
    "div",
    { class: "render-bar" },
    WIDE.matches ? null : modelChip(),
    btn,
    creditReadout(),
    // Desktop: top up sits right by the balance.
    WIDE.matches && state.settings.backend === "kie" && state.settings.kieKey.trim()
      ? button("Top up", "plus", async () => openExternal(KIE_TOPUP_URL), "ghost small topup")
      : null,
    state.busy && state.settings.backend === "browser"
      ? button("Bring result back", "arrowDown", () => host.call("browserGrab").catch((e: Error) => toast(e.message, "error")), "ghost")
      : null,
    state.busy && state.abort ? iconButton("close", "Cancel", () => state.abort?.abort(), "ghost") : null,
  );
}

/**
 * Quick render sends only the scene type, the starter look, the notes and the
 * project lock. Settings made under All controls stay saved but are not sent,
 * so what you see in Quick is what the AI gets.
 */
function currentRenderPrompt(): string {
  const st = state.settings;
  const quick = st.simple;
  const lock = st.styleLock;
  const dyn = quick ? {} : st.dynamic;
  const ref = activeReference();
  return buildRenderPrompt({
    preset: state.preset,
    notes: state.notes,
    facts: state.capture?.facts,
    hasLinePass: Boolean(state.capture?.lines),
    extras: quick
      ? []
      : [fixtureSettingsLine(state.preset.projectType, st.fixtures), ...dynamicLines(dyn), borrowedLookLine()].filter((x): x is string => Boolean(x)),
    lightingFromDynamic: Boolean(dyn.time?.time),
    lineStrength: st.lineStrength,
    look: lock ? lock.look : st.look,
    materialLock: !quick && st.materialLock,
    boundaryLock: !quick && st.boundaryLock,
    avoid: st.avoid,
    dna: activeDna(),
    people: quick ? "" : state.people,
    referenceIndex: ref ? (state.capture?.lines ? 3 : 2) : undefined,
    referenceIsRender: Boolean(lock?.reference && lock.referenceIsRender),
  });
}

/** The reference image the next render sends: the project lock's, else the one added here. */
function activeReference(): ImageData64 | null {
  const lock = state.settings.styleLock;
  if (lock) return lock.reference;
  return state.settings.simple ? null : state.reference;
}

/** The prompt the next render sends: the user's own edit, or the built one. */
function renderPrompt(): string {
  return (!state.settings.simple && state.promptEdit) || currentRenderPrompt();
}

function promptEditor(): HTMLElement {
  const edited = state.promptEdit !== null;
  const ta = h("textarea", { id: "prompt-preview", rows: 12, class: "prompt-edit", "aria-label": "Prompt sent to the AI" }, renderPrompt()) as HTMLTextAreaElement;
  ta.addEventListener("input", () => {
    const was = state.promptEdit !== null;
    state.promptEdit = ta.value;
    if (!was) document.getElementById("prompt-state")?.replaceChildren("Edited by you; the panel's settings no longer change it.");
  });
  return h(
    "div",
    { class: "field" },
    h(
      "div",
      { class: "row" },
      h("span", { class: "grow" }, "Prompt sent to the AI"),
      edited
        ? button("Undo my edits", "undo", () => {
            state.promptEdit = null;
            render();
          }, "ghost small")
        : null,
    ),
    ta,
    h("small", { class: "muted", id: "prompt-state" }, edited ? "Edited by you; the panel's settings no longer change it." : "You can edit it here before rendering."),
  );
}

function updatePromptPreview(): void {
  if (state.promptEdit !== null) return;
  const pre = document.getElementById("prompt-preview") as HTMLTextAreaElement | null;
  if (pre) pre.value = currentRenderPrompt();
}

function rateButtons(after: ImageData64): HTMLElement | null {
  const id = historyIds.get(after);
  if (!id) return null;
  const item = state.history.find((x) => x.id === id);
  const rate = async (r: 1 | -1) => {
    const next = item?.rating === r ? undefined : r;
    await rateHistory(id, next);
    state.history = await listHistory();
    if (next) toast(next > 0 ? "Marked usable" : "Marked not usable", "ok");
    render();
  };
  return h(
    "span",
    { class: "rate", role: "group", "aria-label": "Is this render usable?" },
    iconButton("thumbUp", "Usable", () => rate(1), item?.rating === 1 ? "ghost on" : "ghost"),
    iconButton("thumbDown", "Not usable", () => rate(-1), item?.rating === -1 ? "ghost on" : "ghost"),
  );
}

function imageBlob(img: ImageData64): Blob {
  const bin = atob(img.data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: img.mimeType });
}

/** Clipboard images must be PNG in Chromium. */
async function pngBlob(img: ImageData64): Promise<Blob> {
  if (img.mimeType === "image/png") return imageBlob(img);
  const el = new Image();
  el.src = toDataUrl(img);
  await el.decode();
  const c = document.createElement("canvas");
  c.width = el.naturalWidth;
  c.height = el.naturalHeight;
  c.getContext("2d")!.drawImage(el, 0, 0);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Could not copy the image."))), "image/png"));
}

async function copyImage(img: ImageData64): Promise<void> {
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) throw new Error("This window can't copy images. Use Save instead.");
  await navigator.clipboard.write([new ClipboardItem({ "image/png": await pngBlob(img) })]);
  toast("Image copied. Paste it in Telegram, Line or email", "ok");
}

function resultActions(after: ImageData64, tool: ToolId): HTMLElement {
  return h(
    "div",
    { class: "stage-actions result-actions" },
    // Main actions, then small tools. On a phone they sit on two rows.
    h("div", { class: "ra-main" },
    primaryButton(host.kind === "sketchup" ? "Save" : isIOS() ? "Save" : "Download", "save", () => saveImage(after, tool)),
    button("Edit", "edit", () => {
      if (tool !== "render" && state.editSource && state.editSource !== after) pushEdit(state.editSource);
      else if (tool === "render") state.editStack = [];
      state.editSource = after;
      painter = null;
      state.tab = "edit";
      render();
    }, "ghost"),
    tool === "render" && state.capture && after === state.result
      ? button("Try again", "refresh", () => runRender(true), "ghost", state.busy)
      : null,
    ),
    h("div", { class: "ra-tools" },
    iconButton("copy", "Copy image", () => copyImage(after), "ghost"),
    tool === "render" ? rateButtons(after) : null,
    tool === "render"
      ? iconButton("lock", "Lock this look for every view of the project", () => lockLook(after), state.settings.styleLock?.referenceIsRender ? "ghost on" : "ghost")
      : null,
    tool === "render"
      ? iconButton("aerial", "More angles from this render", () => {
          state.anglesFrom = after;
          state.anglesOpen = true;
          render();
        }, "ghost")
      : null,
    host.kind === "sketchup" ? iconButton("folder", "Open the AI Renders folder", () => host.openRenderFolder().catch((e) => toast(e.message, "error")), "ghost") : null,
    tool === "render"
      ? iconButton("close", "Back to the source view", () => {
          state.result = null;
          state.results = [];
          render();
        }, "ghost")
      : null,
    ),
  );
}

function compareSlider(before: ImageData64, after: ImageData64): HTMLElement {
  // draggable=false and preventDefault stop the browser's own image drag,
  // which used to grab the picture instead of moving the divider.
  const beforeImg = h("img", { src: toDataUrl(before), alt: "Before", draggable: "false" }) as HTMLImageElement;
  const afterImg = h("img", { src: toDataUrl(after), alt: "After", draggable: "false" }) as HTMLImageElement;
  const clip = h("div", { class: "compare-before" }, beforeImg);
  const handle = h("div", { class: "compare-handle" }, h("span", {}, icon("arrowLeft", 12), icon("arrowRight", 12)));
  const wrap = h(
    "div",
    {
      class: "compare",
      tabindex: 0,
      role: "slider",
      "aria-label": "Before and after divider",
      "aria-valuemin": 0,
      "aria-valuemax": 100,
      "aria-valuenow": 50,
    },
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
    wrap.setAttribute("aria-valuenow", String(Math.round(v)));
  };
  wrap.addEventListener("keydown", (e) => {
    const now = Number(wrap.getAttribute("aria-valuenow"));
    const step = e.shiftKey ? 10 : 2;
    const next = e.key === "ArrowLeft" ? now - step : e.key === "ArrowRight" ? now + step : e.key === "Home" ? 0 : e.key === "End" ? 100 : null;
    if (next === null) return;
    e.preventDefault();
    set(next);
  });
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

/** iPhone or iPad (iPadOS reports itself as a Mac with touch). */
function isIOS(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

async function saveImage(img: ImageData64, tool: ToolId): Promise<void> {
  try {
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    const name = `${tool}_${state.capture?.facts?.sceneName || state.preset.name}_${stamp}`.replace(/[^\w.-]+/g, "_");
    // iPhone/iPad: a web page can't write to Photos, but the share sheet has
    // "Save Image" at the top. No await before share(), or Safari drops the tap.
    if (host.kind !== "sketchup" && isIOS()) {
      const file = new File([imageBlob(img)], `${name}.${img.mimeType === "image/png" ? "png" : "jpg"}`, { type: img.mimeType });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
        } catch (e) {
          if ((e as Error).name !== "AbortError") throw e;
        }
        return;
      }
    }
    const where = await host.save(img, name);
    toast(`Saved ${where}`, "ok");
  } catch (e) {
    toast((e as Error).message, "error");
  }
}

/** Model name used to remember how long renders take. */
function timingKey(): string {
  const st = state.settings;
  return st.backend === "kie" ? `${st.kieModel}@${st.kieResolution}` : st.backend;
}

function busyProgress(): number {
  return progressAt(Date.now() - state.busySince, typicalMs(timingKey()));
}

function busyLabel(): string {
  if (state.settings.backend === "browser") return "Press Send in the browser";
  return runningLong(Date.now() - state.busySince, typicalMs(timingKey())) ? "Taking longer than usual" : t("Rendering...");
}

function setBusy(on: boolean): void {
  state.busy = on;
  window.clearInterval(busyTimer);
  if (on) {
    state.busySince = Date.now();
    // Moves the bar inside the Render button; no counter, just the fill.
    busyTimer = window.setInterval(() => {
      const fill = document.getElementById("render-fill");
      if (fill) fill.style.transform = `scaleX(${busyProgress().toFixed(3)})`;
      const label = document.getElementById("render-label");
      if (label && label.textContent !== busyLabel()) label.textContent = busyLabel();
      fill?.closest(".render-btn")?.classList.toggle("long", runningLong(Date.now() - state.busySince, typicalMs(timingKey())));
    }, 200);
  }
}

/** Fills the bar to the end before the result is shown. */
async function finishProgress(): Promise<void> {
  const fill = document.getElementById("render-fill");
  if (!fill) return;
  // Ramps up to full: picks up speed into the end.
  fill.style.transition = "transform 420ms cubic-bezier(0.55, 0, 0.9, 0.6)";
  fill.style.transform = "scaleX(1)";
  await new Promise((r) => setTimeout(r, 450));
}

async function runProvider(prompt: string, images: ImageData64[], aspectRatio?: string): Promise<ImageData64 | null> {
  return (await runProviderMany(prompt, images, aspectRatio, 1))[0] ?? null;
}

/** Runs the same request `count` times side by side; returns the ones that worked. */
async function runProviderMany(prompt: string, images: ImageData64[], aspectRatio: string | undefined, count: number): Promise<ImageData64[]> {
  const provider = makeProvider(state.settings, host);
  // The browser backend is one chat at a time.
  const n = state.settings.backend === "browser" ? 1 : Math.max(1, Math.min(4, count));
  setBusy(true);
  // Older SketchUp versions embed a Chromium without AbortController.
  state.abort = typeof AbortController === "undefined" ? null : new AbortController();
  render();
  toast(n > 1 ? `Rendering ${n}...` : "Rendering...");
  const pendingIds: string[] = [];
  try {
    const runs = await Promise.allSettled(
      Array.from({ length: n }, () => provider.render({ prompt, images, aspectRatio, onJob: (job) => notePending(job, prompt, images[0]).then((id) => id && pendingIds.push(id)) }, state.abort?.signal)),
    );
    const ok = runs.flatMap((r) => (r.status === "fulfilled" ? [r.value.image] : []));
    const failed = runs.find((r): r is PromiseRejectedResult => r.status === "rejected");
    if (failed && !ok.length) throw failed.reason;
    rememberDuration(timingKey(), Date.now() - state.busySince);
    window.clearInterval(busyTimer);
    await finishProgress();
    freshResult = true;
    window.setTimeout(() => (freshResult = false), 700);
    if (failed) toast(`${ok.length} of ${n} done. One failed: ${(failed.reason as Error).message}`, "error");
    else toast("Done", "ok");
    return ok;
  } catch (e) {
    const err = e as Error;
    toast(err.name === "AbortError" ? "Cancelled." : err.message, err.name === "AbortError" ? "info" : "error");
    return [];
  } finally {
    setBusy(false);
    state.abort = null;
    // Finished renders are recorded as usual; these markers are only for a crash.
    for (const id of pendingIds) await removeHistory(id).catch(() => undefined);
  }
}

/**
 * Notes a running Kie job in History, so a render that finishes after
 * SketchUp closes (or crashes) is picked up next time. Returns its id.
 */
async function notePending(jobId: string, prompt: string, before: ImageData64 | undefined): Promise<string | null> {
  if (state.settings.backend !== "kie" || !before) return null;
  const id = `job-${jobId}`;
  await addHistory({
    id,
    createdAt: Date.now(),
    tool: "render",
    presetName: state.preset.name,
    presetId: state.preset.id,
    prompt,
    before,
    after: before,
    provider: "Kie.ai",
    model: state.settings.kieModel,
    project: state.settings.project || undefined,
    pending: { jobId, model: state.settings.kieModel },
  }).catch(() => undefined);
  return id;
}

/** On start: finish renders whose job was still running when the panel closed. */
async function recoverPending(round = 0): Promise<void> {
  const s = state.settings;
  const open = state.history.filter((x) => x.pending);
  if (!open.length || !s.kieKey) return;
  const p = new KieProvider(s.kieKey, s.kieModel, s.kieResolution, host.kind === "sketchup" ? hostTransport(host) : fetchTransport);
  let done = 0;
  let still = 0;
  for (const item of open) {
    try {
      const out = await p.resume(item.pending!.jobId);
      if (out === "running") still++;
      else if (out) {
        await addHistory({ ...item, after: out, pending: undefined, createdAt: Date.now() });
        done++;
      } else await removeHistory(item.id);
    } catch {
      still++;
    }
  }
  state.history = await listHistory();
  if (done) {
    render();
    toast(`Recovered ${done} render${done > 1 ? "s" : ""} that finished after the panel closed. See History`, "ok");
  }
  // Keep checking for up to ten minutes, then leave it for the next start.
  if (still && round < 10) window.setTimeout(() => recoverPending(round + 1), 60_000);
}

/** History id of each image on the stage, so it can be rated. */
const historyIds = new WeakMap<ImageData64, string>();

/** Everything a render was made with, for History's "Use this setup". */
function currentSetup(): RenderSetup {
  const s = state.settings;
  return {
    preset: { ...state.preset },
    notes: state.notes,
    people: state.people,
    dna: state.dna.map((x) => ({ ...x })),
    look: s.look,
    simple: s.simple,
    dynamic: JSON.parse(JSON.stringify(s.dynamic)) as Record<string, unknown>,
    kieModel: s.kieModel,
    kieResolution: s.kieResolution,
    frameId: state.frameId,
    promptEdit: s.simple ? null : state.promptEdit,
  };
}

/** Puts a History item's style, notes and choices back, ready for the next render. */
async function useSetup(setup: RenderSetup): Promise<void> {
  const s = state.settings;
  if (s.styleLock) return toast("The project look is locked. Unlock it to use another setup.", "error");
  state.preset = { ...setup.preset };
  state.notes = setup.notes;
  state.people = setup.people;
  state.dna = setup.dna.map((x) => ({ ...x }));
  state.dnaDraft = null;
  state.peopleDraft = null;
  s.look = setup.look as Settings["look"];
  s.simple = setup.simple;
  s.dynamic = JSON.parse(JSON.stringify(setup.dynamic)) as Settings["dynamic"];
  if (findKieModel(setup.kieModel).id === setup.kieModel) s.kieModel = setup.kieModel;
  s.kieResolution = setup.kieResolution as Settings["kieResolution"];
  if (setup.frameId && setup.frameId !== state.frameId) await chooseFrame(setup.frameId);
  state.promptEdit = setup.promptEdit;
  await persist();
  state.tab = "render";
  render();
  toast(`Setup loaded: ${setup.preset.name}. Capture a view and render`, "ok");
}

async function record(tool: ToolId, prompt: string, before: ImageData64, after: ImageData64, preset: Preset = state.preset, setup?: RenderSetup): Promise<string> {
  const provider = makeProvider(state.settings, host);
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  historyIds.set(after, id);
  await addHistory({
    id,
    createdAt: Date.now(),
    tool,
    presetName: tool === "render" ? preset.name : undefined,
    presetId: tool === "render" ? preset.id : undefined,
    prompt,
    before,
    after,
    provider: provider.label,
    model: provider.modelName ?? state.settings.comfyUrl,
    credits: state.settings.backend === "kie" && !state.settings.testMode ? creditsFor(findKieModel(state.settings.kieModel), state.settings.kieResolution) ?? undefined : undefined,
    project: state.settings.project || undefined,
    setup: tool === "render" ? (setup ?? currentSetup()) : undefined,
  });
  state.history = await listHistory();
  return id;
}

/** keep: add the new renders beside the ones on screen ("Try again"). */
async function runRender(keep = false): Promise<void> {
  const cap = state.capture;
  if (!cap) return;
  lastAction = () => runRender(keep);
  const cost = renderCost();
  if (cost !== null && state.kieCredits !== null && cost > state.kieCredits) {
    toast(`Not enough Kie credits: this render needs ${cost}, you have ${Math.floor(state.kieCredits)}`, "error");
    return;
  }
  if (!isConnected()) {
    state.settingsKie = state.settings.backend === "kie";
    openSettings();
    toast("Add a key in Settings to render", "error");
    return;
  }
  const prompt = renderPrompt();
  const ref = activeReference();
  const images = [cap.view, ...(cap.lines ? [cap.lines] : []), ...(ref ? [ref] : [])];
  const size = await imageSize(cap.view);
  const raws = await runProviderMany(prompt, images, nearestAspectRatio(size.width, size.height), state.settings.imageCount);
  if (raws.length) {
    rememberSetup();
    await persist();
  }
  await showRenders(raws, prompt, cap.view, keep);
}

/** Asks Kie how many credits are left and shows it next to Render. Quiet on failure. */
async function refreshCredits(): Promise<void> {
  const s = state.settings;
  if (s.backend !== "kie" || !s.kieKey || s.testMode) return;
  try {
    const p = new KieProvider(s.kieKey, s.kieModel, s.kieResolution, host.kind === "sketchup" ? hostTransport(host) : fetchTransport);
    state.kieCredits = await p.balance();
    const was = state.kieKeyStatus;
    state.kieKeyStatus = "ok";
    if (was === "bad") render();
    const el = document.getElementById("credit-readout");
    if (el) el.replaceWith(creditReadout());
  } catch (e) {
    // A rejected key means Not connected; no internet leaves the status as it was.
    if (keyRejected(e)) {
      state.kieKeyStatus = "bad";
      state.kieCredits = null;
      render();
    }
  }
}

function keyRejected(e: unknown): boolean {
  return e instanceof ProviderError ? e.status === 401 || /rejected the api key/i.test(e.message) : false;
}

function creditText(c: number): string {
  return `${Math.floor(c).toLocaleString("en-US")} credits`;
}

/** Credits one press of Render costs on Kie, all images included; null when unknown. */
function renderCost(): number | null {
  const s = state.settings;
  if (s.backend !== "kie") return null;
  const per = creditsFor(findKieModel(s.kieModel), s.kieResolution);
  return per === null ? null : per * Math.max(1, s.imageCount);
}

function creditReadout(): HTMLElement {
  const c = state.kieCredits;
  const s = state.settings;
  if (s.backend !== "kie" || !s.kieKey || c === null) return h("span", { id: "credit-readout", hidden: true });
  const cost = renderCost();
  const low = c < 20 || (cost !== null && c < cost * 3);
  return h(
    "button",
    {
      id: "credit-readout",
      class: `credit${low ? " low" : ""}`,
      type: "button",
      title: `${creditText(c)} left on Kie (about $${(c * USD_PER_CREDIT).toFixed(2)}). Click to refresh.`,
      "aria-label": `Kie balance ${creditText(c)}. Click to refresh.`,
      onclick: withFeedback(refreshCredits),
    },
    creditText(c),
  );
}

/** Puts new renders on the stage and in history. */
async function showRenders(raws: ImageData64[], prompt: string, before: ImageData64, keep = false): Promise<void> {
  // A ratio the model cannot output (e.g. 7:3) comes back at the nearest one;
  // trim it to the exact frame so it matches the capture.
  const frame = findFrame(state.capturedFrameId || state.frameId);
  const outs: ImageData64[] = [];
  for (const raw of raws) outs.push(frame.ratio && !isListed(frame.id) ? await cropToRatio(raw, frame.ratio) : raw);
  if (outs.length) {
    state.results = keep ? [...state.results, ...outs] : outs;
    state.result = outs[0];
    for (const out of outs) await record("render", prompt, before, out);
  }
  render();
  refreshCredits();
}

const ANGLES: { id: string; label: string; text: string }[] = [
  { id: "closer", label: "Closer", text: "a closer view of the main entrance and facade, about half the distance" },
  { id: "wider", label: "Wider", text: "a wider view showing the whole building and more of its surroundings" },
  { id: "corner", label: "Corner, eye level", text: "an eye-level view from the front corner, two-point perspective with straight verticals" },
  { id: "drone", label: "Drone 45°", text: "a drone view from about 45 degrees above, looking down at the building and site" },
  { id: "top", label: "Top down", text: "a straight top-down aerial view of the building and site" },
  { id: "low", label: "Low angle", text: "a low worm's-eye angle looking up at the building" },
  { id: "detail", label: "Detail", text: "a close detail view of the most interesting material junction or joinery" },
  { id: "interior-wide", label: "Room, other side", text: "the same room seen from the opposite side, eye level, 24 mm lens" },
];

async function runAngle(text: string): Promise<void> {
  const from = state.anglesFrom ?? state.result;
  if (!from) return;
  // From the stage, the new views join the renders on screen; from History
  // they are saved there and opened, and the stage is left alone.
  const onStage = state.tab === "render" && from === state.result;
  state.anglesOpen = false;
  const prompt = [
    "The image is a finished architectural photograph.",
    `Show the same building with the same design, materials, colours, lighting, weather and surroundings, from a new camera position: ${text}.`,
    "Keep every design detail consistent with the image; invent only what the new view reveals, in the same style. Real photograph, no text, no watermark.",
  ].join("\n");
  const size = await imageSize(from);
  const raws = await runProviderMany(prompt, [from], nearestAspectRatio(size.width, size.height), 1);
  state.anglesFrom = null;
  if (onStage) return showRenders(raws, prompt, from, true);
  if (!raws.length) return render();
  const source = state.history.find((x) => x.after === from);
  let id = "";
  for (const raw of raws) id = await record("render", prompt, from, raw, source?.setup?.preset ?? state.preset, source?.setup);
  state.historyOpenId = id;
  scrollToDetail = true;
  state.tab = "history";
  render();
  toast("New angle saved in History", "ok");
}

function anglesSheet(): HTMLElement {
  const close = () => {
    state.anglesOpen = false;
    state.anglesFrom = null;
    render();
  };
  const from = state.anglesFrom ?? state.result;
  return h(
    "div",
    { class: "sheet-backdrop", onclick: (e: Event) => e.target === e.currentTarget && close() },
    h(
      "div",
      { class: "sheet", role: "dialog", "aria-modal": "true" },
      h("div", { class: "sheet-head" }, h("h2", {}, "More angles"), iconButton("close", "Close", close)),
      from ? h("img", { class: "angles-from", src: toDataUrl(from), alt: "Render the new angle starts from" }) : null,
      h("p", { class: "hint" }, "Makes a new camera view from this render, keeping its design, materials and light. One image each."),
      h(
        "div",
        { class: "angle-grid" },
        ANGLES.map((a) => button(a.label, "capture", () => runAngle(a.text), "ghost")),
      ),
    ),
  );
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

/** Back to no preset: the prompt keeps only the scene type and your own words. */
async function clearPreset(): Promise<void> {
  state.preset = nonePreset(state.preset.projectType);
  await persist();
  render();
  toast("Preset cleared", "ok");
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
        h("p", {}, "Paint zones over an image and say what should change in each, or change its lighting. Pick a render from Render or History, or upload one."),
        h("div", { class: "row center" }, primaryButton("Upload image", "upload", () => input.click()), state.history.length ? button("From history", "history", () => { state.tab = "history"; render(); }, "ghost") : null, input),
      ),
    );
    return;
  }
  const src = state.editSource;
  body.append(
    segmented(
      [
        { id: "spot", label: t("Spot edit"), icon: "edit" },
        { id: "relight", label: t("Change lighting"), icon: "lights" },
      ],
      state.editMode,
      (v) => {
        state.editMode = v as State["editMode"];
        if (state.editPromptEdit !== null) toast("Your edited prompt was for the other tool, so this one starts from the built prompt");
        state.editPromptEdit = null;
        render();
      },
    ),
  );
  if (state.editMode === "spot") body.append(...spotEditor(src));
  else body.append(...relightEditor(src));
  body.append(
    h(
      "div",
      { class: "row" },
      button("Use another image", "upload", () => input.click(), "ghost small"),
      state.editStack.length ? button(`Undo last edit (${state.editStack.length})`, "undo", undoEdit, "ghost small") : null,
      input,
    ),
  );
}

const MAX_EDIT_STEPS = 10;

function pushEdit(img: ImageData64): void {
  state.editStack = [...state.editStack, img].slice(-MAX_EDIT_STEPS);
}

/** Steps the edited image back one spot edit or relight. */
function undoEdit(): void {
  const prev = state.editStack.pop();
  if (!prev) return;
  state.editSource = prev;
  painter = null;
  render();
  toast(state.editStack.length ? `Back one step (${state.editStack.length} more)` : "Back to the first version", "ok");
}

function getPainter(): ZonePainter {
  if (!painter) {
    painter = new ZonePainter();
    painter.size = state.brushSize;
  }
  return painter;
}

function spotEditor(src: ImageData64): HTMLElement[] {
  const p = getPainter();
  const img = h("img", { src: toDataUrl(src), alt: "Image to edit", draggable: "false" }) as HTMLImageElement;
  const surface = p.surface(img);
  surface.dataset.tool = p.tool;
  surface.classList.toggle("erasing", p.erase);

  // tool bar
  const toolIcons: Record<PaintTool, string> = { brush: "brush", rect: "rect", lasso: "lasso" };
  const toolNames: Record<PaintTool, string> = { brush: "Brush", rect: "Rectangle select", lasso: "Lasso" };
  const menu = h("div", { class: "tool-menu hidden" });
  const toolBtn = h(
    "button",
    { class: "tool-pick", type: "button", "data-tip": toolNames[p.tool], "aria-label": `Tool: ${toolNames[p.tool]}` },
    icon(toolIcons[p.tool], 18),
    icon("chevron", 12),
  );
  toolBtn.addEventListener("click", () => menu.classList.toggle("hidden"));
  for (const tl of ["brush", "rect", "lasso"] as PaintTool[]) {
    menu.append(
      h(
        "button",
        {
          type: "button",
          class: tl === p.tool ? "active" : "",
          onclick: () => {
            p.tool = tl;
            p.erase = false;
            render();
          },
        },
        icon(toolIcons[tl], 16),
        h("span", {}, toolNames[tl]),
      ),
    );
  }
  const sizeOut = h("output", {}, `${p.size}`);
  const size = h("input", { type: "range", min: 4, max: 160, step: 1, value: p.size, class: "mini-range", "aria-label": "Brush size" }) as HTMLInputElement;
  const fill = () => size.style.setProperty("--fill", `${((Number(size.value) - 4) / 156) * 100}%`);
  size.addEventListener("input", () => {
    p.size = Number(size.value);
    state.brushSize = p.size;
    sizeOut.textContent = size.value;
    fill();
  });
  fill();
  const undoBtn = h("button", { class: "tool-btn", type: "button", "data-tip": "Undo", "aria-label": "Undo", disabled: !p.canUndo(), onclick: () => p.undo() }, icon("undo", 17));
  const redoBtn = h("button", { class: "tool-btn", type: "button", "data-tip": "Redo", "aria-label": "Redo", disabled: !p.canRedo(), onclick: () => p.redo() }, icon("redo", 17));
  const eraseBtn = h(
    "button",
    {
      class: p.erase ? "tool-btn active" : "tool-btn",
      type: "button",
      "data-tip": "Eraser",
      "aria-label": "Eraser",
      onclick: () => {
        p.erase = !p.erase;
        render();
      },
    },
    icon("eraser", 17),
  );
  const bar = h(
    "div",
    { class: "paint-bar" },
    h("div", { class: "tool-pick-wrap" }, toolBtn, menu),
    eraseBtn,
    h("div", { class: "size-wrap", "data-tip": "Brush size" }, h("span", { class: "size-dot", style: `--s:${Math.max(4, Math.min(16, p.size / 6))}px` }), size, sizeOut),
    h("span", { class: "bar-gap" }),
    undoBtn,
    redoBtn,
    h("button", { class: "tool-btn", type: "button", "data-tip": "Clear all zones", "aria-label": "Clear all zones", onclick: () => p.clearAll() }, icon("trash", 17)),
  );

  // zones
  const zoneRow = h("div", { class: "zone-row" });
  const fields = h("div", { class: "zone-fields" });
  const drawZones = () => {
    clear(zoneRow);
    clear(fields);
    const painted = new Set(p.paintedZones());
    for (const z of ZONES) {
      zoneRow.append(
        h(
          "button",
          {
            class: `zone${z.id === p.active ? " active" : ""}${painted.has(z.id) ? " painted" : ""}`,
            type: "button",
            style: `--z:${z.css}`,
            onclick: () => {
              p.active = z.id;
              p.erase = false;
              render();
            },
          },
          h("i", {}),
          h("span", {}, z.name),
        ),
      );
      if (painted.has(z.id) || z.id === p.active || state.zonePrompts[z.id]) {
        const ta = textarea(state.zonePrompts[z.id] ?? "", z.id === "A" ? "e.g. remove the car" : "e.g. add a frangipani tree in a concrete planter", 1, (v) => {
          state.zonePrompts[z.id] = v;
        }) as HTMLTextAreaElement;
        ta.addEventListener("focus", () => {
          if (p.active !== z.id) {
            p.active = z.id;
            zoneRow.querySelectorAll(".zone").forEach((b, k) => b.classList.toggle("active", ZONES[k].id === z.id));
          }
        });
        fields.append(
          h(
            "label",
            { class: `zone-field${z.id === p.active ? " active" : ""}`, style: `--z:${z.css}` },
            h("span", { class: "zone-tag" }, h("i", {}), `${z.name}, ${z.colour}`, painted.has(z.id) ? null : h("em", {}, "not painted")),
            ta,
          ),
        );
      }
    }
    (undoBtn as HTMLButtonElement).disabled = !p.canUndo();
    (redoBtn as HTMLButtonElement).disabled = !p.canRedo();
  };
  p.onChange = drawZones;
  drawZones();

  return [
    sectionWith(
      "Zone palette",
      h("small", { class: "head-hint" }, "Pick a zone, paint, then describe it"),
      zoneRow,
      bar,
      h("div", { class: "paint-box" }, surface, state.busy ? h("div", { class: "scan" }) : null),
    ),
    section(
      "What should change",
      h(
        "label",
        { class: "field general-edit" },
        h("span", {}, "General edit (whole picture)"),
        textarea(state.editGeneral, "e.g. make it a rainy evening, add wet reflections on the road", 2, (v) => (state.editGeneral = v)),
      ),
      fields,
      h(
        "p",
        { class: "hint" },
        state.editWithLight
          ? "Each colour is sent with its own instruction, and the whole picture is relit in the same request."
          : "Each colour is sent with its own instruction. Only painted areas are replaced; everything else stays pixel-exact.",
      ),
    ),
    editLightSection(),
    section(
      "Send",
      h(
        "label",
        { class: "switch" },
        h("input", {
          type: "checkbox",
          checked: state.settings.singleImage,
          onchange: async (e: Event) => {
            state.settings.singleImage = (e.target as HTMLInputElement).checked;
            await persist();
          },
        }),
        h("span", { class: "track" }),
        "Send only the painted image (fewer tokens)",
      ),
      h("p", { class: "hint" }, "Off sends the clean image too, which can help when the paint hides fine detail the AI needs to keep."),
      exactPrompt(() => spotEditPrompt(p)),
    ),
    editActionBar(state.editWithLight ? "Apply edit + lighting" : "Apply edit", "wand", runSpotEdit),
  ];
}

function editLightSection(): HTMLElement {
  const sw = h("input", {
    type: "checkbox",
    checked: state.editWithLight,
    onchange: (e: Event) => {
      state.editWithLight = (e.target as HTMLInputElement).checked;
      render();
    },
  });
  const group = state.relightGroup;
  return sectionWith(
    "Lighting in the same render",
    h("label", { class: "switch" }, sw, h("span", { class: "track" }), "Change lighting too"),
    state.editWithLight
      ? h(
          "div",
          { class: "stack" },
          segmented(RELIGHT_GROUPS, group, (v) => {
            state.relightGroup = v;
            render();
          }),
          group === "interior" ? null : sunDial(() => state.relight, (id) => (state.relight = id)),
          h(
            "div",
            { class: "light-grid" },
            relightOptions(group).map((o) =>
              lightingCard(o, o.id === state.relight, () => {
                state.relight = o.id;
                render();
              }),
            ),
          ),
        )
      : h("p", { class: "hint" }, "Turn on to relight the whole picture in the same request, so one render does both jobs."),
  );
}

const RELIGHT_GROUPS: { id: "exterior" | "interior" | "urban"; label: string; icon: string }[] = [
  { id: "exterior", label: "Exterior", icon: "exterior" },
  { id: "interior", label: "Interior", icon: "interior" },
  { id: "urban", label: "Urban", icon: "aerial" },
];

function relightOptions(group: State["relightGroup"]): Option[] {
  if (group === "interior") return INTERIOR_RELIGHT;
  if (group === "urban") return URBAN_RELIGHT;
  return lightingOptions().filter((o) => !o.id.startsWith("interior"));
}

function relightEditor(src: ImageData64): HTMLElement[] {
  const group = state.relightGroup;
  return [
    section(
      "New lighting",
      h("img", { class: "stage-img", src: toDataUrl(src), alt: "Image to relight" }),
      segmented(RELIGHT_GROUPS, group, (v) => {
        state.relightGroup = v;
        render();
      }),
      group === "interior" ? null : sunDial(() => state.relight, (id) => (state.relight = id)),
      h(
        "div",
        { class: "light-grid" },
        relightOptions(group).map((o) =>
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
      exactPrompt(relightPrompt),
    ),
    editActionBar(t("Change lighting"), "lights", runRelight),
  ];
}

/** Credits one edit costs: a single image at the chosen size. */
function editCost(): number | null {
  const s = state.settings;
  if (s.backend !== "kie") return null;
  return creditsFor(findKieModel(s.kieModel), s.kieResolution);
}

/** Model, cost and the same filling progress bar as Render, for the Edit tools. */
function editActionBar(label: string, iconName: string, run: () => Promise<void>): HTMLElement {
  const cost = editCost();
  return h(
    "div",
    { class: "action-bar" },
    modelChip(),
    h(
      "button",
      { class: state.busy ? "render-btn busy" : "render-btn", disabled: state.busy, type: "button", onclick: () => void run() },
      icon(iconName, 20),
      state.busy ? h("span", { class: "render-progress", "aria-hidden": "true" }, h("i", { id: "render-fill", style: `transform:scaleX(${busyProgress().toFixed(3)})` })) : null,
      h("span", { id: "render-label" }, state.busy ? busyLabel() : label),
      !state.busy && cost !== null ? h("small", { class: "render-cost", title: "Kie credits this edit costs" }, `${creditNumber(cost)} credits`) : null,
    ),
    state.busy && state.abort ? iconButton("close", "Cancel", () => state.abort?.abort(), "ghost") : null,
  );
}

/**
 * Advanced: the exact prompt the next edit sends, editable. It follows the
 * settings until you type in it; Reset goes back to the built one.
 */
function exactPrompt(build: () => string): HTMLElement {
  const ta = h("textarea", { rows: 8, class: "prompt-edit", "aria-label": "Prompt sent to the AI" }) as HTMLTextAreaElement;
  const reset = button("Reset", "undo", async () => {
    state.editPromptEdit = null;
    sync();
    toast("Prompt follows your settings again", "ok");
  }, "ghost small");
  const sync = () => {
    if (state.editPromptEdit === null) ta.value = build();
    reset.hidden = state.editPromptEdit === null;
  };
  ta.addEventListener("input", () => {
    state.editPromptEdit = ta.value;
    reset.hidden = false;
  });
  // Fresh text each time it is opened or focused, so zone changes show up.
  ta.addEventListener("focus", () => state.editPromptEdit === null && (ta.value = build()));
  const box = h(
    "details",
    { class: "exact-prompt", open: state.editPromptEdit !== null },
    h("summary", {}, "Advanced: exact prompt", state.editPromptEdit !== null ? h("em", {}, " (edited)") : null),
    ta,
    h("div", { class: "row" }, h("p", { class: "hint grow" }, "This is what the AI gets. Edit it to take full control."), reset),
  ) as HTMLDetailsElement;
  box.addEventListener("toggle", () => box.open && sync());
  sync();
  return box;
}

function spotEditPrompt(p: ZonePainter | null): string {
  const painted = p?.paintedZones() ?? [];
  const zones = ZONES.filter((z) => painted.includes(z.id));
  return buildZoneEditPrompt(
    zones.map((z) => ({ colour: z.colour, instruction: state.zonePrompts[z.id] ?? "" })),
    { singleImage: state.settings.singleImage, lighting: state.editWithLight ? relightText(state.relight, state.capture?.facts) : null, general: state.editGeneral },
  );
}

function relightPrompt(): string {
  return buildLightingPrompt(state.relight, state.editInstruction, state.capture?.facts);
}

async function runSpotEdit(): Promise<void> {
  const src = state.editSource;
  const p = painter;
  if (!src || !p) return;
  const painted = p.paintedZones();
  const lightingOn = state.editWithLight;
  const general = state.editGeneral.trim();
  const ownPrompt = state.editPromptEdit?.trim() || "";
  if (!painted.length && !lightingOn && !general && !ownPrompt) return toast("Paint a zone, or write a general edit for the whole picture.", "error");
  const missing = painted.filter((id) => !(state.zonePrompts[id] ?? "").trim());
  if (missing.length) return toast(`Describe what should change in ${missing.map((id) => `Zone ${id}`).join(", ")}.`, "error");
  const zones = ZONES.filter((z) => painted.includes(z.id));
  const single = state.settings.singleImage;
  const lighting = lightingOn ? relightText(state.relight, state.capture?.facts) : null;
  const prompt = ownPrompt || spotEditPrompt(p);
  const overlay = zones.length ? await zoneOverlay(src, zones.map((z) => ({ mask: p.canvases[z.id], colour: z.css }))) : src;
  // One image when asked: the painted copy carries the picture and the zones.
  const images = !zones.length ? [src] : single ? [overlay] : [src, overlay];
  const union = p.union();
  const size = await imageSize(src);
  const out = await runProvider(prompt, images, nearestAspectRatio(size.width, size.height));
  if (out) {
    const fitted = await resizeTo(out, size.width, size.height);
    // A relit picture changes everywhere, so only a plain spot edit is
    // pasted back over the original to keep the rest pixel-exact.
    // A hand-written prompt with zones painted is still pasted back into the
    // zones only, so nothing changes outside them.
    const merged = lighting || general || !zones.length ? fitted : await compositeMasked(src, fitted, union);
    const tool: ToolId = lighting && !zones.length ? "lighting" : "spot-edit";
    await record(tool, prompt, src, merged);
    pushEdit(src);
    state.editSource = merged;
    painter = null;
    state.zonePrompts = {};
    state.editGeneral = "";
    state.editPromptEdit = null;
    showEditResult(src, merged, tool);
    return;
  }
  render();
}

async function runRelight(): Promise<void> {
  const src = state.editSource;
  if (!src) return;
  const prompt = state.editPromptEdit?.trim() || relightPrompt();
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
        toast("Click where each light goes. Esc to finish.", "ok");
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

/** History filtered by the project chip ("" = all). */
function shownHistory(): HistoryItem[] {
  const f = state.historyProject;
  return f === "" ? state.history : state.history.filter((x) => (x.project ?? "No project") === f);
}

async function setProject(name: string): Promise<void> {
  const s = state.settings;
  const clean = name.trim().slice(0, 60);
  s.project = clean;
  if (clean && !s.projects.includes(clean)) s.projects = [clean, ...s.projects].slice(0, 30);
  await persist();
  render();
  toast(clean ? `New renders go into "${clean}"` : "New renders go into No project", "ok");
}

/** Pick the project new renders are filed under, and filter History by project. */
function projectBar(): HTMLElement {
  const s = state.settings;
  const names = [...new Set([...s.projects, ...state.history.map((x) => x.project).filter((x): x is string => Boolean(x))])];
  const hasLoose = state.history.some((x) => !x.project);
  const input = h("input", { type: "text", placeholder: "New project, e.g. Borey Phase 2", maxlength: 60, "aria-label": "New project name" }) as HTMLInputElement;
  const add = () => input.value.trim() && setProject(input.value);
  input.addEventListener("keydown", (e) => e.key === "Enter" && add());
  const select = h(
    "select",
    { "aria-label": "Project for new renders" },
    h("option", { value: "", selected: !s.project }, "No project"),
    names.map((n) => h("option", { value: n, selected: n === s.project }, n)),
  ) as HTMLSelectElement;
  select.addEventListener("change", () => setProject(select.value));
  return section(
    "Projects",
    h("div", { class: "project-row" }, h("label", { class: "field grow" }, h("span", {}, "New renders go into"), select), h("div", { class: "project-new" }, input, button("Add", "plus", add, "ghost small"))),
    names.length
      ? h(
          "div",
          { class: "lib-chips", role: "group", "aria-label": "Show project" },
          chip("All", state.historyProject === "", () => ((state.historyProject = ""), render())),
          names.map((n) => chip(`${n} (${state.history.filter((x) => x.project === n).length})`, state.historyProject === n, () => ((state.historyProject = n), render()))),
          hasLoose ? chip("No project", state.historyProject === "No project", () => ((state.historyProject = "No project"), render())) : null,
        )
      : null,
  );
}

function historyTab(body: HTMLElement): void {
  if (!state.history.length) {
    body.append(
      h(
        "div",
        { class: "empty" },
        icon("history", 34),
        h("h2", {}, "Your renders will appear here"),
        h("p", {}, "Each one is saved with its before image, the prompt and what it cost, on this computer only. Make your first one in three steps: capture a view, pick a style, press Render."),
        h("div", { class: "row center" }, primaryButton("Start a render", "render", () => {
          state.tab = "render";
          render();
        })),
      ),
    );
    return;
  }
  const detail = h("div", {});
  body.append(projectBar(), spendingSection());
  const rated = ratingSummary(state.history).slice(0, 5);
  if (rated.length) {
    body.append(
      section(
        "What works for you",
        h("p", { class: "hint" }, "From your thumbs up and down on renders."),
        h(
          "table",
          { class: "rated" },
          h("tr", {}, h("th", {}, "Look"), h("th", {}, "Model"), h("th", {}, "Usable")),
          rated.map((r) => h("tr", {}, h("td", {}, r.preset), h("td", {}, r.model), h("td", {}, `${r.good} of ${r.good + r.bad}`))),
        ),
      ),
    );
  }
  body.append(
    h(
      "div",
      { class: "history-grid" },
      shownHistory().map((item) =>
        h(
          "button",
          {
            class: "thumb",
            type: "button",
            title: new Date(item.createdAt).toLocaleString(),
            onclick: () => {
              state.historyOpenId = item.id;
              clear(detail);
              detail.append(historyDetail(item));
              detail.scrollIntoView({ behavior: "smooth" });
            },
          },
          h("img", { src: toDataUrl(item.after), alt: item.presetName ?? item.tool, loading: "lazy" }),
          h("span", {}, `${item.pending ? "Finishing… " : ""}${item.rating === 1 ? "👍 " : item.rating === -1 ? "👎 " : ""}${item.presetName ?? toolLabel(item.tool)}`),
        ),
      ),
    ),
    detail,
  );
  const open = state.historyOpenId ? state.history.find((x) => x.id === state.historyOpenId) : undefined;
  if (open) {
    detail.append(historyDetail(open));
    if (scrollToDetail) requestAnimationFrame(() => detail.scrollIntoView({ block: "start" }));
  }
  scrollToDetail = false;
}

/** Credits spent from this app, from its own history. Kie has no API for the account log. */
function spendingSection(): HTMLElement {
  const month = new Date();
  month.setDate(1);
  month.setHours(0, 0, 0, 0);
  const paid = state.history.filter((x) => x.credits !== undefined);
  const sum = (list: HistoryItem[]) => list.reduce((n, x) => n + (x.credits ?? 0), 0);
  const thisMonth = paid.filter((x) => x.createdAt >= month.getTime());
  return section(
    "Credits used",
    h(
      "div",
      { class: "spend-row" },
      h("div", {}, h("strong", {}, sum(thisMonth).toLocaleString("en-US")), h("small", {}, "this month")),
      h("div", {}, h("strong", {}, sum(paid).toLocaleString("en-US")), h("small", {}, `all ${paid.length} Kie renders here`)),
      state.kieCredits !== null ? h("div", {}, h("strong", {}, Math.floor(state.kieCredits).toLocaleString("en-US")), h("small", {}, "left on Kie")) : null,
    ),
    h(
      "p",
      { class: "hint" },
      "Counted from renders made in this app on this computer. Kie does not let apps read your account log, so for every charge see the Logs tab on ",
      extLink("https://kie.ai", "kie.ai"),
      ".",
    ),
  );
}

function moveToProject(item: HistoryItem): HTMLElement | null {
  const names = [...new Set([...state.settings.projects, ...state.history.map((x) => x.project).filter((x): x is string => Boolean(x))])];
  if (!names.length) return null;
  const sel = h(
    "select",
    { "aria-label": "Project" },
    h("option", { value: "", selected: !item.project }, "No project"),
    names.map((n) => h("option", { value: n, selected: n === item.project }, n)),
  ) as HTMLSelectElement;
  sel.addEventListener("change", async () => {
    await addHistory({ ...item, project: sel.value || undefined });
    state.history = await listHistory();
    toast(sel.value ? `Moved to "${sel.value}"` : "Moved to No project", "ok");
    render();
  });
  return h("label", { class: "field" }, h("span", {}, "Project"), sel);
}

/** Set when History should scroll to the open item on its next draw. */
let scrollToDetail = false;

/** Style, notes and choices a render was made with, and a button to use them again. */
function setupBox(setup: RenderSetup): HTMLElement {
  const m = findKieModel(setup.kieModel);
  const dnaOn = setup.dna.filter((x) => x.on).length;
  const rows: [string, string][] = [
    ["Style", setup.preset.name],
    ["Look", setup.look === "cgi" ? "3D render" : "Photo"],
    ["Model", `${m.label} · ${setup.kieResolution}`],
    ["Frame", findFrame(setup.frameId).label],
  ];
  if (setup.notes.trim()) rows.push(["Notes", setup.notes.trim()]);
  if (setup.people.trim()) rows.push(["People", setup.people.trim()]);
  if (dnaOn) rows.push(["Materials", `${dnaOn} tag${dnaOn > 1 ? "s" : ""} from Material Scan`]);
  if (!setup.simple && Object.keys(setup.dynamic).length) rows.push(["Controls", "All controls settings saved"]);
  if (setup.promptEdit) rows.push(["Prompt", "Your own edited prompt"]);
  return h(
    "div",
    { class: "setup-box" },
    h("dl", {}, rows.flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, v)])),
    primaryButton("Use this setup", "check", () => void useSetup(setup)),
  );
}

function historyDetail(item: HistoryItem): HTMLElement {
  historyIds.set(item.after, item.id);
  const ratio = item.after.width && item.after.height ? item.after.width / item.after.height : 16 / 9;
  return section(
    `${toolLabel(item.tool)}${item.presetName ? ` · ${item.presetName}` : ""}`,
    h("p", { class: "hint" }, `${new Date(item.createdAt).toLocaleString()} · ${item.provider} · ${item.model}${item.credits !== undefined ? ` · ${item.credits} credits` : ""}${item.project ? ` · ${item.project}` : ""}`),
    item.pending ? h("p", { class: "notice" }, icon("info", 16), h("span", {}, "Still finishing on Kie.ai. It appears here when done, even after a restart.")) : null,
    moveToProject(item),
    // Fits the window: never taller than the screen, whatever the picture's shape.
    h("div", { class: "stage-frame history-frame", style: `max-width:min(100%, calc((100vh - 200px) * ${ratio.toFixed(4)}))` }, compareSlider(item.before, item.after)),
    resultActions(item.after, item.tool),
    item.setup ? setupBox(item.setup) : item.tool === "render" ? h("p", { class: "hint" }, "Made before History saved setups, so only the prompt is kept.") : null,
    h("details", {}, h("summary", {}, "Prompt used"), h("pre", {}, item.prompt)),
    button("Delete from history", "trash", async () => {
      if (state.historyOpenId === item.id) state.historyOpenId = null;
      await removeHistory(item.id);
      state.history = await listHistory();
      render();
    }, "ghost small"),
  );
}


// ---------- AI model picker (Kie.ai) ----------

/** Kie prices change often; the website keeps the current list, checked twice a day. */
const PRICES_URL = "https://phalldavid.github.io/AI-Tool-Suite/prices.json";
const PRICES_KEY = "airs.prices";

async function loadPrices(): Promise<void> {
  let cached: { at: number; list: PriceList } | null = null;
  try {
    cached = JSON.parse(localStorage.getItem(PRICES_KEY) ?? "null");
    if (cached?.list) applyPriceList(cached.list);
  } catch {
    cached = null;
  }
  if (cached && Date.now() - cached.at < 12 * 3600 * 1000) return;
  try {
    const res = await fetch(PRICES_URL, { cache: "no-store", signal: AbortSignal.timeout?.(8000) });
    if (!res.ok) return;
    const list = (await res.json()) as PriceList;
    const changed = applyPriceList(list);
    try {
      localStorage.setItem(PRICES_KEY, JSON.stringify({ at: Date.now(), list }));
    } catch {
      // Private mode: the built-in prices stay.
    }
    if (changed) render();
  } catch {
    // Offline: the built-in or last saved prices stay.
  }
}


function creditLabel(m: KieModel, res: KieResolution): string {
  const c = creditsFor(m, res);
  return c === null ? "price on kie.ai" : `${creditNumber(c)} credits`;
}

/** Sizes and credits in one line, e.g. "1K 6 · 2K 10 · 4K 16 credits". */
function sizeCredits(m: KieModel): string {
  const parts = m.resolutions.slice().sort().map((r) => {
    const c = m.credits?.[r];
    return c === undefined ? r : `${r} ${creditNumber(c)}`;
  });
  return m.credits ? `${parts.join(" · ")} credits` : `${m.resolutions.join(" / ")} · price on kie.ai`;
}

function logoMark(family: KieFamilyId, size = 18): HTMLElement {
  const el = h("span", { class: `model-logo ${family}`, "aria-hidden": "true" });
  el.innerHTML = modelLogo(family, size);
  return el;
}

/**
 * One card per model family, with a dropdown of its versions. The card
 * picks the family; the arrow opens the list underneath.
 */
function modelList(pick: (id: string) => void): HTMLElement {
  const s = state.settings;
  const hasKey = Boolean(s.kieKey.trim());
  const usingKie = s.backend === "kie" && hasKey;
  const current = findKieModel(s.kieModel);
  const open = state.modelMenu;
  const toggle = (f: KieFamilyId) => {
    state.modelMenu = state.modelMenu === f ? null : f;
    render();
  };
  const cards = KIE_FAMILIES.map((f) => {
    const list = modelsIn(f.id);
    const chosen = current.family === f.id ? current : list[0];
    const active = usingKie && current.family === f.id;
    return h(
      "div",
      { class: `model-fam${active ? " active" : ""}${open === f.id ? " open" : ""}${hasKey ? "" : " locked"}` },
      h("span", { class: "model-badge" }, f.badge),
      h(
        "button",
        {
          class: "model-fam-main",
          type: "button",
          role: "radio",
          "aria-checked": String(active),
          title: hasKey ? `${chosen.label}: ${chosen.note}. ${sizeCredits(chosen)}` : "Add your Kie.ai key in Settings to use this model",
          onclick: () => pick(chosen.id),
        },
        logoMark(f.id, 22),
        h("strong", {}, f.label),
        h("small", {}, `${chosen.short} · ${creditLabel(chosen, s.kieResolution)}`),
      ),
      list.length > 1
        ? h(
            "button",
            {
              class: "model-fam-more",
              type: "button",
              title: `${f.label} versions`,
              "aria-label": `${f.label} versions`,
              "aria-expanded": String(open === f.id),
              onclick: () => toggle(f.id),
            },
            icon("chevron", 14),
          )
        : null,
    );
  });
  const fam = open ? KIE_FAMILIES.find((f) => f.id === open) : undefined;
  const menu = fam
    ? h(
        "div",
        { class: "model-menu", role: "radiogroup", "aria-label": `${fam.label} models` },
        h("div", { class: "model-menu-head" }, logoMark(fam.id, 14), `${fam.label} models`),
        modelsIn(fam.id).map((m) => {
          const on = usingKie && m.id === current.id;
          return h(
            "button",
            {
              class: on ? "model-opt active" : "model-opt",
              type: "button",
              role: "radio",
              "aria-checked": String(on),
              onclick: () => {
                state.modelMenu = null;
                pick(m.id);
              },
            },
            logoMark(m.family, 16),
            h("span", { class: "model-opt-text" }, h("strong", {}, m.label), h("small", {}, `${sizeCredits(m)} · ${m.note}`)),
            h("i", { class: "model-dot", "aria-hidden": "true" }),
          );
        }),
      )
    : null;
  return h("div", { class: "model-list" }, h("div", { class: "model-grid", role: "radiogroup", "aria-label": "AI model" }, cards), menu);
}

/** Quick switch next to Render: the chosen model and size, opens the list in a sheet. */
function modelChip(): HTMLElement | null {
  const s = state.settings;
  if (s.backend !== "kie") return null;
  const m = findKieModel(s.kieModel);
  return h(
    "button",
    {
      class: "model-chip",
      type: "button",
      title: `${m.label} · ${resolutionFor(m, s.kieResolution)}. Click to change.`,
      "aria-label": `Model ${m.label}, ${resolutionFor(m, s.kieResolution)}. Change model`,
      onclick: () => {
        state.modelSheet = true;
        render();
      },
    },
    logoMark(m.family, 18),
    h("small", {}, resolutionFor(m, s.kieResolution)),
  );
}

/** The AI model section without its heading, for the sheet. */
function modelSheetBody(): HTMLElement {
  const sec = modelSection();
  sec.querySelector(".section-head")?.remove();
  sec.classList.add("plain");
  return sec;
}

function modelSheet(): HTMLElement {
  const close = () => {
    state.modelSheet = false;
    render();
  };
  return h(
    "div",
    { class: "sheet-backdrop", onclick: (e: Event) => e.target === e.currentTarget && close() },
    h(
      "div",
      { class: "sheet", role: "dialog", "aria-modal": "true", "aria-label": "Choose AI model" },
      h("div", { class: "sheet-head" }, h("h2", {}, "AI model"), iconButton("close", "Close", close)),
      modelSheetBody(),
      primaryButton(t("Done"), "check", close, false, "wide"),
    ),
  );
}

function modelSection(): HTMLElement {
  const s = state.settings;
  const hasKey = Boolean(s.kieKey.trim());
  const usingKie = s.backend === "kie" && hasKey;
  const current = findKieModel(s.kieModel);
  const pick = async (id: string) => {
    if (!hasKey) {
      state.settingsKie = true;
      return openSettings();
    }
    s.kieModel = id;
    s.backend = "kie";
    await persist();
    render();
  };
  const resolution = usingKie
    ? h(
        "div",
        { class: "model-res" },
        h("span", { class: "muted" }, "Output size"),
        segmented(
          current.resolutions.slice().sort().map((r) => ({ id: r, label: r })),
          current.resolutions.includes(s.kieResolution) ? s.kieResolution : current.resolutions[0],
          async (v) => {
            s.kieResolution = v;
            await persist();
            render();
          },
        ),
        current.resolutions.length < 3 ? h("small", { class: "muted" }, `${current.label}: ${current.resolutions.join(" / ")} only`) : null,
      )
    : null;
  const aside = hasKey
    ? usingKie
      ? h("span", { class: "muted small" }, "Kie.ai")
      : button("Use", null, () => pick(current.id), "ghost small")
    : button("Add Kie key", "key", () => {
        state.settingsKie = true;
        openSettings();
      }, "ghost small");
  const per = usingKie ? priceFor(current, s.kieResolution) : null;
  const count = s.backend === "browser"
    ? null
    : h(
        "div",
        { class: "model-res" },
        h("span", { class: "muted" }, "Images per render"),
        segmented(
          ["1", "2", "3", "4"].map((n) => ({ id: n, label: n })),
          String(s.imageCount),
          async (v) => {
            s.imageCount = Number(v);
            await persist();
            render();
          },
        ),
        per !== null && s.imageCount > 1 ? h("small", { class: "muted" }, `${creditNumber(renderCost() ?? 0)} credits per render`) : null,
      );
  return sectionWith(
    t("AI model"),
    aside,
    modelList(pick),
    resolution,
    count,
    !hasKey ? h("p", { class: "hint" }, "One Kie.ai key unlocks all of these. You pay Kie directly, per image.") : null,
  );
}


// ---------- Scene analysis: Material Scan and people ----------

/**
 * One key unlocks everything; a second key only makes it cheaper. A Gemini
 * key (free allowance on AI Studio) is used for analysis when present,
 * otherwise the Kie key's Gemini Flash.
 */
function pickAnalyser(): Analyser {
  const s = state.settings;
  if (s.testMode) return (prompt) => new Promise((r) => setTimeout(() => r(mockAnalysis(prompt)), 1500));
  if (s.geminiKey.trim()) return geminiAnalyser(s.geminiKey.trim());
  if (s.kieKey.trim()) return kieAnalyser(s.kieKey.trim(), host.kind === "sketchup" ? hostTransport(host) : undefined);
  throw new Error("Analysis needs a Kie.ai key or a Gemini API key. Add one in Settings.");
}

function analyserLabel(): string {
  const s = state.settings;
  if (s.testMode) return "test mode (sample answers, no key)";
  return s.geminiKey.trim() ? "your Gemini key (Google's free allowance)" : s.kieKey.trim() ? "your Kie.ai key (a fraction of a cent each)" : "a key you add in Settings";
}

/** Optional Gemini key in the Kie settings, used only for analysis. */
function analysisKeySection(): HTMLElement {
  const s = state.settings;
  const key = h("input", { type: "password", value: s.geminiKey, placeholder: "Optional: paste a Gemini API key", autocomplete: "off" }) as HTMLInputElement;
  key.addEventListener("change", async () => {
    s.geminiKey = key.value.trim();
    await persist();
    toast(s.geminiKey ? "Scene analysis now uses your Gemini key." : "Scene analysis now uses your Kie.ai key.", "ok");
    render();
  });
  return section(
    "Save money on analysis (optional)",
    h("label", { class: "field" }, h("span", {}, "Gemini API key"), key),
    h(
      "p",
      { class: "hint" },
      "Material Scan and Place People work with your Kie key alone. Add a free key from ",
      extLink("https://aistudio.google.com/apikey", "aistudio.google.com/apikey"),
      " and analysis runs on Google's free daily allowance instead. Renders still use Kie. Skip this and nothing is lost.",
    ),
  );
}

let analysing = false;

async function analyse(prompt: string, image?: ImageData64): Promise<string | null> {
  const src = image ?? state.capture?.view;
  if (!src) {
    toast("Capture a view or upload an image first.", "error");
    return null;
  }
  if (analysing) return null;
  if (!state.settings.testMode && !state.settings.kieKey.trim() && !state.settings.geminiKey.trim()) {
    toast("Analysis needs a Kie.ai key or a Gemini API key. Add one in Settings.", "error");
    return null;
  }
  analysing = true;
  try {
    const run = pickAnalyser();
    toast("Reading image...");
    for (const el of document.querySelectorAll(".analyse-preview")) el.append(h("div", { class: "scan" }));
    // 1024 px is plenty to read materials and keeps the upload small.
    const img = await shrinkJpeg(src, 1024, 0.85);
    return await run(prompt, img);
  } catch (e) {
    const who = state.settings.geminiKey.trim() ? "Gemini" : "Kie.ai";
    toast(`${who} couldn't read the image.`, "error", (e as Error).message);
    return null;
  } finally {
    analysing = false;
    for (const el of document.querySelectorAll(".analyse-preview .scan")) el.remove();
  }
}

/** The image the AI reads, shown in the analysis sheets so the scan is visible. */
function analysePreview(): HTMLElement | null {
  const src = state.capture?.view;
  return src ? h("div", { class: "analyse-preview" }, h("img", { src: toDataUrl(src), alt: "Image to analyse" })) : null;
}

function analysisFold(): HTMLElement {
  const tags = activeDna();
  const conflicts = dnaConflicts(state.notes, tags);
  const card = (id: "dna" | "people" | "scene", iconName: string, title: string, blurb: string, status: string, big = false) =>
    h(
      "button",
      {
        class: `dyn-card${status ? " active" : ""}${big ? " big" : ""}`,
        type: "button",
        onclick: () => {
          if (id === "dna" && state.settings.styleLock) {
            toast("Materials are locked. Unlock to change.");
            return;
          }
          state.analyseOpen = id;
          render();
        },
      },
      icon(iconName, 18),
      h("strong", {}, title),
      h("small", {}, status || blurb),
    );
  const sec = section(
    "Scene Analysis",
    h("p", { class: "hint" }, `The AI reads the image first, then writes the details into the prompt. Runs on ${analyserLabel()}.`),
    h(
      "div",
      { class: "dyn-grid" },
      card("scene", "wand", "Smart Detect", "Reads your image, says what it is (e.g. bathroom, Scandinavian) and sets the matching style and prompt.", "", true),
      card("dna", "palette", "Material Scan", "Lists every surface and its material, so the render keeps them.", state.settings.styleLock ? `Locked · ${tags.length} tags` : tags.length ? `${tags.length} material tags on` : ""),
      card("people", "eye", "Place People", "Looks at the space and writes where people go.", state.people.trim() ? "People line ready" : ""),
    ),
    conflicts.length
      ? h(
          "p",
          { class: "notice" },
          icon("info", 16),
          h("span", {}, `Your notes touch ${conflicts.length === 1 ? "a material tag" : `${conflicts.length} material tags`} (${conflicts.slice(0, 2).map((x) => `"${x.split(":")[0]}"`).join(", ")}). Your notes win over the tags.`),
        )
      : null,
  );
  const bits = [tags.length ? `${tags.length} tags` : "", state.people.trim() ? "people" : ""].filter(Boolean);
  return fold(sec, "analysis", bits.join(" · ") || "Off", false);
}

function dnaSheet(): HTMLElement {
  let work: DnaTag[] = (state.dnaDraft ?? state.dna).map((x) => ({ ...x }));
  let grouped = true;
  let raw = false;
  const close = (save: boolean) => {
    if (save) state.dna = work.filter((x) => x.text.trim());
    // What is in the box stays there for next time, applied or not.
    state.dnaDraft = save ? null : work.map((x) => ({ ...x }));
    state.analyseOpen = null;
    keepAnalysisDraft = null;
    render();
  };
  keepAnalysisDraft = () => (state.dnaDraft = work.map((x) => ({ ...x })));
  const list = h("div", { class: "dna-list" });
  const count = h("span", { class: "badge" });
  const find = h("input", { type: "text", placeholder: "Find", "aria-label": "Find in tags" }) as HTMLInputElement;
  const repl = h("input", { type: "text", placeholder: "Replace with", "aria-label": "Replace with" }) as HTMLInputElement;
  const row = (tag: DnaTag) => {
    const input = h("input", { type: "text", value: tag.text, "aria-label": "Material tag", class: tag.on ? "" : "off" }) as HTMLInputElement;
    input.addEventListener("input", () => (tag.text = input.value));
    return h(
      "div",
      { class: tag.on ? "dna-row" : "dna-row off" },
      h(
        "label",
        { class: "dna-check", title: tag.on ? "Used in the prompt" : "Left out" },
        h("input", {
          type: "checkbox",
          checked: tag.on,
          onchange: (e: Event) => {
            tag.on = (e.target as HTMLInputElement).checked;
            draw();
          },
        }),
        h("span", {}, icon("check", 12)),
      ),
      input,
      iconButton("trash", "Remove tag", () => {
        work = work.filter((x) => x !== tag);
        draw();
      }, "small"),
    );
  };
  const draw = () => {
    clear(list);
    count.textContent = `${work.filter((x) => x.on).length} of ${work.length} on`;
    if (!work.length) {
      list.append(
        h(
          "div",
          { class: "dna-empty" },
          icon("palette", 28),
          h("p", {}, fromModel ? "Read from model lists the materials SketchUp can see in your view: instant and free. Scan with AI reads the image instead, for photos and sketches. Edit, switch off or add tags before they go into the prompt." : "The AI looks at your image and writes one line per surface and object, like \"Floor: light grey porcelain tiles, matt\". Edit, switch off or add tags before they go into the prompt."),
        ),
      );
      return;
    }
    if (raw) {
      const ta = h("textarea", { rows: 14, "aria-label": "Material tags as text" }, work.map((x) => `${x.on ? "" : "# "}${x.text}`).join("\n")) as HTMLTextAreaElement;
      ta.addEventListener("change", () => {
        work = ta.value
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
          .map((l) => ({ ...newTag(l.replace(/^#\s*/, "")), on: !l.startsWith("#") }));
      });
      list.append(ta, h("p", { class: "hint" }, "One tag per line. Start a line with # to switch it off."));
      return;
    }
    if (!grouped) {
      list.append(...work.map(row));
      return;
    }
    const groups = [...DNA_GROUPS.map((g) => ({ id: g.id, label: g.label })), { id: "other", label: "Other" }];
    for (const g of groups) {
      const items = work.filter((x) => dnaGroup(x.text) === g.id);
      if (!items.length) continue;
      list.append(h("div", { class: "dna-group" }, h("h4", {}, g.label, h("em", {}, String(items.length))), ...items.map(row)));
    }
  };
  const viewSeg = () =>
    segmented(
      [
        { id: "zone", label: "By zone" },
        { id: "list", label: "List" },
        { id: "text", label: "Text" },
      ],
      raw ? "text" : grouped ? "zone" : "list",
      (v) => {
        raw = v === "text";
        grouped = v === "zone";
        segHolder.replaceChildren(viewSeg());
        draw();
      },
    );
  const segHolder = h("div", { class: "dna-view" }, viewSeg());
  // Model views read their materials straight from SketchUp: instant and
  // free. Photos and sketches need the AI.
  const fromModel = host.kind === "sketchup" && state.capture?.source === "sketchup";
  const readModel = async () => {
    try {
      toast("Reading model...");
      const list = await host.call<ModelMaterial[]>("modelMaterials", { ratio: findFrame(state.capturedFrameId || state.frameId).ratio });
      const lines = modelDnaTags(list ?? [], state.preset.projectType);
      if (!lines.length) return toast("No painted materials in view.", "error", "Every face in the view uses SketchUp's default material. Paint them, or use Scan with AI.");
      work = lines.map((l) => newTag(l));
      toast(`${lines.length} tags found`, "ok");
      draw();
    } catch (e) {
      toast("Couldn't read the model.", "error", (e as Error).message);
    }
  };
  const runAnalysis = async () => {
    const text = await analyse(dnaPrompt(state.preset.projectType));
    if (text === null) return;
    const tags = parseDna(text);
    if (!tags.length) return toast("No tags found. Try again.", "error");
    work = tags;
    toast(`${tags.length} tags found`, "ok");
    draw();
  };
  draw();
  const sheet = h(
    "div",
    { class: "sheet wide", role: "dialog", "aria-modal": "true" },
    h("div", { class: "sheet-head" }, h("h2", {}, "Material Scan"), count, iconButton("close", "Close", () => close(false))),
    analysePreview(),
    h(
      "div",
      { class: "dna-tools" },
      fromModel ? button("Read from model", "capture", readModel, "primary") : null,
      button(fromModel ? "Scan with AI" : "Scan image", "wand", runAnalysis, fromModel ? "ghost" : "primary"),
      segHolder,
    ),
    h(
      "div",
      { class: "dna-replace" },
      find,
      repl,
      button("Replace", "swap", () => {
        const f = find.value.trim();
        if (!f) return;
        const re = new RegExp(f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
        let n = 0;
        for (const x of work) {
          const next = x.text.replace(re, () => (n++, repl.value));
          x.text = next;
        }
        toast(n ? `Replaced ${n}.` : "Nothing matched.", n ? "ok" : "info");
        draw();
      }, "ghost small"),
    ),
    list,
    button("Add tag", "plus", () => {
      work.push(newTag("Object: material"));
      raw = false;
      draw();
      const inputs = list.querySelectorAll<HTMLInputElement>(".dna-row input[type=text]");
      inputs[inputs.length - 1]?.select();
    }, "ghost small"),
    h(
      "div",
      { class: "sheet-actions" },
      button("Clear all", "trash", () => {
        work = [];
        draw();
      }, "ghost"),
      primaryButton("Apply to prompt", "check", () => close(true)),
    ),
  );
  return h("div", { class: "sheet-backdrop", onclick: (e: Event) => e.target === e.currentTarget && close(false) }, sheet);
}

function openSceneScan(): void {
  if (state.settings.styleLock) return toast("The project look is locked. Unlock to change the style.");
  state.analyseOpen = "scene";
  render();
}

/** Smart Detect: the AI names the scene and style; you check it, then Apply sets the template. */
/** Set by the open analysis window: keeps what is in its box when it closes by Esc. */
let keepAnalysisDraft: (() => void) | null = null;

function sceneSheet(): HTMLElement {
  let result: SceneScan | null = state.sceneLast;
  const close = () => {
    state.analyseOpen = null;
    render();
  };
  const out = h("div", { class: "scene-result" }, h("p", { class: "hint" }, "Nothing yet. Press Detect scene."));
  const details = h("textarea", { rows: 3, placeholder: "What the AI saw in the image. Edit before you apply." }) as HTMLTextAreaElement;
  const apply = primaryButton("Apply", "check", async () => {
    if (!result) return;
    result.details = details.value.trim();
    state.sceneLast = result;
    rememberSetup();
    state.preset = scenePreset(result, state.preset);
    await persist();
    close();
    toast(`Style set: ${state.preset.name}`, "ok");
  });
  (apply as HTMLButtonElement).disabled = true;
  const draw = () => {
    clear(out);
    if (!result) return;
    const tpl = sceneTemplate(result);
    out.append(
      h("div", { class: "scene-chip" }, icon("check", 16), h("strong", {}, sceneLabel(result))),
      h("p", { class: "hint" }, tpl ? `Template: ${tpl.name}. You can still change it in Browse all after.` : "No matching template; only the scene type and what the AI saw are used."),
      h("label", { class: "field" }, h("span", {}, "Seen in the image (added to the style)"), details),
    );
    details.value = result.details;
    details.oninput = () => result && (result.details = details.value);
    (apply as HTMLButtonElement).disabled = false;
  };
  const sheet = h(
    "div",
    { class: "sheet", role: "dialog", "aria-modal": "true" },
    h("div", { class: "sheet-head" }, h("h2", {}, "Smart Detect"), iconButton("close", "Close", close)),
    analysePreview(),
    h("p", { class: "hint" }, `The AI says what the image is, for example "Interior · Bathroom · Scandinavian", and picks the matching style. Nothing changes until you press Apply. Runs on ${analyserLabel()}.`),
    button("Detect scene", "wand", async () => {
      const text = await analyse(scenePrompt());
      if (text === null) return;
      result = parseScene(text);
      state.sceneLast = result;
      if (!result) {
        return toast("Couldn't read the scene, try again", "error", `Smart Detect reply could not be read: ${text.slice(0, 300)}`);
      }
      draw();
      toast(sceneLabel(result), "ok");
    }, "primary"),
    out,
    h(
      "div",
      { class: "sheet-actions" },
      button("Clear", "trash", async () => {
        result = null;
        state.sceneLast = null;
        clear(out);
        out.append(h("p", { class: "hint" }, "Nothing yet. Press Detect scene."));
        (apply as HTMLButtonElement).disabled = true;
      }, "ghost"),
      button("Close", null, async () => close(), "ghost"),
      apply,
    ),
  );
  if (result) draw();
  return h("div", { class: "sheet-backdrop", onclick: (e: Event) => e.target === e.currentTarget && close() }, sheet);
}

function peopleSheet(): HTMLElement {
  const o = { ...state.peopleOpts };
  let text = state.peopleDraft ?? state.people;
  const close = (save: boolean) => {
    if (save) {
      state.people = text.trim();
      state.peopleOpts = o;
    }
    state.peopleDraft = save ? null : text;
    state.analyseOpen = null;
    keepAnalysisDraft = null;
    render();
  };
  keepAnalysisDraft = () => (state.peopleDraft = text);
  const ta = h("textarea", { rows: 6, placeholder: "Press Place people, or write the people yourself: who, where and doing what." }, text) as HTMLTextAreaElement;
  ta.addEventListener("input", () => (text = ta.value));
  const chips = (list: { id: string; label: string }[], key: keyof PeopleOptions) => {
    const wrap = h("div", { class: "chips" });
    const draw = () => {
      clear(wrap);
      for (const c of list) wrap.append(chip(c.label, o[key] === c.id, () => ((o[key] = c.id), draw())));
    };
    draw();
    return wrap;
  };
  const sheet = h(
    "div",
    { class: "sheet", role: "dialog", "aria-modal": "true" },
    h("div", { class: "sheet-head" }, h("h2", {}, "Place People"), iconButton("close", "Close", () => close(false))),
    analysePreview(),
    h("p", { class: "hint" }, "The AI looks at the actual space, then places people only where they could really stand or sit."),
    h("div", { class: "field" }, h("span", {}, "Type of space"), chips(PEOPLE_SCENES, "scene")),
    h("div", { class: "field" }, h("span", {}, "How many"), chips(PEOPLE_COUNTS, "count")),
    h("div", { class: "field" }, h("span", {}, "Who"), chips(PEOPLE_WHO, "who")),
    button("Place people", "wand", async () => {
      const out = await analyse(peoplePrompt(o));
      if (out === null) return;
      text = cleanPeople(out);
      ta.value = text;
      toast("People added", "ok");
    }, "primary"),
    h("label", { class: "field" }, h("span", {}, "People line in the prompt"), ta),
    h(
      "div",
      { class: "sheet-actions" },
      button("Clear", "trash", () => {
        text = "";
        ta.value = "";
      }, "ghost"),
      primaryButton("Apply to prompt", "check", () => close(true)),
    ),
  );
  return h("div", { class: "sheet-backdrop", onclick: (e: Event) => e.target === e.currentTarget && close(false) }, sheet);
}

// ---------- Settings sheet ----------

function settingsSheet(): HTMLElement {
  const s = state.settings;
  const close = () => {
    state.settingsOpen = false;
    state.settingsKie = false;
    render();
  };
  const sheet = h("div", { class: "sheet", role: "dialog", "aria-modal": "true" });
  sheet.append(
    h("div", { class: "sheet-head" }, h("h2", {}, t("Settings")), h("div", { class: "head-actions" }, iconButton("history", "Log", openLog), iconButton("close", "Close", close))),
    section(
      t("AI backend"),
      h("div", { class: "backend-pick" }, segmented(
        [
          { id: "kie", label: "Kie.ai key", icon: "key" },
          { id: "gemini", label: "Gemini key", icon: "key" },
          { id: "browser", label: "Browser (fallback)", icon: "eye" },
          { id: "comfyui", label: "ComfyUI", icon: "gear" },
        ],
        state.settingsKie ? "kie" : s.backend,
        async (v) => {
          s.backend = v as Settings["backend"];
          state.settingsKie = false;
          await persist();
          render();
        },
      )),
    ),
  );

  const view = state.settingsKie ? "kie" : s.backend;
  if (view === "kie") {
    const key = h("input", { type: "password", value: s.kieKey, placeholder: "Paste your Kie.ai API key", autocomplete: "off" }) as HTMLInputElement;
    key.addEventListener("change", async () => {
      s.kieKey = key.value.trim();
      // Adding a key means "render with Kie".
      if (s.kieKey) s.backend = "kie";
      state.settingsKie = false;
      state.kieKeyStatus = "unknown";
      await persist();
      render();
      refreshCredits();
    });
    sheet.append(
      section(
        "Kie.ai",
        h("label", { class: "field" }, h("span", {}, "API key"), key),
        h(
          "p",
          { class: "hint" },
          "One key for Nano Banana, GPT Image and Seedream. Get it at ",
          extLink(KIE_KEY_PAGE, "kie.ai/api-key"),
          ". Images are billed to your own Kie credits. The key stays on this computer only; it is never put in history or presets.",
        ),
        h("p", { class: "hint" }, "Pick the model on the Render tab, under AI model."),
        s.kieKey
          ? h(
              "div",
              { class: "row balance-row" },
              h("span", { class: "grow" }, state.kieCredits === null ? "Balance: not checked yet" : `Balance: ${creditText(state.kieCredits)} (about $${(state.kieCredits * USD_PER_CREDIT).toFixed(2)})`),
              button("Refresh", "refresh", async () => {
                await refreshCredits();
                if (state.kieCredits === null) toast("Couldn't get the balance.", "error");
                else toast(`Balance ${creditText(state.kieCredits)}`, "ok");
                render();
              }, "ghost small"),
            )
          : null,
        button("Test key", "check", async () => {
          try {
            s.kieKey = key.value.trim();
            if (s.kieKey) s.backend = "kie";
            state.settingsKie = false;
            await persist();
            toast("Checking key...");
            const msg = await makeProvider(s, host).test();
            if (s.backend === "kie") {
              state.kieKeyStatus = "ok";
              await refreshCredits();
            }
            render();
            toast(msg, "ok");
          } catch (e) {
            if (s.backend === "kie" && keyRejected(e)) {
              state.kieKeyStatus = "bad";
              state.kieCredits = null;
              render();
            }
            toast((e as Error).message, "error");
          }
        }, "ghost"),
      ),
      analysisKeySection(),
    );
  } else if (view === "browser") {
    sheet.append(
      section(
        "Your own account, in a browser window",
        h(
          "p",
          { class: "notice" },
          icon("info", 16),
          h("span", {}, "Fallback only. It types into Gemini, ChatGPT or Flow pages, which change without notice, so a step may need doing by hand. For steady work, use a Kie.ai key. Some Google accounts also refuse to sign in inside SketchUp."),
        ),
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
  } else if (view === "gemini") {
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
        h("p", { class: "hint" }, "Get a key at aistudio.google.com. This one key runs both renders and scene analysis. Google bills image generation to that key's account. Google does not share a balance through its API, so check spending at aistudio.google.com under Usage. The key is saved on this computer in plain text, so avoid saving it on a shared office PC."),
        h("label", { class: "field" }, h("span", {}, "Model"), modelSel),
        button("Test key and load models", "check", async () => {
          try {
            s.geminiKey = key.value.trim();
            await persist();
            toast("Checking key...");
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
  sheet.append(backupSection(), helpSection());
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
    if (f.kind === "text") {
      const input = h("input", { type: "text", value: (values[f.id] as string) ?? "", placeholder: f.placeholder ?? "", maxlength: 12, autocapitalize: "characters", spellcheck: false }) as HTMLInputElement;
      input.addEventListener("input", () => {
        values[f.id] = input.value;
        refresh();
      });
      fields.append(h("label", { class: "field" }, h("span", {}, f.label), input, h("small", { class: "muted" }, "AI models sometimes misspell plate text. Short plates (5 to 7 characters) come out best.")));
    } else if (f.kind === "one") {
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
    { class: "sheet", role: "dialog", "aria-modal": "true" },
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
      // Swap only the icon; the rest of the panel stays where it is.
      const ic = btn.querySelector(".icon");
      if (ic) ic.innerHTML = iconSvg(next === "dark" ? "moon" : "sun", 18);
      btn.title = next === "dark" ? "Switch to light mode" : "Switch to dark mode";
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
    { class: "sheet", role: "dialog", "aria-modal": "true" },
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
        customAccent(),
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
      state.settings.lang === "km" ? h("p", { class: "hint warn" }, "Khmer labels are a first draft and still need a check by a native speaker. Report any wrong wording with Report a bug.") : null,
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
  const lock = (label: string, tip: string, get: () => boolean, set: (v: boolean) => void) =>
    h(
      "label",
      { class: "switch", title: tip },
      h("input", {
        type: "checkbox",
        checked: get(),
        onchange: async (e: Event) => {
          set((e.target as HTMLInputElement).checked);
          await persist();
          updatePromptPreview();
        },
      }),
      h("span", { class: "track" }),
      label,
    );
  const locks = h(
    "div",
    { class: "lock-row" },
    lock("Material lock", "Keep every material and colour exactly as modelled", () => s.materialLock, (v) => (s.materialLock = v)),
    lock("Boundary lock", "Only improve realism inside each material's own area", () => s.boundaryLock, (v) => (s.boundaryLock = v)),
  );
  if (host.kind !== "sketchup") return sectionWith(t("Geometry"), null, locks);
  return sectionWith(
    t("Geometry"),
    null,
    locks,
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

function dialHour(id: string): { hour: number; live: boolean } {
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

let dialCount = 0;

/** Draggable sun. `get` and `set` read and write a lighting id. */
function sunDial(get: () => string = () => state.preset.lighting, set: (id: string) => void = (id) => (state.preset.lighting = id)): HTMLElement {
  const uid = `d${++dialCount}`;
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
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, class: "dial-svg", role: "slider", tabindex: 0, "aria-label": "Time of day, arrow keys move the sun" }) as SVGSVGElement;
  const defs = el("defs", {});
  const grad = el("linearGradient", { id: `${uid}-sky`, x1: 0, y1: 0, x2: 0, y2: 1 });
  const stopTop = el("stop", { offset: "0%" });
  const stopBot = el("stop", { offset: "100%" });
  grad.append(stopTop, stopBot);
  const glow = el("radialGradient", { id: `${uid}-glow` });
  const g0 = el("stop", { offset: "0%", "stop-opacity": 0.9 });
  const g1 = el("stop", { offset: "100%", "stop-opacity": 0 });
  glow.append(g0, g1);
  defs.append(grad, glow);
  svg.append(defs);
  svg.append(el("rect", { x: 0, y: 0, width: W, height: cy, rx: 10, fill: `url(#${uid}-sky)`, class: "dial-sky" }));
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
  const halo = el("circle", { r: 26, fill: `url(#${uid}-glow)` });
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
    svg.setAttribute("aria-valuetext", live ? `${fmtHour(hour)}, ${phase}` : "No fixed time");
    label.textContent = phase.toUpperCase();
    time.textContent = live ? fmtHour(hour) : "drag the sun to set a time";
    svg.classList.toggle("dim", !live);
    caption.textContent = live ? `${sunText(hour, month)}.` : "This light has no fixed sun position. Drag the sun to pick a time.";
  };
  const start = dialHour(get());
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
    set(id);
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
  // keyboard: arrows move 15 min (Shift for 1 h); the light cards refresh on blur
  let keyed = false;
  svg.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? 1 : 0.25;
    const now = dialHour(get()).hour;
    const next = e.key === "ArrowLeft" || e.key === "ArrowDown" ? now - step : e.key === "ArrowRight" || e.key === "ArrowUp" ? now + step : null;
    if (next === null) return;
    e.preventDefault();
    const id = dialTimeId(Math.max(DIAL_START, Math.min(DIAL_END, next)));
    set(id);
    draw(parseDialTime(id)!, true);
    updatePromptPreview();
    keyed = true;
  });
  svg.addEventListener("blur", () => {
    if (keyed) {
      keyed = false;
      render();
    }
  });
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
    { class: "sheet ctx-sheet", role: "dialog", "aria-modal": "true" },
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

function customAccent(): HTMLElement {
  const s = state.settings;
  const input = h("input", { type: "color", value: s.accentCustom, "aria-label": "Pick your own accent colour" }) as HTMLInputElement;
  input.addEventListener("input", () => {
    s.accent = "custom";
    s.accentCustom = input.value;
    applyLook(s);
  });
  input.addEventListener("change", async () => {
    await persist();
    render();
  });
  const a = accentFrom(s.accentCustom);
  return h(
    "label",
    { class: s.accent === "custom" ? "accent-dot custom active" : "accent-dot custom", style: `--dot:${a.color}`, title: "Your own colour" },
    h("i", {}),
    h("span", {}, "Custom"),
    input,
  );
}

// ---------- Scene light fixtures ----------

function tipButton(iconName: string, tip: string, active: boolean, onclick: () => void, extra = ""): HTMLElement {
  return h("button", { class: `fx-btn${active ? " active" : ""} ${extra}`, type: "button", "data-tip": tip, "aria-label": tip, "aria-pressed": active ? "true" : "false", onclick }, icon(iconName, 20));
}

function fixturesSection(): HTMLElement {
  const f = state.settings.fixtures;
  const type = state.preset.projectType;
  const save = () => {
    persist();
    render();
  };
  const kelvins = h(
    "div",
    { class: "fx-kelvins" },
    KELVINS.map((k) =>
      h(
        "button",
        {
          class: k === f.kelvin ? "fx-k active" : "fx-k",
          type: "button",
          "data-tip": `${k}K, ${kelvinLabel(k).toLowerCase()}`,
          "aria-label": `${k}K`,
          style: `--k:${rgbCss(kelvinToRgb(k))}`,
          onclick: () => {
            f.kelvin = k;
            save();
          },
        },
        h("i", {}),
      ),
    ),
  );
  let buttons: HTMLElement[];
  if (type === "interior") {
    buttons = [
      tipButton("downlight", "LED downlights", f.led, () => ((f.led = !f.led), save())),
      tipButton("strip", "LED light strip", f.strip, () => ((f.strip = !f.strip), save())),
      tipButton("cabinet", "Cabinet lights", f.cabinet, () => ((f.cabinet = !f.cabinet), save())),
    ];
  } else {
    buttons = [
      tipButton("bulb", "Exterior lights on", f.exterior === true, () => ((f.exterior = f.exterior === true ? null : true), save())),
      tipButton("bulbOff", "Exterior lights off", f.exterior === false, () => ((f.exterior = f.exterior === false ? null : false), save())),
    ];
  }
  const anyOn = type === "interior" ? f.led || f.strip || f.cabinet : f.exterior === true;
  return section(
    type === "interior" ? "Interior lights" : "Exterior lights",
    h("div", { class: "fx-row" }, buttons),
    anyOn ? kelvins : null,
  );
}

// ---------- First run ----------

// ---------- First-run tour: three steps, shown once ----------

const TOUR: { target: string; title: string; text: string }[] = [
  { target: ".stage-actions", title: "1. Capture a view", text: "Capture the SketchUp view, or upload a picture. You can crop it before it goes in." },
  { target: ".preset-grid, .lib-current, .style-section", title: "2. Pick a style", text: "Choose a starter look, or Browse all for every room and building type. Star the ones you like." },
  { target: ".render-btn", title: "3. Render", text: "The button shows what the render costs. Results land on the stage and in History." },
];

function endTour(): void {
  state.settings.tourDone = true;
  state.tourStep = 0;
  document.querySelector(".tour")?.remove();
  document.querySelectorAll(".tour-target").forEach((el) => el.classList.remove("tour-target"));
  persist();
}

let tourScrolled = -1;

function showTour(): void {
  const step = TOUR[state.tourStep];
  if (!step) return endTour();
  const target = document.querySelector(step.target);
  document.querySelectorAll(".tour-target").forEach((el) => el.classList.remove("tour-target"));
  target?.classList.add("tour-target");
  // Scroll only when the step changes, not on every redraw of the panel.
  if (tourScrolled !== state.tourStep) {
    tourScrolled = state.tourStep;
    target?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  const last = state.tourStep === TOUR.length - 1;
  const card = h(
    "div",
    { class: "tour", role: "dialog", "aria-live": "polite", "aria-label": "Quick tour" },
    h("div", { class: "tour-dots", "aria-hidden": "true" }, TOUR.map((_, i) => h("i", { class: i === state.tourStep ? "on" : "" }))),
    h("strong", {}, step.title),
    h("p", {}, step.text),
    h(
      "div",
      { class: "row" },
      button("Skip", null, endTour, "ghost small"),
      h("span", { class: "grow" }),
      button(last ? "Got it" : "Next", last ? "check" : "arrowRight", () => {
        if (last) return endTour();
        state.tourStep += 1;
        document.querySelector(".tour")?.remove();
        showTour();
      }, "primary small"),
    ),
  );
  document.querySelector(".tour")?.remove();
  root.append(card);
}

function onboarding(): HTMLElement {
  const s = state.settings;
  // Keys first: they are the steady way. The browser options copy into chat
  // sites whose pages change without notice, so they are the fallback.
  const choices: { id: string; label: string; sub: string; iconName: string; apply: () => void }[] = [
    { id: "kie", label: "Kie.ai key", sub: "Recommended · Nano Banana, GPT, Seedream", iconName: "key", apply: () => (s.backend = "kie") },
    { id: "key", label: "Gemini API key", sub: "From Google AI Studio", iconName: "key", apply: () => (s.backend = "gemini") },
    ...(host.kind === "sketchup"
      ? [
          { id: "b-gemini", label: "Gemini", sub: "Fallback · your Google account", iconName: "render", apply: () => ((s.backend = "browser"), (s.browserSite = "gemini")) },
          { id: "b-chatgpt", label: "ChatGPT", sub: "Fallback · your OpenAI account", iconName: "wand", apply: () => ((s.backend = "browser"), (s.browserSite = "chatgpt")) },
          { id: "b-flow", label: "Google Flow", sub: "Fallback · your Google account", iconName: "aerial", apply: () => ((s.backend = "browser"), (s.browserSite = "flow")) },
        ]
      : []),
    { id: "comfy", label: "ComfyUI", sub: "Local models on this PC", iconName: "gear", apply: () => (s.backend = "comfyui") },
  ];
  const picked =
    s.backend === "browser" ? `b-${s.browserSite}` : s.backend === "comfyui" ? "comfy" : s.backend === "kie" ? "kie" : s.backend === "gemini" && state.onboardStep > 0 ? "key" : state.onboardPick;
  const finish = async () => {
    s.onboarded = true;
    await persist();
    render();
    toast("All set", "ok");
  };
  // Lets people look around first; the top bar then says Not connected.
  const later = () =>
    button("Set up later", null, async () => {
      s.onboarded = true;
      // Kie is the recommended route, so that is what Settings opens on later.
      if (!s.kieKey && !s.geminiKey) s.backend = "kie";
      await persist();
      render();
      toast("You can add a key any time in Settings");
    }, "ghost");
  const card = h("div", { class: "onboard" });
  card.append(logo(40), h("h2", {}, "Welcome to David Render Studio"));
  if (state.onboardStep === 0) {
    card.append(
      h("p", { class: "hint" }, "Where should your renders be made? You can change this later in Settings."),
      h(
        "div",
        { class: "ob-grid" },
        choices.map((c) =>
          h(
            "button",
            {
              class: c.id === picked ? "ob-choice active" : "ob-choice",
              type: "button",
              onclick: () => {
                c.apply();
                state.onboardPick = c.id;
                render();
              },
            },
            icon(c.iconName, 22),
            h("strong", {}, c.label),
            h("small", {}, c.sub),
          ),
        ),
      ),
      primaryButton("Continue", "arrowRight", async () => {
        if (!picked) return toast("Pick one to continue.", "error");
        await persist();
        state.onboardStep = 1;
        render();
      }, !picked, "wide"),
      h("div", { class: "ob-later" }, later()),
    );
  } else {
    const back = button("Back", "arrowLeft", () => {
      state.onboardStep = 0;
      render();
    }, "ghost");
    if (s.backend === "browser") {
      const site = BROWSER_SITES.find((x) => x.id === s.browserSite) ?? BROWSER_SITES[0];
      card.append(
        h("p", { class: "hint" }, `Sign in to ${site.label} once in the window that opens. SketchUp remembers it, so next time the panel opens straight away.`),
        host.kind === "sketchup"
          ? primaryButton(`Open ${site.label} and sign in`, "eye", async () => {
              try {
                await host.call("browserOpen", { site: site.id });
              } catch (e) {
                toast((e as Error).message, "error");
              }
            }, false, "wide")
          : h("p", { class: "hint warn" }, "Account sign-in works inside the SketchUp plugin. In the web app, pick Gemini API key instead."),
        h("div", { class: "row" }, back, h("span", { class: "grow" }), later(), button("I've signed in", "check", finish, "primary")),
      );
    } else if (s.backend === "kie") {
      const key = h("input", { type: "password", value: s.kieKey, placeholder: "Paste your Kie.ai API key", autocomplete: "off" }) as HTMLInputElement;
      card.append(
        h(
          "p",
          { class: "hint" },
          "Get a key at ",
          extLink(KIE_KEY_PAGE, "kie.ai/api-key"),
          ". One key covers Nano Banana, GPT Image and Seedream, billed to your own Kie credits.",
        ),
        key,
        h(
          "div",
          { class: "row" },
          back,
          h("span", { class: "grow" }),
          later(),
          button("Test and finish", "check", async () => {
            s.kieKey = key.value.trim();
            if (!s.kieKey) return toast("Paste a key first.", "error");
            try {
              toast("Checking key...");
              toast(await makeProvider(s, host).test(), "ok");
              await finish();
            } catch (e) {
              toast((e as Error).message, "error");
            }
          }, "primary"),
        ),
      );
    } else if (s.backend === "gemini") {
      const key = h("input", { type: "password", value: s.geminiKey, placeholder: "Paste your Gemini API key", autocomplete: "off" }) as HTMLInputElement;
      card.append(
        h("p", { class: "hint" }, "Get a key at aistudio.google.com. Image generation is billed to that key's Google account."),
        key,
        h(
          "div",
          { class: "row" },
          back,
          h("span", { class: "grow" }),
          later(),
          button("Test and finish", "check", async () => {
            s.geminiKey = key.value.trim();
            if (!s.geminiKey) return toast("Paste a key first.", "error");
            try {
              toast("Checking key...");
              await new GeminiProvider(s.geminiKey).listImageModels();
              await finish();
            } catch (e) {
              toast((e as Error).message, "error");
            }
          }, "primary"),
        ),
      );
    } else {
      card.append(
        h("p", { class: "hint" }, "Start ComfyUI with --enable-cors-header, then paste your workflow in Settings. You can finish now and do that next."),
        h("div", { class: "row" }, back, h("span", { class: "grow" }), button("Finish", "check", async () => {
          await finish();
          openSettings();
        }, "primary")),
      );
    }
  }
  return h("div", { class: "onboard-backdrop" }, card);
}
