// The render suite interface. Same code in the SketchUp panel and the browser.

import { clear, field, h, select } from "./dom";
import { detectHost, type Host } from "./host";
import { addHistory, listHistory, removeHistory } from "./history";
import {
  compositeMasked,
  fileToImage,
  imageSize,
  redOverlay,
  resizeTo,
  toDataUrl,
} from "./images";
import { BUILT_IN_PRESETS, newPresetId, parsePresetFile } from "./presets";
import {
  ENVIRONMENTS,
  LIGHTING,
  PROJECT_TYPES,
  buildLightingPrompt,
  buildRenderPrompt,
  buildSpotEditPrompt,
  nearestAspectRatio,
} from "./prompt";
import { GeminiProvider } from "./providers/gemini";
import { loadSettings, makeProvider, saveSettings, type Settings } from "./settings";
import type { Capture, HistoryItem, ImageData64, Preset, ToolId } from "./types";

type Tab = "render" | "edit" | "history" | "settings";

interface State {
  tab: Tab;
  settings: Settings;
  capture: Capture | null;
  preset: Preset;
  notes: string;
  result: ImageData64 | null;
  editSource: ImageData64 | null;
  editMode: "spot" | "relight";
  editInstruction: string;
  relight: string;
  history: HistoryItem[];
  busy: boolean;
  abort: AbortController | null;
  status: { text: string; error?: boolean } | null;
}

let host: Host;
let state: State;
let root: HTMLElement;
let maskCanvas: HTMLCanvasElement | null = null;

export async function start(el: HTMLElement): Promise<void> {
  root = el;
  host = detectHost();
  const settings = await loadSettings(host);
  state = {
    tab: settings.geminiKey || settings.backend === "comfyui" ? "render" : "settings",
    settings,
    capture: null,
    preset: { ...BUILT_IN_PRESETS[0] },
    notes: "",
    result: null,
    editSource: null,
    editMode: "spot",
    editInstruction: "",
    relight: "blue-hour",
    history: await listHistory(),
    busy: false,
    abort: null,
    status: null,
  };
  document.body.dataset.host = host.kind;
  render();
}

function allPresets(): Preset[] {
  return [...BUILT_IN_PRESETS.map((p) => ({ ...p, builtIn: true })), ...state.settings.userPresets];
}

function setStatus(text: string, error = false): void {
  state.status = { text, error };
  const bar = document.getElementById("status");
  if (bar) {
    bar.textContent = text;
    bar.className = error ? "status error" : "status";
  }
}

async function persist(): Promise<void> {
  await saveSettings(host, state.settings);
}

// ---------- layout ----------

function render(): void {
  clear(root);
  const tabs: { id: Tab; label: string }[] = [
    { id: "render", label: "Render" },
    { id: "edit", label: "Edit" },
    { id: "history", label: `History${state.history.length ? ` (${state.history.length})` : ""}` },
    { id: "settings", label: "Settings" },
  ];
  root.append(
    h(
      "nav",
      { class: "tabs" },
      tabs.map((t) =>
        h(
          "button",
          {
            class: t.id === state.tab ? "tab active" : "tab",
            onclick: () => {
              state.tab = t.id;
              render();
            },
          },
          t.label,
        ),
      ),
    ),
  );
  const body = h("main", { class: "body" });
  if (state.tab === "render") renderTab(body);
  if (state.tab === "edit") editTab(body);
  if (state.tab === "history") historyTab(body);
  if (state.tab === "settings") settingsTab(body);
  root.append(body);
  root.append(
    h(
      "footer",
      { class: "footer" },
      h("div", { id: "status", class: state.status?.error ? "status error" : "status" }, state.status?.text ?? ""),
      state.busy && state.abort ? h("button", { class: "ghost", onclick: () => state.abort?.abort() }, "Cancel") : null,
    ),
  );
}

// ---------- Render tab ----------

function sourcePicker(onPicked: (img: ImageData64, capture?: Capture) => void): HTMLElement {
  const fileInput = h("input", { type: "file", accept: "image/*", class: "hidden" }) as HTMLInputElement;
  fileInput.addEventListener("change", async () => {
    const f = fileInput.files?.[0];
    if (!f) return;
    const img = await fileToImage(f);
    onPicked(img, { view: img, source: "upload" });
  });
  const row = h("div", { class: "row" });
  if (host.kind === "sketchup") {
    row.append(
      h(
        "button",
        {
          class: "primary",
          disabled: state.busy,
          onclick: async () => {
            try {
              setStatus("Capturing the SketchUp view...");
              const cap = await host.capture({
                size: state.settings.captureSize,
                linePass: state.settings.linePass,
                mask: false,
              });
              setStatus(describeCapture(cap));
              onPicked(cap.view, cap);
            } catch (e) {
              setStatus((e as Error).message, true);
            }
          },
        },
        "Capture view",
      ),
    );
  }
  row.append(h("button", { onclick: () => fileInput.click(), disabled: state.busy }, "Upload image"), fileInput);
  return row;
}

function describeCapture(cap: Capture): string {
  const f = cap.facts;
  const bits = [`Captured ${cap.view.width ?? "?"} x ${cap.view.height ?? "?"} px`];
  if (f?.sceneName) bits.push(`scene "${f.sceneName}"`);
  if (f?.focalLengthMm) bits.push(`${f.focalLengthMm} mm lens`);
  if (cap.lines) bits.push("with line pass");
  return bits.join(", ") + ".";
}

function renderTab(body: HTMLElement): void {
  const p = state.preset;

  body.append(
    h("section", { class: "card" }, h("h2", {}, "1. Source"), sourcePicker((img, cap) => {
      state.capture = cap ?? { view: img, source: "upload" };
      state.result = null;
      render();
    }), state.capture ? h("img", { class: "preview", src: toDataUrl(state.capture.view), alt: "Source view" }) : h("p", { class: "muted" }, host.kind === "sketchup" ? "Frame your camera in SketchUp, then capture the view." : "Upload a SketchUp export, CAD view, photo or iPad sketch.")),
  );

  const presetOptions = allPresets().map((x) => ({ value: x.id, label: x.builtIn ? x.name : `${x.name} (mine)` }));
  const styleBox = h("textarea", { rows: 4, placeholder: "Materials, e.g. board-formed concrete, terracotta tiles, timber louvers" }, p.style) as HTMLTextAreaElement;
  styleBox.addEventListener("input", () => {
    state.preset.style = styleBox.value;
    updatePromptPreview();
  });
  const notesBox = h("textarea", { rows: 2, placeholder: "Anything specific for this view" }, state.notes) as HTMLTextAreaElement;
  notesBox.addEventListener("input", () => {
    state.notes = notesBox.value;
    updatePromptPreview();
  });

  const settingsCard = h(
    "section",
    { class: "card" },
    h("h2", {}, "2. Settings"),
    field(
      "Preset",
      select(presetOptions, p.id, (id) => {
        const found = allPresets().find((x) => x.id === id);
        if (found) state.preset = { ...found };
        render();
      }),
    ),
    h(
      "div",
      { class: "grid3" },
      field(
        "Project type",
        select(
          Object.values(PROJECT_TYPES).map((o) => ({ value: o.id, label: o.label })),
          p.projectType,
          (v) => {
            state.preset.projectType = v as Preset["projectType"];
            updatePromptPreview();
          },
        ),
      ),
      field(
        "Lighting",
        select(LIGHTING.map((o) => ({ value: o.id, label: o.label })), p.lighting, (v) => {
          state.preset.lighting = v;
          updatePromptPreview();
        }),
      ),
      field(
        "Environment",
        select(ENVIRONMENTS.map((o) => ({ value: o.id, label: o.label })), p.environment, (v) => {
          state.preset.environment = v;
          updatePromptPreview();
        }),
      ),
    ),
    field("Materials and style", styleBox),
    field("Notes for this view", notesBox),
    h(
      "div",
      { class: "row" },
      h("button", { onclick: savePresetAs }, "Save as preset"),
      p.builtIn ? null : h("button", { class: "ghost", onclick: deletePreset }, "Delete preset"),
      h("button", { class: "ghost", onclick: exportPresets }, "Export presets"),
      importButton(),
    ),
    h("details", {}, h("summary", {}, "Show prompt"), h("pre", { id: "prompt-preview" }, currentRenderPrompt())),
  );
  body.append(settingsCard);

  body.append(
    h(
      "section",
      { class: "card" },
      h("h2", {}, "3. Render"),
      h(
        "button",
        { class: "primary wide", disabled: state.busy || !state.capture, onclick: runRender },
        state.busy ? "Rendering..." : "Render",
      ),
      state.result && state.capture ? resultBlock(state.capture.view, state.result, "render") : null,
    ),
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

function resultBlock(before: ImageData64, after: ImageData64, tool: ToolId): HTMLElement {
  return h(
    "div",
    { class: "result" },
    compareSlider(before, after),
    h(
      "div",
      { class: "row" },
      h("button", { class: "primary", onclick: () => saveImage(after, tool) }, host.kind === "sketchup" ? "Save next to model" : "Download"),
      h(
        "button",
        {
          onclick: () => {
            state.editSource = after;
            maskCanvas = null;
            state.tab = "edit";
            render();
          },
        },
        "Edit this render",
      ),
      host.kind === "sketchup" ? h("button", { class: "ghost", onclick: () => host.openRenderFolder() }, "Open folder") : null,
    ),
  );
}

function compareSlider(before: ImageData64, after: ImageData64): HTMLElement {
  const beforeImg = h("img", { src: toDataUrl(before), alt: "Before" });
  const clip = h("div", { class: "compare-before" }, beforeImg);
  const range = h("input", { type: "range", min: 0, max: 100, value: 50, class: "compare-range", "aria-label": "Before and after" }) as HTMLInputElement;
  const set = () => (clip.style.width = `${range.value}%`);
  range.addEventListener("input", set);
  const wrap = h("div", { class: "compare" }, h("img", { src: toDataUrl(after), alt: "After" }), clip, range);
  // Keep the before image the same size as the frame while its container is clipped.
  const sync = () => (beforeImg.style.width = `${wrap.clientWidth}px`);
  requestAnimationFrame(sync);
  window.addEventListener("resize", sync);
  set();
  return wrap;
}

async function saveImage(img: ImageData64, tool: ToolId): Promise<void> {
  try {
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    const name = `${tool}_${state.capture?.facts?.sceneName || state.preset.name}_${stamp}`.replace(/[^\w.-]+/g, "_");
    const where = await host.save(img, name);
    setStatus(`Saved ${where}`);
  } catch (e) {
    setStatus((e as Error).message, true);
  }
}

async function runProvider(
  tool: ToolId,
  prompt: string,
  images: ImageData64[],
  aspectRatio?: string,
): Promise<ImageData64 | null> {
  const provider = makeProvider(state.settings);
  state.busy = true;
  // Older SketchUp versions embed a Chromium without AbortController.
  state.abort = typeof AbortController === "undefined" ? null : new AbortController();
  render();
  setStatus(`Sending to ${provider.label}...`);
  const t0 = Date.now();
  try {
    const res = await provider.render({ prompt, images, aspectRatio }, state.abort?.signal);
    setStatus(`Done in ${Math.round((Date.now() - t0) / 1000)} s.`);
    return res.image;
  } catch (e) {
    const err = e as Error;
    setStatus(err.name === "AbortError" ? "Cancelled." : err.message, err.name !== "AbortError");
    return null;
  } finally {
    state.busy = false;
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
  const out = await runProvider("render", prompt, images, nearestAspectRatio(size.width, size.height));
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
  setStatus(`Saved preset "${name}".`);
  render();
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
  if (!state.settings.userPresets.length) setStatus("No saved presets yet; the exported file is empty.");
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
      setStatus(`Imported ${found.length} preset${found.length === 1 ? "" : "s"}.`);
      render();
    } catch {
      setStatus("That file is not a preset file.", true);
    }
  });
  return h("span", {}, h("button", { class: "ghost", onclick: () => input.click() }, "Import presets"), input);
}

// ---------- Edit tab ----------

function editTab(body: HTMLElement): void {
  body.append(
    h(
      "section",
      { class: "card" },
      h("h2", {}, "Image to edit"),
      sourcePicker((img) => {
        state.editSource = img;
        maskCanvas = null;
        render();
      }),
      state.editSource ? null : h("p", { class: "muted" }, "Pick a render from Render or History, or upload one."),
    ),
  );
  if (!state.editSource) return;
  const src = state.editSource;

  const modeRow = h(
    "div",
    { class: "segmented" },
    h("button", { class: state.editMode === "spot" ? "active" : "", onclick: () => { state.editMode = "spot"; render(); } }, "Spot edit"),
    h("button", { class: state.editMode === "relight" ? "active" : "", onclick: () => { state.editMode = "relight"; render(); } }, "Change lighting"),
  );

  const card = h("section", { class: "card" }, modeRow);
  if (state.editMode === "spot") {
    card.append(h("p", { class: "muted" }, "Paint over the area to change, then describe the change. Everything outside the painted area stays exactly as it is."));
    card.append(paintArea(src));
    const instr = h("textarea", { rows: 2, placeholder: "e.g. replace the car with a parked Honda Dream motorbike" }, state.editInstruction) as HTMLTextAreaElement;
    instr.addEventListener("input", () => (state.editInstruction = instr.value));
    card.append(field("What should change", instr));
    card.append(h("button", { class: "primary wide", disabled: state.busy, onclick: runSpotEdit }, state.busy ? "Working..." : "Apply edit"));
  } else {
    card.append(h("img", { class: "preview", src: toDataUrl(src), alt: "Image to relight" }));
    card.append(field("New lighting", select(LIGHTING.map((o) => ({ value: o.id, label: o.label })), state.relight, (v) => (state.relight = v))));
    const notes = h("textarea", { rows: 2, placeholder: "Optional, e.g. wet road after rain" }, state.editInstruction) as HTMLTextAreaElement;
    notes.addEventListener("input", () => (state.editInstruction = notes.value));
    card.append(field("Notes", notes));
    card.append(h("button", { class: "primary wide", disabled: state.busy, onclick: runRelight }, state.busy ? "Working..." : "Change lighting"));
  }
  body.append(card);
}

function paintArea(src: ImageData64): HTMLElement {
  const img = h("img", { src: toDataUrl(src), alt: "Image to edit" }) as HTMLImageElement;
  const canvas = maskCanvas ?? (h("canvas", { class: "paint" }) as HTMLCanvasElement);
  canvas.className = "paint";
  const brush = h("input", { type: "range", min: 5, max: 200, value: 40 }) as HTMLInputElement;
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
    ctx.fillStyle = "rgb(255,0,0)";
    ctx.lineWidth = Number(brush.value) * scale;
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
    {},
    wrap,
    h(
      "div",
      { class: "row" },
      h("span", { class: "muted" }, "Brush"),
      brush,
      h("button", { class: "ghost", onclick: () => canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height) }, "Clear"),
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
  if (maskIsEmpty(maskCanvas)) return setStatus("Paint over the area you want to change first.", true);
  if (!state.editInstruction.trim()) return setStatus("Describe what should change.", true);
  const prompt = buildSpotEditPrompt(state.editInstruction);
  const overlay = await redOverlay(src, maskCanvas);
  const size = await imageSize(src);
  const out = await runProvider("spot-edit", prompt, [src, overlay], nearestAspectRatio(size.width, size.height));
  if (out) {
    const fitted = await resizeTo(out, size.width, size.height);
    const merged = await compositeMasked(src, fitted, maskCanvas);
    await record("spot-edit", prompt, src, merged);
    state.editSource = merged;
    state.result = merged;
    maskCanvas = null;
    showResultInEdit(src, merged, "spot-edit");
    return;
  }
  render();
}

async function runRelight(): Promise<void> {
  const src = state.editSource;
  if (!src) return;
  const prompt = buildLightingPrompt(state.relight, state.editInstruction);
  const size = await imageSize(src);
  const out = await runProvider("lighting", prompt, [src], nearestAspectRatio(size.width, size.height));
  if (out) {
    await record("lighting", prompt, src, out);
    showResultInEdit(src, out, "lighting");
    return;
  }
  render();
}

function showResultInEdit(before: ImageData64, after: ImageData64, tool: ToolId): void {
  render();
  const body = root.querySelector("main");
  body?.append(h("section", { class: "card" }, h("h2", {}, "Result"), resultBlock(before, after, tool)));
}

// ---------- History tab ----------

function historyTab(body: HTMLElement): void {
  if (!state.history.length) {
    body.append(h("p", { class: "muted" }, "Renders you make appear here. They are kept on this computer only."));
    return;
  }
  const detail = h("div", {});
  const grid = h(
    "div",
    { class: "history-grid" },
    state.history.map((item) =>
      h(
        "button",
        {
          class: "thumb",
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
  );
  body.append(grid, detail);
}

function toolLabel(t: ToolId): string {
  return t === "render" ? "Render" : t === "lighting" ? "Lighting" : "Spot edit";
}

function historyDetail(item: HistoryItem): HTMLElement {
  return h(
    "section",
    { class: "card" },
    h("h2", {}, `${toolLabel(item.tool)}${item.presetName ? `: ${item.presetName}` : ""}`),
    h("p", { class: "muted" }, `${new Date(item.createdAt).toLocaleString()} · ${item.provider} · ${item.model}`),
    resultBlock(item.before, item.after, item.tool),
    h("details", {}, h("summary", {}, "Prompt used"), h("pre", {}, item.prompt)),
    h(
      "button",
      {
        class: "ghost",
        onclick: async () => {
          await removeHistory(item.id);
          state.history = await listHistory();
          render();
        },
      },
      "Delete from history",
    ),
  );
}

// ---------- Settings tab ----------

function settingsTab(body: HTMLElement): void {
  const s = state.settings;
  const card = h("section", { class: "card" }, h("h2", {}, "Backend"));
  card.append(
    h(
      "div",
      { class: "segmented" },
      h("button", { class: s.backend === "gemini" ? "active" : "", onclick: async () => { s.backend = "gemini"; await persist(); render(); } }, "Gemini (your key)"),
      h("button", { class: s.backend === "comfyui" ? "active" : "", onclick: async () => { s.backend = "comfyui"; await persist(); render(); } }, "ComfyUI (local)"),
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
    card.append(
      field("API key", key, "Get a key at aistudio.google.com. Google bills image generation to that key's account. The key is saved on this computer in plain text, so avoid saving it on a shared office PC."),
      field("Model", modelSel),
      h(
        "div",
        { class: "row" },
        h(
          "button",
          {
            onclick: async () => {
              try {
                setStatus("Checking the key...");
                const gp = new GeminiProvider(s.geminiKey);
                const models = await gp.listImageModels();
                clear(modelSel);
                const list = models.includes(s.geminiModel) || !models.length ? models : [s.geminiModel, ...models];
                for (const m of list.length ? list : [s.geminiModel]) modelSel.append(h("option", { value: m, selected: m === s.geminiModel }, m));
                setStatus(models.length ? `Key works. ${models.length} image model${models.length === 1 ? "" : "s"} found.` : "Key works, but no image models were listed for it.");
              } catch (e) {
                setStatus((e as Error).message, true);
              }
            },
          },
          "Test key and load models",
        ),
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
    card.append(
      h("p", { class: "muted" }, "Experimental. Start ComfyUI with --enable-cors-header. In ComfyUI, build your workflow, put {{PROMPT}} in the positive prompt, {{IMAGE_1}} as the Load Image file name (and {{IMAGE_2}} for the line pass), then use Export (API) and paste the file here."),
      field("ComfyUI address", url),
      field("Workflow (API format)", wf),
      h(
        "button",
        {
          onclick: async () => {
            try {
              setStatus(await makeProvider(s).test());
            } catch (e) {
              setStatus((e as Error).message, true);
            }
          },
        },
        "Test connection",
      ),
    );
  }
  body.append(card);

  if (host.kind === "sketchup") {
    const lp = h("input", { type: "checkbox", checked: s.linePass }) as HTMLInputElement;
    lp.addEventListener("change", async () => {
      s.linePass = lp.checked;
      await persist();
    });
    body.append(
      h(
        "section",
        { class: "card" },
        h("h2", {}, "SketchUp capture"),
        field(
          "Long side of the capture",
          select(
            [1280, 1600, 2048].map((n) => ({ value: String(n), label: `${n} px` })),
            String(s.captureSize),
            async (v) => {
              s.captureSize = Number(v);
              await persist();
            },
          ),
        ),
        h("label", { class: "check" }, lp, " Also send a hidden-line pass to hold the geometry"),
      ),
    );
  }
}

// Exposed for the SketchUp toolbar "Render now" button.
export async function captureFromHost(): Promise<void> {
  if (host.kind !== "sketchup") return;
  try {
    const cap = await host.capture({ size: state.settings.captureSize, linePass: state.settings.linePass, mask: false });
    state.capture = cap;
    state.result = null;
    state.tab = "render";
    render();
    setStatus(describeCapture(cap));
  } catch (e) {
    setStatus((e as Error).message, true);
  }
}
