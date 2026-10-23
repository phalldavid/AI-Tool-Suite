// User settings, stored through the host.

import type { Host } from "./host";
import type { DynValues } from "./dynamic";
import { DEFAULT_AVOID, type FixtureSettings, type RenderLook } from "./prompt";
import type { ImageData64, Preset } from "./types";
import { DEFAULT_GEMINI_MODEL, GeminiProvider } from "./providers/gemini";
import { ComfyProvider } from "./providers/comfyui";
import { BrowserProvider } from "./providers/browser";
import { fetchTransport, hostTransport, KieProvider } from "./providers/kie";
import { DEFAULT_KIE_MODEL, type KieResolution } from "./providers/kie-models";
import type { Provider } from "./providers/types";

export interface Settings {
  /** "browser" renders through the user's own signed-in chat site, no API key. */
  /** "kie" renders through the user's own Kie.ai key (Nano Banana, GPT Image, Seedream). */
  backend: "gemini" | "comfyui" | "browser" | "kie";
  browserSite: BrowserSite;
  geminiKey: string;
  geminiModel: string;
  /** The user's own Kie.ai key. Kept in settings on this computer only, never in history or presets. */
  kieKey: string;
  kieModel: string;
  kieResolution: KieResolution;
  comfyUrl: string;
  comfyWorkflow: string;
  captureSize: number;
  linePass: boolean;
  /** Last chosen render frame (aspect ratio) id. */
  frameId?: string;
  userPresets: Preset[];
  /** Dynamic prompt generator values, by generator id. */
  dynamic: Record<string, DynValues>;
  /** How strictly renders follow the line drawing, 0..1. */
  lineStrength: number;
  theme: "dark" | "light";
  accent: string;
  font: string;
  lang: "en" | "km";
  /** Own accent colour, used when accent is "custom". */
  accentCustom: string;
  /** Light fixtures switched on in the scene. */
  fixtures: FixtureSettings;
  /** First-run setup finished. */
  onboarded: boolean;
  /** Spot edits send only the painted image. */
  singleImage: boolean;
  /** Photo or 3D render look. */
  look: RenderLook;
  materialLock: boolean;
  boundaryLock: boolean;
  /** "Avoid:" list added to the end of every render prompt. */
  avoid: string;
  /** Images per render, 1 to 4 (each one is billed). */
  imageCount: number;
  /** Quick render: starter looks and one button; everything else is under All controls. */
  simple: boolean;
  /** Project look reused for every view until unlocked. */
  styleLock: StyleLock | null;
}

/**
 * One look for a whole project, so every view of it matches: the preset
 * (materials, sky, surroundings), photo or 3D look, the material list and a
 * reference image, usually an approved render of the project.
 */
export interface StyleLock {
  preset: Preset;
  look: RenderLook;
  dna: string[];
  /** Kept small (JPEG, 768 px) so settings stay light. */
  reference: ImageData64 | null;
  referenceIsRender: boolean;
  savedAt: string;
}

export type BrowserSite = "gemini" | "chatgpt" | "flow";

export const BROWSER_SITES: { id: BrowserSite; label: string; url: string }[] = [
  { id: "gemini", label: "Gemini", url: "https://gemini.google.com/app" },
  { id: "chatgpt", label: "ChatGPT", url: "https://chatgpt.com/" },
  { id: "flow", label: "Google Flow", url: "https://labs.google/fx/tools/flow" },
];

export const DEFAULT_SETTINGS: Settings = {
  backend: "gemini",
  geminiKey: "",
  geminiModel: DEFAULT_GEMINI_MODEL,
  kieKey: "",
  kieModel: DEFAULT_KIE_MODEL,
  kieResolution: "2K",
  comfyUrl: "http://127.0.0.1:8188",
  comfyWorkflow: "",
  captureSize: 1600,
  linePass: true,
  userPresets: [],
  dynamic: {},
  lineStrength: 0.85,
  theme: "dark",
  accent: "amber",
  font: "system",
  lang: "en",
  accentCustom: "#e0679b",
  fixtures: { exterior: null, led: false, strip: false, cabinet: false, kelvin: 3000 },
  onboarded: false,
  singleImage: true,
  look: "photo",
  materialLock: false,
  boundaryLock: false,
  avoid: DEFAULT_AVOID,
  imageCount: 1,
  simple: true,
  styleLock: null,
  browserSite: "gemini",
};

const KEY = "settings";
const LEGACY_GEMINI_MODEL = "gemini-2.5-flash-image";

export async function loadSettings(host: Host): Promise<Settings> {
  try {
    const raw = await host.getSetting(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const saved = JSON.parse(raw) as Partial<Settings>;
    const s = { ...DEFAULT_SETTINGS, ...saved, fixtures: { ...DEFAULT_SETTINGS.fixtures, ...(saved.fixtures ?? {}) } };
    // People who set up a backend before first-run setup existed skip it.
    if (saved.onboarded === undefined) s.onboarded = Boolean(saved.geminiKey || saved.kieKey || (saved.backend && saved.backend !== "gemini"));
    // The old default image model is retired; move people who never changed it.
    if (s.geminiModel === LEGACY_GEMINI_MODEL) s.geminiModel = DEFAULT_GEMINI_MODEL;
    return s;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(host: Host, s: Settings): Promise<void> {
  await host.setSetting(KEY, JSON.stringify(s));
}

export function makeProvider(s: Settings, host?: Host): Provider & { modelName?: string } {
  if (s.backend === "browser" && host) {
    const site = BROWSER_SITES.find((x) => x.id === s.browserSite) ?? BROWSER_SITES[0];
    return new BrowserProvider(host, site.id, site.label);
  }
  if (s.backend === "kie") {
    const transport = host && host.kind === "sketchup" ? hostTransport(host) : fetchTransport;
    return new KieProvider(s.kieKey.trim(), s.kieModel, s.kieResolution, transport);
  }
  if (s.backend === "comfyui") return new ComfyProvider(s.comfyUrl, s.comfyWorkflow);
  return new GeminiProvider(s.geminiKey.trim(), s.geminiModel.trim() || DEFAULT_GEMINI_MODEL);
}
