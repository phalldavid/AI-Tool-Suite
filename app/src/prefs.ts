// Look and feel: theme, accent, font, language, motion. Shared across tabs.

import { useSyncExternalStore } from "react";

export interface Prefs {
  theme: "dark" | "light" | "auto";
  accent: string;
  font: string;
  lang: "en" | "km";
  motion: "full" | "reduced";
}

export const ACCENTS: Record<string, { color: string; ink: string; label: string }> = {
  amber: { color: "#f0a24a", ink: "#1b1206", label: "Amber" },
  terracotta: { color: "#d9744a", ink: "#1f0c04", label: "Terracotta" },
  teal: { color: "#36b9a8", ink: "#03201c", label: "Teal" },
  blue: { color: "#5b9cff", ink: "#06142e", label: "Blue" },
  violet: { color: "#a184f7", ink: "#160a33", label: "Violet" },
  green: { color: "#6cc070", ink: "#062010", label: "Green" },
};

export const FONTS: Record<string, { stack: string; label: string }> = {
  system: { stack: "'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif", label: "System (Segoe UI)" },
  inter: { stack: "Inter, 'Segoe UI', 'Noto Sans Khmer', sans-serif", label: "Inter" },
  kantumruy: { stack: "'Kantumruy Pro', 'Segoe UI', sans-serif", label: "Kantumruy Pro (Khmer)" },
  notokhmer: { stack: "'Noto Sans Khmer', 'Segoe UI', sans-serif", label: "Noto Sans Khmer" },
  mono: { stack: "'IBM Plex Mono', Consolas, monospace", label: "IBM Plex Mono" },
};

const KEY = "drs2.prefs";
const DEFAULTS: Prefs = { theme: "dark", accent: "amber", font: "inter", lang: "en", motion: "full" };
let prefs: Prefs = load();
const listeners = new Set<() => void>();

function load(): Prefs {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return { ...DEFAULTS };
  }
}

export function getPrefs(): Prefs {
  return prefs;
}

export function isLight(p = prefs): boolean {
  return p.theme === "light" || (p.theme === "auto" && typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: light)").matches);
}

export function applyPrefs(): void {
  const root = document.documentElement;
  root.classList.toggle("light", isLight());
  root.classList.toggle("calm", prefs.motion === "reduced");
  const a = ACCENTS[prefs.accent] ?? ACCENTS.amber;
  root.style.setProperty("--accent", a.color);
  root.style.setProperty("--accent-ink", a.ink);
  root.style.setProperty("--font", (FONTS[prefs.font] ?? FONTS.inter).stack);
  root.lang = prefs.lang === "km" ? "km" : "en";
}

export function setPrefs(patch: Partial<Prefs>): void {
  prefs = { ...prefs, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* private mode: lasts for this visit */
  }
  applyPrefs();
  for (const l of listeners) l();
}

export function resetPrefs(): void {
  setPrefs({ ...DEFAULTS });
}

export function watchPrefs(): void {
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    prefs = load();
    applyPrefs();
    for (const l of listeners) l();
  });
  try {
    matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
      applyPrefs();
      for (const l of listeners) l();
    });
  } catch {
    /* old browser */
  }
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => prefs,
    () => prefs,
  );
}
