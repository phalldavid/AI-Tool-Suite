// One file to move your setup between the SketchUp plugin and the web app
// (or to a new PC): presets, favourites, projects and choices. API keys are
// left out unless you tick the box.

import type { Settings } from "./settings";

const KEYS: (keyof Settings)[] = ["kieKey", "geminiKey"];
// Per-device or per-session values that should not travel.
const SKIP: (keyof Settings)[] = ["onboarded", "tourDone", "styleLock", "testMode"];

export interface BackupFile {
  app: "david-render-studio";
  kind: "settings";
  version: 1;
  savedAt: string;
  withKeys: boolean;
  settings: Partial<Settings>;
}

export function makeBackup(s: Settings, withKeys: boolean, now = new Date()): BackupFile {
  const copy: Partial<Settings> = { ...s };
  for (const k of SKIP) delete copy[k];
  if (!withKeys) for (const k of KEYS) delete copy[k];
  return { app: "david-render-studio", kind: "settings", version: 1, savedAt: now.toISOString(), withKeys, settings: copy };
}

/** Merges a backup into the current settings. Keys in the file replace yours only when present. */
export function applyBackup(current: Settings, raw: unknown): { settings: Settings; summary: string } {
  const f = raw as Partial<BackupFile>;
  if (!f || f.app !== "david-render-studio" || f.kind !== "settings" || typeof f.settings !== "object" || !f.settings) {
    throw new Error("This file isn't a David Render Studio settings file.");
  }
  const incoming = { ...f.settings } as Partial<Settings>;
  for (const k of SKIP) delete incoming[k];
  for (const k of KEYS) if (!incoming[k]) delete incoming[k];
  const presets = new Map([...current.userPresets, ...(incoming.userPresets ?? [])].map((p) => [p.id, p]));
  const favorites = [...new Set([...(incoming.favorites ?? []), ...current.favorites])];
  const projects = [...new Set([...(incoming.projects ?? []), ...current.projects])];
  const settings: Settings = { ...current, ...incoming, userPresets: [...presets.values()], favorites, projects };
  const bits = [`${presets.size} presets`, `${favorites.length} favourites`, `${projects.length} projects`];
  if (f.withKeys && (incoming.kieKey || incoming.geminiKey)) bits.push("API keys");
  return { settings, summary: bits.join(", ") };
}
