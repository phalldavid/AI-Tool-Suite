// Draws the light textures placed in SketchUp: spotlight beams (the kind
// of wall-wash shape a downlight throws) and LED glow strips. Everything is
// generated here, so the plugin ships no image assets for lights.

export interface Beam {
  id: string;
  name: string;
  /** half-width of the cone at the top and at the bottom, in texture widths */
  top: number;
  spread: number;
  /** how fast it fades with distance (higher = shorter throw) */
  falloff: number;
  /** 0 soft edge .. 1 crisp edge */
  edge: number;
  /** strength of the bright spot at the source */
  hot: number;
  /** curved, scalloped end of the beam */
  scallop: number;
  /** inner streaks typical of reflector downlights */
  streaks: number;
}

export const BEAMS: Beam[] = [
  { id: "wash", name: "Wall wash", top: 0.08, spread: 0.95, falloff: 1.1, edge: 0.15, hot: 0.55, scallop: 0.15, streaks: 0 },
  { id: "medium", name: "Medium beam", top: 0.05, spread: 0.62, falloff: 1.4, edge: 0.45, hot: 0.8, scallop: 0.35, streaks: 0.15 },
  { id: "narrow", name: "Narrow beam", top: 0.04, spread: 0.32, falloff: 1.25, edge: 0.55, hot: 0.9, scallop: 0.2, streaks: 0.1 },
  { id: "scallop", name: "Scallop", top: 0.05, spread: 0.85, falloff: 2.3, edge: 0.7, hot: 0.9, scallop: 0.9, streaks: 0.35 },
  { id: "pin", name: "Pin spot", top: 0.03, spread: 0.16, falloff: 1.0, edge: 0.65, hot: 1, scallop: 0.1, streaks: 0 },
  { id: "grazer", name: "Wall grazer", top: 0.03, spread: 0.12, falloff: 0.7, edge: 0.3, hot: 0.6, scallop: 0, streaks: 0 },
  { id: "cone", name: "Downlight cone", top: 0.06, spread: 0.75, falloff: 1.8, edge: 0.8, hot: 1, scallop: 0.5, streaks: 0.5 },
  { id: "pool", name: "Soft pool", top: 0.12, spread: 0.7, falloff: 2.6, edge: 0.05, hot: 0.35, scallop: 0.6, streaks: 0 },
];

export interface LedProfile {
  id: string;
  name: string;
  /** glow decay across the strip width */
  decay: number;
  /** bright core width, as a share of the strip width */
  core: number;
}

export const LED_PROFILES: LedProfile[] = [
  { id: "soft", name: "Soft glow", decay: 3.2, core: 0.03 },
  { id: "sharp", name: "Sharp line", decay: 7.5, core: 0.08 },
  { id: "wide", name: "Wide wash", decay: 1.7, core: 0.02 },
];

export const KELVINS = [2700, 3000, 3500, 4000, 5000, 6500];

export function kelvinLabel(k: number): string {
  if (k <= 2700) return "Very warm";
  if (k <= 3000) return "Warm";
  if (k <= 3500) return "Neutral warm";
  if (k <= 4000) return "Neutral";
  if (k <= 5000) return "Daylight";
  return "Cool";
}

/** Colour of a light source at a colour temperature (approximation by T. Helland). */
export function kelvinToRgb(kelvin: number): [number, number, number] {
  const t = kelvin / 100;
  let r: number;
  let g: number;
  let b: number;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    b = 255;
  }
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return [c(r), c(g), c(b)];
}

export function rgbCss([r, g, b]: [number, number, number]): string {
  return `rgb(${r}, ${g}, ${b})`;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Beam brightness 0..1 at u in [-1, 1] across, v in [0, 1] from the source down. */
export function beamIntensity(beam: Beam, u: number, v: number): number {
  const half = beam.top + beam.spread * v;
  const across = Math.abs(u) / Math.max(half, 1e-3);
  const soft = 0.05 + (1 - beam.edge) * 0.6;
  let edge = 1 - smooth(1 - soft, 1, across);
  // inner streaks: two brighter lines inside the cone
  if (beam.streaks > 0) {
    const s = Math.exp(-Math.pow((across - 0.62) / 0.08, 2));
    edge *= 1 + beam.streaks * s;
  }
  const end = 1 - beam.scallop * 0.35 * across * across; // scalloped bottom
  const along = Math.pow(Math.max(0, 1 - v / Math.max(end, 0.2)), beam.falloff) * smooth(0, 0.05, v);
  const hot = beam.hot * Math.exp(-(Math.pow(u / (beam.top * 2.2 + 0.04), 2) + Math.pow((v - 0.035) / 0.07, 2)));
  return Math.max(0, Math.min(1, edge * along * 0.85 + hot));
}

/**
 * Paints a beam into a canvas context of size w x h. With `onBlack`, it is
 * drawn as light on a dark wall (for previews); otherwise as colour with
 * transparency (the texture SketchUp uses).
 */
export function paintBeam(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  beam: Beam,
  kelvin: number,
  intensity: number,
  onBlack = false,
  flipUp = false,
): void {
  const img = ctx.createImageData(w, h);
  const [r, g, b] = kelvinToRgb(kelvin);
  const k = Math.max(0, Math.min(1, intensity / 100));
  for (let y = 0; y < h; y++) {
    const vRaw = (y + 0.5) / h;
    const v = flipUp ? 1 - vRaw : vRaw;
    for (let x = 0; x < w; x++) {
      const u = ((x + 0.5) / w) * 2 - 1;
      let i = beamIntensity(beam, u, v);
      i *= 0.35 + 0.65 * k;
      const white = Math.pow(i, 3) * 0.6; // hot centre goes toward white
      const p = (y * w + x) * 4;
      const cr = r + (255 - r) * white;
      const cg = g + (255 - g) * white;
      const cb = b + (255 - b) * white;
      if (onBlack) {
        img.data[p] = 18 + cr * i;
        img.data[p + 1] = 19 + cg * i;
        img.data[p + 2] = 22 + cb * i;
        img.data[p + 3] = 255;
      } else {
        img.data[p] = cr;
        img.data[p + 1] = cg;
        img.data[p + 2] = cb;
        img.data[p + 3] = Math.round(255 * Math.min(1, i * (0.6 + 0.5 * k)));
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** LED glow: brightest along the edge (top of the texture), fading across. */
export function ledIntensity(profile: LedProfile, t: number): number {
  if (t < profile.core) return 1;
  return Math.exp(-profile.decay * (t - profile.core));
}

export function paintLed(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  profile: LedProfile,
  kelvin: number,
  intensity: number,
  onBlack = false,
): void {
  const img = ctx.createImageData(w, h);
  const [r, g, b] = kelvinToRgb(kelvin);
  const k = Math.max(0, Math.min(1, intensity / 100));
  for (let y = 0; y < h; y++) {
    const t = (y + 0.5) / h;
    const i = ledIntensity(profile, t) * (0.35 + 0.65 * k);
    const white = Math.pow(i, 3) * 0.7;
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4;
      const cr = r + (255 - r) * white;
      const cg = g + (255 - g) * white;
      const cb = b + (255 - b) * white;
      if (onBlack) {
        img.data[p] = 18 + cr * i;
        img.data[p + 1] = 19 + cg * i;
        img.data[p + 2] = 22 + cb * i;
        img.data[p + 3] = 255;
      } else {
        img.data[p] = cr;
        img.data[p + 1] = cg;
        img.data[p + 2] = cb;
        img.data[p + 3] = Math.round(255 * Math.min(1, i));
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Short stable id for a set of settings, used to name textures. */
export function settingsId(prefix: string, value: unknown): string {
  const text = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${prefix}-${hash.toString(36)}`;
}
