// User settings, stored through the host.

import type { Host } from "./host";
import type { DynValues } from "./dynamic";
import type { FixtureSettings } from "./prompt";
import type { Preset } from "./types";
import { DEFAULT_GEMINI_MODEL, GeminiProvider } from "./providers/gemini";
import { ComfyProvider } from "./providers/comfyui";
import { BrowserProvider } from "./providers/browser";
import type { Provider } from "./providers/types";

export interface Settings {
  /** "browser" renders through the user's own signed-in chat site, no API key. */
  backend: "gemini" | "comfyui" | "browser";
  browserSite: BrowserSite;
  geminiKey: string;
  geminiModel: string;
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
  browserSite: "gemini",
};

const KEY = "settings";

export async function loadSettings(host: Host): Promise<Settings> {
  try {
    const raw = await host.getSetting(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const saved = JSON.parse(raw) as Partial<Settings>;
    const s = { ...DEFAULT_SETTINGS, ...saved, fixtures: { ...DEFAULT_SETTINGS.fixtures, ...(saved.fixtures ?? {}) } };
    // People who set up a backend before first-run setup existed skip it.
    if (saved.onboarded === undefined) s.onboarded = Boolean(saved.geminiKey || (saved.backend && saved.backend !== "gemini"));
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
  if (s.backend === "comfyui") return new ComfyProvider(s.comfyUrl, s.comfyWorkflow);
  return new GeminiProvider(s.geminiKey.trim(), s.geminiModel.trim() || DEFAULT_GEMINI_MODEL);
}
