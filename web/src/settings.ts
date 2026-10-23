// User settings, stored through the host.

import type { Host } from "./host";
import type { Preset } from "./types";
import { DEFAULT_GEMINI_MODEL, GeminiProvider } from "./providers/gemini";
import { ComfyProvider } from "./providers/comfyui";
import type { Provider } from "./providers/types";

export interface Settings {
  backend: "gemini" | "comfyui";
  geminiKey: string;
  geminiModel: string;
  comfyUrl: string;
  comfyWorkflow: string;
  captureSize: number;
  linePass: boolean;
  /** Last chosen render frame (aspect ratio) id. */
  frameId?: string;
  userPresets: Preset[];
}

export const DEFAULT_SETTINGS: Settings = {
  backend: "gemini",
  geminiKey: "",
  geminiModel: DEFAULT_GEMINI_MODEL,
  comfyUrl: "http://127.0.0.1:8188",
  comfyWorkflow: "",
  captureSize: 1600,
  linePass: true,
  userPresets: [],
};

const KEY = "settings";

export async function loadSettings(host: Host): Promise<Settings> {
  try {
    const raw = await host.getSetting(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(host: Host, s: Settings): Promise<void> {
  await host.setSetting(KEY, JSON.stringify(s));
}

export function makeProvider(s: Settings): Provider & { modelName?: string } {
  if (s.backend === "comfyui") return new ComfyProvider(s.comfyUrl, s.comfyWorkflow);
  return new GeminiProvider(s.geminiKey.trim(), s.geminiModel.trim() || DEFAULT_GEMINI_MODEL);
}
