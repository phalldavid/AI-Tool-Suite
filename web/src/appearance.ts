// Look of the panel: dark or light theme, accent colour, font. Applied as
// CSS variables on <html>, so nothing else needs to know.

export type Theme = "dark" | "light";

export interface Accent {
  id: string;
  label: string;
  color: string;
  hover: string;
  ink: string;
}

export const ACCENTS: Accent[] = [
  { id: "amber", label: "Amber", color: "#f0a24a", hover: "#ffb866", ink: "#1b1206" },
  { id: "terracotta", label: "Terracotta", color: "#d9744a", hover: "#e98a62", ink: "#1f0c04" },
  { id: "teal", label: "Teal", color: "#36b9a8", hover: "#4fd0bf", ink: "#03201c" },
  { id: "blue", label: "Blue", color: "#5b9cff", hover: "#7cb1ff", ink: "#06142e" },
  { id: "violet", label: "Violet", color: "#a184f7", hover: "#b9a2ff", ink: "#160a33" },
  { id: "green", label: "Green", color: "#6cc070", hover: "#86d48a", ink: "#062010" },
];

export interface FontChoice {
  id: string;
  label: string;
  stack: string;
  /** Google Fonts family to load, if any (needs internet the first time). */
  google?: string;
}

const KHMER_FALLBACK = '"Kantumruy Pro", "Khmer UI", "Leelawadee UI", "Noto Sans Khmer"';

export const FONTS: FontChoice[] = [
  { id: "system", label: "System (Segoe UI)", stack: `"Segoe UI Variable Text", "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, ${KHMER_FALLBACK}, system-ui, sans-serif` },
  { id: "inter", label: "Inter", stack: `"Inter", "Segoe UI", ${KHMER_FALLBACK}, sans-serif`, google: "Inter:wght@400;500;600;700" },
  { id: "kantumruy", label: "Kantumruy Pro (Khmer)", stack: `"Kantumruy Pro", "Khmer UI", "Segoe UI", sans-serif`, google: "Kantumruy+Pro:wght@400;500;600;700" },
  { id: "notokhmer", label: "Noto Sans Khmer", stack: `"Noto Sans Khmer", "Khmer UI", "Segoe UI", sans-serif`, google: "Noto+Sans+Khmer:wght@400;500;600;700" },
  { id: "mono", label: "IBM Plex Mono", stack: `"IBM Plex Mono", Consolas, ${KHMER_FALLBACK}, monospace`, google: "IBM+Plex+Mono:wght@400;500;600" },
];

export interface Look {
  theme: Theme;
  accent: string;
  font: string;
}

export function applyLook(look: Look): void {
  const root = document.documentElement;
  root.dataset.theme = look.theme;
  const a = ACCENTS.find((x) => x.id === look.accent) ?? ACCENTS[0];
  root.style.setProperty("--accent", a.color);
  root.style.setProperty("--accent-2", a.hover);
  root.style.setProperty("--accent-ink", a.ink);
  root.style.setProperty("--accent-soft", `${a.color}24`);
  const f = FONTS.find((x) => x.id === look.font) ?? FONTS[0];
  root.style.setProperty("--font", f.stack);
  if (f.google && !document.getElementById(`font-${f.id}`)) {
    const link = document.createElement("link");
    link.id = `font-${f.id}`;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${f.google}&display=swap`;
    document.head.appendChild(link);
  }
}

/**
 * Switches theme with a circle that grows from the button in the new
 * background colour, then swaps the variables underneath it.
 */
export function animateTheme(from: HTMLElement | null, next: Theme, apply: () => void): void {
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!from || reduce) {
    apply();
    return;
  }
  const r = from.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  const wipe = document.createElement("div");
  wipe.className = "theme-wipe";
  wipe.style.background = next === "light" ? "#f4f3f0" : "#0f1012";
  wipe.style.clipPath = `circle(0px at ${x}px ${y}px)`;
  document.body.appendChild(wipe);
  from.classList.add("spin");
  requestAnimationFrame(() => {
    wipe.style.clipPath = `circle(${radius}px at ${x}px ${y}px)`;
  });
  window.setTimeout(() => {
    apply();
    wipe.style.opacity = "0";
    window.setTimeout(() => wipe.remove(), 220);
  }, 420);
}
