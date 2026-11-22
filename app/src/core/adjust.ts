// Camera Raw style picture adjustments: pure pixel maths, no browser needed.
// The Edit tab runs this on a small copy for the live preview and on the
// full-size picture when you press Apply. Nothing is sent anywhere and it
// costs no credits.

export const BANDS = [
  { id: "red", label: "Red", deg: 0, css: "#e5484d" },
  { id: "orange", label: "Orange", deg: 30, css: "#f5822a" },
  { id: "yellow", label: "Yellow", deg: 60, css: "#f2c230" },
  { id: "green", label: "Green", deg: 120, css: "#3fb950" },
  { id: "aqua", label: "Aqua", deg: 180, css: "#2cc4c4" },
  { id: "blue", label: "Blue", deg: 240, css: "#3b82f6" },
  { id: "purple", label: "Purple", deg: 270, css: "#8b5cf6" },
  { id: "magenta", label: "Magenta", deg: 300, css: "#d946a8" },
] as const;
export type BandId = (typeof BANDS)[number]["id"];
export type MixKey = `${"h" | "s" | "l"}_${BandId}`;
export type Curve = [number, number][];

export interface Adjust extends Record<MixKey, number> {
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
  straighten: number; // -15 to 15 degrees, positive turns the picture clockwise
  vertical: number; // -100 to 100, positive widens the top (fixes buildings that lean in)
  horizontal: number; // -100 to 100, positive makes the right side bigger
  /** Tone curve through (input, output) points from 0 to 1; the straight line is [[0,0],[1,1]]. */
  curve: Curve;
}
/** The numeric settings (everything but the curve). */
export type NumKey = Exclude<keyof Adjust, "curve">;

export const IDENTITY_CURVE: Curve = [[0, 0], [1, 1]];

const mixZero = Object.fromEntries(BANDS.flatMap((b) => (["h", "s", "l"] as const).map((k) => [`${k}_${b.id}`, 0]))) as Record<MixKey, number>;

export const NEUTRAL: Adjust = {
  ...mixZero,
  exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0,
  temperature: 0, tint: 0, vibrance: 0, saturation: 0,
  clarity: 0, texture: 0, dehaze: 0, sharpen: 0, noise: 0, vignette: 0, grain: 0,
  straighten: 0, vertical: 0, horizontal: 0,
  curve: IDENTITY_CURVE,
};

export interface AdjustControl { key: NumKey; label: string; min: number; max: number; step: number }
export interface AdjustGroup { id: string; title: string; items: AdjustControl[] }

const pm = (key: NumKey, label: string): AdjustControl => ({ key, label, min: -100, max: 100, step: 1 });
const zp = (key: NumKey, label: string): AdjustControl => ({ key, label, min: 0, max: 100, step: 1 });

export const ADJUST_GROUPS: AdjustGroup[] = [
  { id: "light", title: "Light", items: [{ key: "exposure", label: "Exposure", min: -3, max: 3, step: 0.05 }, pm("contrast", "Contrast"), pm("highlights", "Highlights"), pm("shadows", "Shadows"), pm("whites", "Whites"), pm("blacks", "Blacks")] },
  { id: "colour", title: "Colour", items: [pm("temperature", "Temperature"), pm("tint", "Tint"), pm("vibrance", "Vibrance"), pm("saturation", "Saturation")] },
  { id: "effects", title: "Effects", items: [pm("texture", "Texture"), pm("clarity", "Clarity"), pm("dehaze", "Dehaze"), pm("vignette", "Vignette"), zp("grain", "Grain")] },
  { id: "detail", title: "Detail", items: [zp("sharpen", "Sharpening"), zp("noise", "Noise reduction")] },
  { id: "geometry", title: "Geometry", items: [{ key: "straighten", label: "Straighten", min: -15, max: 15, step: 0.1 }, pm("vertical", "Vertical"), pm("horizontal", "Horizontal")] },
];

/** The colour mix dial for one band and one of hue, saturation, luminance. */
export function mixControl(kind: "h" | "s" | "l", band: BandId): AdjustControl {
  const names = { h: "Hue", s: "Saturation", l: "Luminance" } as const;
  return pm(`${kind}_${band}` as MixKey, names[kind]);
}

export function isIdentityCurve(c: Curve): boolean {
  return c.length === 2 && c[0][0] === 0 && c[0][1] === 0 && c[1][0] === 1 && c[1][1] === 1;
}

export function isNeutral(a: Adjust): boolean {
  return (Object.keys(NEUTRAL) as (keyof Adjust)[]).every((k) => (k === "curve" ? isIdentityCurve(a.curve) : a[k] === NEUTRAL[k]));
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


/** Smooth curve through the points that never overshoots (monotone cubic), as 256 output levels. */
export function curveLut(points: Curve): Uint8ClampedArray {
  const pts = [...points].sort((p, q) => p[0] - q[0]);
  const lut = new Uint8ClampedArray(256);
  const n = pts.length;
  if (n < 2) { for (let i = 0; i < 256; i++) lut[i] = i; return lut; }
  const dx: number[] = [], m: number[] = [];
  for (let i = 0; i < n - 1; i++) { dx.push(Math.max(1e-6, pts[i + 1][0] - pts[i][0])); m.push((pts[i + 1][1] - pts[i][1]) / dx[i]); }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], h = Math.hypot(a, b);
    if (h > 3) { t[i] = (3 * a / h) * m[i]; t[i + 1] = (3 * b / h) * m[i]; }
  }
  for (let k = 0; k < 256; k++) {
    const x = k / 255;
    let y: number;
    if (x <= pts[0][0]) y = pts[0][1];
    else if (x >= pts[n - 1][0]) y = pts[n - 1][1];
    else {
      let i = 0;
      while (i < n - 2 && x > pts[i + 1][0]) i++;
      const u = (x - pts[i][0]) / dx[i], u2 = u * u, u3 = u2 * u;
      y = (2 * u3 - 3 * u2 + 1) * pts[i][1] + (u3 - 2 * u2 + u) * dx[i] * t[i] + (-2 * u3 + 3 * u2) * pts[i + 1][1] + (u3 - u2) * dx[i] * t[i + 1];
    }
    lut[k] = Math.round(clamp01(y) * 255);
  }
  return lut;
}

/** Turns the picture (straighten) and fixes leaning lines (vertical, horizontal), scaled up just enough that no empty corners show. */
function warp(px: Pixels, a: Adjust): void {
  if (!a.straighten && !a.vertical && !a.horizontal) return;
  const { width: w, height: h, data } = px;
  const hw = w / 2, hh = h / 2;
  const th = (a.straighten * Math.PI) / 180, c = Math.cos(th), s = Math.sin(th);
  const kv = (a.vertical / 100) * 0.35, kh = (a.horizontal / 100) * 0.35;
  const src = (x: number, y: number, z: number): [number, number] => {
    const X = x / z, Y = y / z;
    const pX = X * (1 + (kv * Y) / hh), pY = Y * (1 - (kh * X) / hw);
    return [c * pX + s * pY, -s * pX + c * pY];
  };
  // Smallest zoom at which every point along the four edges still lands inside the picture.
  const edge: [number, number][] = [];
  for (let i = 0; i <= 48; i++) {
    const u = -1 + (2 * i) / 48;
    edge.push([u * hw, -hh], [u * hw, hh], [-hw, u * hh], [hw, u * hh]);
  }
  let z = 1;
  for (; z < 4; z += 0.01) {
    let ok = true;
    for (const [x, y] of edge) { const [X, Y] = src(x, y, z); if (Math.abs(X) > hw + 0.5 || Math.abs(Y) > hh + 0.5) { ok = false; break; } }
    if (ok) break;
  }
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [X, Y] = src(x + 0.5 - hw, y + 0.5 - hh, z);
      const fx = Math.min(w - 1, Math.max(0, X + hw - 0.5)), fy = Math.min(h - 1, Math.max(0, Y + hh - 0.5));
      const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1);
      const tx = fx - x0, ty = fy - y0;
      const o = (y * w + x) * 4;
      for (let k = 0; k < 3; k++) {
        const top = data[(y0 * w + x0) * 4 + k] * (1 - tx) + data[(y0 * w + x1) * 4 + k] * tx;
        const bot = data[(y1 * w + x0) * 4 + k] * (1 - tx) + data[(y1 * w + x1) * 4 + k] * tx;
        out[o + k] = top * (1 - ty) + bot * ty;
      }
      out[o + 3] = 255;
    }
  }
  data.set(out);
}

/** Colour mix: hue, saturation and luminance per colour band, with soft overlap between neighbours. */
function colourMix(f: Float32Array, n: number, a: Adjust): void {
  const H = BANDS.map((b) => a[`h_${b.id}` as MixKey] / 100);
  const S = BANDS.map((b) => a[`s_${b.id}` as MixKey] / 100);
  const L = BANDS.map((b) => a[`l_${b.id}` as MixKey] / 100);
  const deg = BANDS.map((b) => b.deg);
  for (let i = 0; i < n; i++) {
    const r = f[i * 3], g = f[i * 3 + 1], b = f[i * 3 + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (d < 1e-4) continue;
    const l = (mx + mn) / 2;
    const s = d / (1 - Math.abs(2 * l - 1) + 1e-6);
    let hue = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) * 60 : mx === g ? ((b - r) / d + 2) * 60 : ((r - g) / d + 4) * 60;
    let dh = 0, ds = 0, dl = 0;
    for (let k = 0; k < 8; k++) {
      let dist = Math.abs(hue - deg[k]);
      dist = Math.min(dist, 360 - dist);
      if (dist >= 45) continue;
      const wgt = 0.5 + 0.5 * Math.cos((Math.PI * dist) / 45);
      dh += wgt * H[k]; ds += wgt * S[k]; dl += wgt * L[k];
    }
    if (!dh && !ds && !dl) continue;
    const strength = Math.min(1, s * 3); // greys are left alone
    hue = (hue + dh * 30 * strength + 360) % 360;
    const s2 = Math.min(1, Math.max(0, s * (1 + ds * strength)));
    const l2 = Math.min(1, Math.max(0, l + dl * 0.3 * strength * (1 - Math.abs(2 * l - 1) * 0.6)));
    const c = (1 - Math.abs(2 * l2 - 1)) * s2, hp = hue / 60, xx = c * (1 - Math.abs((hp % 2) - 1)), m0 = l2 - c / 2;
    let rr = 0, gg = 0, bb = 0;
    if (hp < 1) { rr = c; gg = xx; } else if (hp < 2) { rr = xx; gg = c; } else if (hp < 3) { gg = c; bb = xx; } else if (hp < 4) { gg = xx; bb = c; } else if (hp < 5) { rr = xx; bb = c; } else { rr = c; bb = xx; }
    f[i * 3] = rr + m0; f[i * 3 + 1] = gg + m0; f[i * 3 + 2] = bb + m0;
  }
}

/** Applies the adjustments to the pixels, in place. A neutral Adjust leaves them exactly as they are. */
export function applyAdjust(px: Pixels, a: Adjust): void {
  if (isNeutral(a)) return;
  warp(px, a);
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

  // 1b) Colour mix.
  if ((Object.keys(a) as (keyof Adjust)[]).some((k) => /^[hsl]_/.test(k) && a[k] !== 0)) colourMix(f, n, a);

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
  const lut = isIdentityCurve(a.curve) ? null : curveLut(a.curve);
  const vin = a.vignette / 100, gr2 = a.grain / 100;
  const cx = (w - 1) / 2, cy = (h - 1) / 2;
  for (let y = 0; y < h; y++) {
    const dy = (y - cy) / (cy || 1);
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let r = f[i * 3], g = f[i * 3 + 1], b = f[i * 3 + 2];
      if (lut) {
        r = lut[Math.round(clamp01(r) * 255)] / 255; g = lut[Math.round(clamp01(g) * 255)] / 255; b = lut[Math.round(clamp01(b) * 255)] / 255;
      }
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
