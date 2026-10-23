// Draws the light textures placed in SketchUp: spotlight beams and LED glow.
// Both are lit the way real light lands on a wall: a point (or line) source
// a short distance from the surface, with a beam profile like a photometric
// (IES) file. Irradiance = I(angle) x cos(incidence) / distance^2. That gives
// the bright source, the curved scallop and the soft tail real photos show.
// Everything is generated here; the plugin ships no image assets for lights.

export interface Beam {
  id: string;
  name: string;
  /** beam half-angle in degrees (to the 50% point) */
  angle: number;
  /** how crisp the beam edge is: 1.5 soft .. 10 hard cut-off */
  edge: number;
  /** fitting distance from the wall, mm */
  offsetMm: number;
  /** aim toward the wall: 0 straight down, 0.4 tilted to wash the wall */
  tilt: number;
  /** bright reflector ring near the beam edge, 0..1 */
  ring: number;
  /** glare at the fitting, 0..1 */
  glare: number;
}

export const BEAMS: Beam[] = [
  { id: "scallop", name: "Scallop", angle: 26, edge: 6, offsetMm: 110, tilt: 0.12, ring: 0.45, glare: 0.7 },
  { id: "medium", name: "Medium beam", angle: 22, edge: 3.5, offsetMm: 90, tilt: 0.12, ring: 0.2, glare: 0.8 },
  { id: "narrow", name: "Narrow beam", angle: 12, edge: 4.5, offsetMm: 70, tilt: 0.08, ring: 0.3, glare: 0.9 },
  { id: "wash", name: "Wall wash", angle: 38, edge: 2.2, offsetMm: 160, tilt: 0.3, ring: 0, glare: 0.5 },
  { id: "pin", name: "Pin spot", angle: 6, edge: 5, offsetMm: 50, tilt: 0.04, ring: 0.2, glare: 1 },
  { id: "grazer", name: "Wall grazer", angle: 9, edge: 2.5, offsetMm: 25, tilt: 0.02, ring: 0, glare: 0.6 },
  { id: "cone", name: "Downlight cone", angle: 32, edge: 8, offsetMm: 130, tilt: 0.08, ring: 0.6, glare: 0.6 },
  { id: "pool", name: "Soft pool", angle: 48, edge: 1.6, offsetMm: 220, tilt: 0.25, ring: 0, glare: 0.4 },
];

export interface LedProfile {
  id: string;
  name: string;
  /** strip distance from the lit surface, mm: small = tight bright line */
  offsetMm: number;
  /** visible bright core of the strip itself, mm */
  coreMm: number;
}

export const LED_PROFILES: LedProfile[] = [
  { id: "soft", name: "Soft glow", offsetMm: 35, coreMm: 4 },
  { id: "sharp", name: "Sharp line", offsetMm: 10, coreMm: 6 },
  { id: "wide", name: "Wide wash", offsetMm: 55, coreMm: 3 },
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

const DEG = Math.PI / 180;

/** Relative candela of a beam at `theta` radians off its axis. */
export function candela(beam: Beam, theta: number): number {
  if (theta >= Math.PI / 2) return 0;
  const half = beam.angle * DEG;
  // ln(2) puts the 50% point at the beam angle; `edge` sets the cut-off.
  let i = Math.exp(-Math.LN2 * Math.pow(theta / half, beam.edge));
  if (beam.ring > 0) i *= 1 + beam.ring * Math.exp(-Math.pow((theta - half * 0.92) / (half * 0.07), 2));
  return i;
}

/**
 * Light falling on the wall at (x, y) mm, where x runs across from the
 * fitting and y runs down the wall from the fitting's height.
 */
export function beamIrradiance(beam: Beam, x: number, y: number): number {
  const d = beam.offsetMm;
  // axis: down, tilted toward the wall
  const ax = 0;
  const ay = 1;
  const az = -beam.tilt;
  const an = Math.hypot(ax, ay, az);
  const vx = x;
  const vy = y;
  const vz = -d;
  const r = Math.hypot(vx, vy, vz);
  const cosT = (vx * ax + vy * ay + vz * az) / (an * r);
  const theta = Math.acos(Math.max(-1, Math.min(1, cosT)));
  return (candela(beam, theta) * (d / r)) / (r * r);
}

export interface PaintOptions {
  kelvin: number;
  intensity: number;
  widthMm: number;
  lengthMm: number;
  /** draw as light on a dark wall (previews) instead of colour + alpha */
  onBlack?: boolean;
  flipUp?: boolean;
}

function tone(e: number, exposure: number): number {
  return 1 - Math.exp(-exposure * e);
}

function writePixel(data: Uint8ClampedArray, p: number, rgb: [number, number, number], lum: number, onBlack: boolean): void {
  const white = Math.pow(lum, 2.2) * 0.75; // bright parts burn toward white, like a photo
  const cr = rgb[0] + (255 - rgb[0]) * white;
  const cg = rgb[1] + (255 - rgb[1]) * white;
  const cb = rgb[2] + (255 - rgb[2]) * white;
  if (onBlack) {
    data[p] = 16 + cr * lum;
    data[p + 1] = 17 + cg * lum;
    data[p + 2] = 20 + cb * lum;
    data[p + 3] = 255;
  } else {
    data[p] = cr;
    data[p + 1] = cg;
    data[p + 2] = cb;
    data[p + 3] = Math.round(255 * lum);
  }
}

export function paintBeam(ctx: CanvasRenderingContext2D, w: number, h: number, beam: Beam, o: PaintOptions): void {
  const img = ctx.createImageData(w, h);
  const rgb = kelvinToRgb(o.kelvin);
  const k = Math.max(0, Math.min(1, o.intensity / 100));
  const field = new Float32Array(w * h);
  // Exposure is set on the beam's centre line a third of the way down, so the
  // fitting end burns out bright and the far end fades, as in a photograph.
  // Wide beams are capped against their own peak so they keep a visible shape.
  let peak = 0;
  for (let i = 1; i <= 200; i++) peak = Math.max(peak, beamIrradiance(beam, 0, (i / 200) * o.lengthMm));
  const ref = Math.max(beamIrradiance(beam, 0, Math.max(o.lengthMm * 0.33, beam.offsetMm * 1.5)), peak * 0.45);
  for (let y = 0; y < h; y++) {
    const yFrac = (y + 0.5) / h;
    const yMm = (o.flipUp ? 1 - yFrac : yFrac) * o.lengthMm;
    for (let x = 0; x < w; x++) {
      const xMm = ((x + 0.5) / w - 0.5) * o.widthMm;
      field[y * w + x] = beamIrradiance(beam, xMm, yMm) / ref;
    }
  }
  const exposure = 0.35 + 1.4 * k;
  const glareR = Math.max(10, beam.offsetMm * 0.18);
  for (let y = 0; y < h; y++) {
    const yFrac = (y + 0.5) / h;
    const yMm = (o.flipUp ? 1 - yFrac : yFrac) * o.lengthMm;
    for (let x = 0; x < w; x++) {
      const xMm = ((x + 0.5) / w - 0.5) * o.widthMm;
      let lum = tone(field[y * w + x], exposure);
      // soft glow just below the fitting
      lum += beam.glare * (0.4 + 0.6 * k) * Math.exp(-(xMm * xMm + yMm * yMm) / (2 * glareR * glareR));
      // fade the texture edges so the quad never shows a hard border
      const ex = Math.min(1, (0.5 - Math.abs((x + 0.5) / w - 0.5)) * 12);
      const ey = Math.min(1, (1 - yFrac) * 10, o.flipUp ? 1 : yFrac * 60 + 0.4);
      lum = Math.max(0, Math.min(1, lum)) * Math.max(0, ex) * Math.max(0, Math.min(1, ey));
      writePixel(img.data, (y * w + x) * 4, rgb, lum, Boolean(o.onBlack));
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Light from a strip at `y` mm across the surface, from a line source offset from it. */
export function ledIrradiance(profile: LedProfile, y: number): number {
  const d = profile.offsetMm;
  // line source: E ~ cos(incidence) / r, normalised to 1 at the strip
  return (d * d) / (d * d + y * y);
}

export interface LedPaintOptions {
  kelvin: number;
  intensity: number;
  widthMm: number;
  onBlack?: boolean;
}

/** LED glow: the strip at the top edge of the texture, glow falling off across. */
export function paintLed(ctx: CanvasRenderingContext2D, w: number, h: number, profile: LedProfile, o: LedPaintOptions): void {
  const img = ctx.createImageData(w, h);
  const rgb = kelvinToRgb(o.kelvin);
  const k = Math.max(0, Math.min(1, o.intensity / 100));
  const exposure = 0.5 + 1.7 * k;
  for (let y = 0; y < h; y++) {
    const yMm = ((y + 0.5) / h) * o.widthMm;
    let lum = tone(ledIrradiance(profile, yMm), exposure);
    if (yMm < profile.coreMm) lum = Math.max(lum, 0.97);
    // fade out before the far edge of the ribbon
    lum *= Math.min(1, (1 - (y + 0.5) / h) * 6);
    lum = Math.max(0, Math.min(1, lum));
    for (let x = 0; x < w; x++) writePixel(img.data, (y * w + x) * 4, rgb, lum, Boolean(o.onBlack));
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
