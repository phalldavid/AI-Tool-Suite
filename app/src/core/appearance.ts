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
  /** used when accent is "custom" */
  accentCustom?: string;
  font: string;
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1], 16) : 0xf0a24a;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: number[]): string {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
}

/** Hover shade and readable text colour for any accent colour. */
export function accentFrom(hex: string): Accent {
  const rgb = hexToRgb(hex);
  const lum = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
  const hover = toHex(rgb.map((v) => v + (255 - v) * 0.18));
  const ink = lum > 0.5 ? toHex(rgb.map((v) => v * 0.12)) : "#ffffff";
  return { id: "custom", label: "Custom", color: toHex(rgb), hover, ink };
}

export function applyLook(look: Look): void {
  const root = document.documentElement;
  root.dataset.theme = look.theme;
  const a = look.accent === "custom" && look.accentCustom ? accentFrom(look.accentCustom) : ACCENTS.find((x) => x.id === look.accent) ?? ACCENTS[0];
  root.style.setProperty("--accent", a.color);
  root.style.setProperty("--accent-2", a.hover);
  root.style.setProperty("--accent-ink", a.ink);
  root.style.setProperty("--accent-soft", `${a.color}24`);
  // darker shade of the accent for text on light backgrounds (keeps 4.5:1)
  root.style.setProperty("--accent-deep", toHex(hexToRgb(a.color).map((v) => v * 0.55)));
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
 * Switches theme in place: colours cross-fade while a soft ring spreads from
 * the button. The interface stays on screen the whole time.
 */
export function animateTheme(from: HTMLElement | null, next: Theme, apply: () => void): void {
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!from || reduce) {
    apply();
    return;
  }
  const root = document.documentElement;
  const r = from.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  const ring = document.createElement("div");
  ring.className = `theme-ring ${next}`;
  ring.style.left = `${x}px`;
  ring.style.top = `${y}px`;
  ring.style.setProperty("--r", `${radius * 2}px`);
  document.body.appendChild(ring);
  from.classList.add("spin");
  root.classList.add("theme-anim");
  apply();
  window.setTimeout(() => {
    ring.remove();
    from.classList.remove("spin");
    root.classList.remove("theme-anim");
  }, 650);
}
