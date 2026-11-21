// Camera Raw style picture adjustments: pure pixel maths, no browser needed.
// The Edit tab runs this on a small copy for the live preview and on the
// full-size picture when you press Apply. Nothing is sent anywhere and it
// costs no credits.

export interface Adjust {
  exposure: number; // -3 to 3 stops
  contrast: number; // -100 to 100
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
  temperature: number; // negative = cooler (blue), positive = warmer (yellow)
  tint: number; // negative = green, positive = magenta
  vibrance: number;
  saturation: number;
  clarity: number;
  texture: number;
  dehaze: number;
  sharpen: number; // 0 to 100
  noise: number; // 0 to 100, noise reduction
  vignette: number; // negative darkens the corners
  grain: number; // 0 to 100
}

export const NEUTRAL: Adjust = {
  exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0,
  temperature: 0, tint: 0, vibrance: 0, saturation: 0,
  clarity: 0, texture: 0, dehaze: 0, sharpen: 0, noise: 0, vignette: 0, grain: 0,
};

export interface AdjustControl { key: keyof Adjust; label: string; min: number; max: number; step: number }
export interface AdjustGroup { id: string; title: string; items: AdjustControl[] }

const pm = (key: keyof Adjust, label: string): AdjustControl => ({ key, label, min: -100, max: 100, step: 1 });
const zp = (key: keyof Adjust, label: string): AdjustControl => ({ key, label, min: 0, max: 100, step: 1 });

export const ADJUST_GROUPS: AdjustGroup[] = [
  { id: "light", title: "Light", items: [{ key: "exposure", label: "Exposure", min: -3, max: 3, step: 0.05 }, pm("contrast", "Contrast"), pm("highlights", "Highlights"), pm("shadows", "Shadows"), pm("whites", "Whites"), pm("blacks", "Blacks")] },
  { id: "colour", title: "Colour", items: [pm("temperature", "Temperature"), pm("tint", "Tint"), pm("vibrance", "Vibrance"), pm("saturation", "Saturation")] },
  { id: "detail", title: "Detail", items: [pm("clarity", "Clarity"), pm("texture", "Texture"), pm("dehaze", "Dehaze"), zp("sharpen", "Sharpening"), zp("noise", "Noise reduction")] },
  { id: "effects", title: "Effects", items: [pm("vignette", "Vignette"), zp("grain", "Grain")] },
];

export function isNeutral(a: Adjust): boolean {
  return (Object.keys(NEUTRAL) as (keyof Adjust)[]).every((k) => a[k] === NEUTRAL[k]);
}

export interface Pixels { data: Uint8ClampedArray; width: number; height: number }

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** Box blur of one channel, two passes (close to a soft Gaussian), edges repeat. */
export function boxBlur(src: Float32Array, w: number, h: number, radius: number): Float32Array {
  const r = Math.max(1, Math.round(radius));
  let a: Float32Array = src;
  for (let pass = 0; pass < 2; pass++) {
    const tmp = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let sum = 0;
      for (let i = -r; i <= r; i++) sum += a[row + Math.min(w - 1, Math.max(0, i))];
      for (let x = 0; x < w; x++) {
        tmp[row + x] = sum / (2 * r + 1);
        sum += a[row + Math.min(w - 1, x + r + 1)] - a[row + Math.max(0, x - r)];
      }
    }
    const out = new Float32Array(w * h);
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let i = -r; i <= r; i++) sum += tmp[Math.min(h - 1, Math.max(0, i)) * w + x];
      for (let y = 0; y < h; y++) {
        out[y * w + x] = sum / (2 * r + 1);
        sum += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
      }
    }
    a = out;
  }
  return a;
}

function lumaOf(f: Float32Array, n: number): Float32Array {
  const L = new Float32Array(n);
  for (let i = 0; i < n; i++) L[i] = luma(f[i * 3], f[i * 3 + 1], f[i * 3 + 2]);
  return L;
}

/** Adds `delta` (a brightness change) to every pixel while keeping its hue: scales RGB by (L + delta) / L. */
function addLuma(f: Float32Array, L: Float32Array, delta: Float32Array): void {
  for (let i = 0; i < L.length; i++) {
    const l = Math.max(L[i], 0.02);
    const k = Math.min(3, Math.max(0, (l + delta[i]) / l));
    f[i * 3] *= k; f[i * 3 + 1] *= k; f[i * 3 + 2] *= k;
  }
}

/** Applies the adjustments to the pixels, in place. A neutral Adjust leaves them exactly as they are. */
export function applyAdjust(px: Pixels, a: Adjust): void {
  if (isNeutral(a)) return;
  const { width: w, height: h, data } = px;
  const n = w * h;
  const side = Math.max(w, h);
  const f = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) f[i] = data[(i / 3 | 0) * 4 + (i % 3)] / 255;

  // 1) Per-pixel: exposure, white balance, tone, colour.
  const eg = Math.pow(2, a.exposure / 2.2); // a stop in linear light, applied to display values
  const t = a.temperature / 100, ti = a.tint / 100;
  const gr = eg * (1 + 0.25 * t), gg = eg * (1 - 0.15 * ti), gb = eg * (1 - 0.25 * t);
  const contrast = 1 + (a.contrast / 100) * 0.6;
  const sh = a.shadows / 100, hi = a.highlights / 100, wh = a.whites / 100, bl = a.blacks / 100;
  const sat = 1 + a.saturation / 100, vib = a.vibrance / 100;
  const tone = a.contrast || a.shadows || a.highlights || a.whites || a.blacks;
  const colour = a.saturation || a.vibrance;
  for (let i = 0; i < n; i++) {
    let r = f[i * 3] * gr, g = f[i * 3 + 1] * gg, b = f[i * 3 + 2] * gb;
    if (tone) {
      const L = luma(r, g, b);
      const Lc = clamp01(L);
      let nl = 0.5 + (Lc - 0.5) * contrast + (L - Lc);
      nl += sh * 0.35 * (1 - Lc) * (1 - Lc);
      nl += hi * 0.35 * Lc * Lc;
      nl += wh * 0.2 * smooth(0.6, 1, Lc);
      nl += bl * 0.2 * (1 - smooth(0, 0.4, Lc));
      const l = Math.max(L, 0.02);
      const k = Math.min(4, Math.max(0, Math.max(0, nl) / l));
      r *= k; g *= k; b *= k;
    }
    if (colour) {
      const l2 = luma(r, g, b);
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const s0 = (mx - mn) / (mx + 1e-4);
      const kk = sat * (1 + vib * (1 - clamp01(s0)));
      r = l2 + (r - l2) * kk; g = l2 + (g - l2) * kk; b = l2 + (b - l2) * kk;
    }
    f[i * 3] = r; f[i * 3 + 1] = g; f[i * 3 + 2] = b;
  }

  // 2) Noise reduction: soften flat areas, keep edges.
  if (a.noise > 0) {
    const L = lumaOf(f, n);
    const Lb = boxBlur(L, w, h, Math.max(1, Math.round(side / 700) + 1));
    const ch = [0, 1, 2].map((c) => {
      const p = new Float32Array(n);
      for (let i = 0; i < n; i++) p[i] = f[i * 3 + c];
      return boxBlur(p, w, h, Math.max(1, Math.round(side / 700) + 1));
    });
    const amt = a.noise / 100;
    for (let i = 0; i < n; i++) {
      const wgt = amt * (1 - smooth(0.02, 0.12, Math.abs(L[i] - Lb[i])));
      for (let c = 0; c < 3; c++) f[i * 3 + c] += (ch[c][i] - f[i * 3 + c]) * wgt;
    }
  }

  // 3) Dehaze: remove (or add) a veil estimated from the darkest channel.
  if (a.dehaze) {
    const d = a.dehaze / 100;
    if (d > 0) {
      const m = new Float32Array(n);
      for (let i = 0; i < n; i++) m[i] = Math.min(f[i * 3], f[i * 3 + 1], f[i * 3 + 2]);
      const hz = boxBlur(m, w, h, Math.max(2, Math.round(side / 80)));
      for (let i = 0; i < n; i++) {
        const tt = Math.min(0.6, hz[i] * d * 0.7);
        for (let c = 0; c < 3; c++) f[i * 3 + c] = (f[i * 3 + c] - tt) / (1 - tt);
      }
    } else {
      const v = -d * 0.4;
      for (let i = 0; i < n * 3; i++) f[i] = f[i] * (1 - v) + v * 0.8;
    }
  }

  // 4) Clarity (large-scale local contrast) and texture (fine detail).
  if (a.clarity || a.texture) {
    const L = lumaOf(f, n);
    const delta = new Float32Array(n);
    if (a.clarity) {
      const Lb = boxBlur(L, w, h, Math.max(3, Math.round(side / 50)));
      const k = (a.clarity / 100) * 0.9;
      for (let i = 0; i < n; i++) {
        const mid = 1 - Math.pow(Math.abs(2 * clamp01(L[i]) - 1), 2);
        delta[i] += k * (L[i] - Lb[i]) * mid;
      }
    }
    if (a.texture) {
      const Lb = boxBlur(L, w, h, Math.max(1, Math.round(side / 400)));
      const k = (a.texture / 100) * 1.2;
      for (let i = 0; i < n; i++) delta[i] += k * (L[i] - Lb[i]);
    }
    addLuma(f, L, delta);
  }

  // 5) Sharpening (unsharp mask on brightness).
  if (a.sharpen > 0) {
    const L = lumaOf(f, n);
    const Lb = boxBlur(L, w, h, Math.max(1, Math.round(side / 1000)));
    const k = (a.sharpen / 100) * 1.6;
    const delta = new Float32Array(n);
    for (let i = 0; i < n; i++) delta[i] = k * (L[i] - Lb[i]);
    addLuma(f, L, delta);
  }

  // 6) Vignette and grain, then write back.
  const vin = a.vignette / 100, gr2 = a.grain / 100;
  const cx = (w - 1) / 2, cy = (h - 1) / 2;
  for (let y = 0; y < h; y++) {
    const dy = (y - cy) / (cy || 1);
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let r = f[i * 3], g = f[i * 3 + 1], b = f[i * 3 + 2];
      if (vin) {
        const dx = (x - cx) / (cx || 1);
        const rr = Math.sqrt((dx * dx + dy * dy) / 2);
        const m = 1 + vin * 0.8 * smooth(0.35, 1, rr);
        r *= m; g *= m; b *= m;
      }
      if (gr2) {
        let hsh = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
        hsh = Math.imul(hsh ^ (hsh >>> 13), 1274126177);
        const noise = (((hsh ^ (hsh >>> 16)) >>> 0) / 4294967295) * 2 - 1;
        const L = clamp01(luma(r, g, b));
        const add = gr2 * 0.07 * noise * (0.3 + 0.7 * (1 - Math.abs(2 * L - 1)));
        r += add; g += add; b += add;
      }
      data[i * 4] = Math.round(clamp01(r) * 255);
      data[i * 4 + 1] = Math.round(clamp01(g) * 255);
      data[i * 4 + 2] = Math.round(clamp01(b) * 255);
    }
  }
}
