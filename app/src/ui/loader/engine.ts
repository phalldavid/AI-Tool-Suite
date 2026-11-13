// The render loader: one self-contained canvas animation that plays over the stage while
// a render runs. It knows nothing about React or the store: the component tells it when a
// render starts, when the result arrives (or is stopped), and it animates from there.
//
// Everything is driven by time, never by a fixed length, because the provider gives no
// real progress: a waiting state that loops forever, then a reveal from wherever the
// waiting state is when the result arrives.
//
// Styles:
//   orb       (default) specks fly slowly toward you over a soft aurora; when the image
//             arrives they drift into a spinning orb, which bursts to show the picture.
//   blur      a moving colour wash that tightens from blurry to sharp.
//   grid      twinkling specks that slowly line up into a grid and take the picture's colours.
//   blueprint a glowing line drawing of your view; a light beam paints the render behind it.
//   ink       watercolour blooms that spread out and become the picture.
//   words     a pulsing colour orb with short status lines; quick fade to the picture.

export type LoaderStyle = "orb" | "blur" | "grid" | "blueprint" | "ink" | "words";

export const LOADER_STYLES: { id: LoaderStyle; label: string; hint: string }[] = [
  { id: "orb", label: "Glow particles and orb", hint: "Specks drift toward you, gather into an orb, then burst into your image." },
  { id: "blur", label: "Colour blur to sharp", hint: "A soft moving colour wash that slowly comes into focus." },
  { id: "grid", label: "Specks into a grid", hint: "Twinkling specks line up and take on the picture's colours." },
  { id: "blueprint", label: "Blueprint sweep", hint: "A glowing line drawing of your view; a light beam paints the render in." },
  { id: "ink", label: "Ink bloom", hint: "Watercolour blooms swirl, then spread out into the picture." },
  { id: "words", label: "Status words and orb", hint: "A pulsing orb with short notes on what is happening." },
];

export const STATUS_WORDS = ["Reading your view", "Matching the materials", "Setting the light", "Placing plants and people", "Refining the details"];

export interface LoaderOptions {
  style: LoaderStyle;
  light: boolean;
  reduced: boolean;
  /** Seconds the specks take to gather into the orb once the image arrives. */
  gatherSec: number;
  /** Usual render time in ms. Only a rough guide for the grid style. */
  typicalMs: number;
  /** Particle count for the orb style (fewer for small previews). */
  count?: number;
  /** Status words, already in the right language. */
  words?: string[];
}

type Phase = "idle" | "wait" | "gather" | "reveal" | "stop" | "done" | "clear";
type Src = CanvasImageSource & { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number };

const PAL: [number, number, number][] = [
  [94, 231, 255], // cyan
  [77, 139, 255], // blue
  [155, 107, 255], // violet
  [255, 111, 208], // pink
  [255, 196, 107], // amber
];
const WEIGHT = [0.26, 0.24, 0.22, 0.18, 0.1];

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** Smoothstep. */
const sm = (x: number) => {
  x = clamp01(x);
  return x * x * (3 - 2 * x);
};
/** Smootherstep: gentler start and end. */
const s5 = (x: number) => {
  x = clamp01(x);
  return x * x * x * (x * (x * 6 - 15) + 10);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function pickColour(): number {
  const r = Math.random();
  let acc = 0;
  for (let i = 0; i < WEIGHT.length; i++) {
    acc += WEIGHT[i];
    if (r < acc) return i;
  }
  return 0;
}

function mk(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function srcSize(s: Src): [number, number] {
  return [s.naturalWidth || s.width || 1, s.naturalHeight || s.height || 1];
}

/** Draws an image over the whole canvas like CSS object-fit: cover. */
function drawCover(c: CanvasRenderingContext2D, s: Src, w: number, h: number, pad = 0): void {
  const [sw, sh] = srcSize(s);
  const k = Math.max((w + pad * 2) / sw, (h + pad * 2) / sh);
  const dw = sw * k;
  const dh = sh * k;
  c.drawImage(s, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

const sprites = new Map<string, HTMLCanvasElement>();
/** A glassy speck: bright core, coloured body, soft halo. Cached per colour. */
function sprite(rgb: [number, number, number], kind: "hard" | "soft" | "light"): HTMLCanvasElement {
  const key = rgb.join(",") + kind;
  const hit = sprites.get(key);
  if (hit) return hit;
  const c = mk(48, 48);
  const g = c.getContext("2d")!;
  const q = g.createRadialGradient(24, 24, 0, 24, 24, 24);
  const cs = rgb.join(",");
  if (kind === "light") {
    const dk = rgb.map((v) => Math.round(v * 0.62)).join(",");
    q.addColorStop(0, `rgba(${dk},1)`);
    q.addColorStop(0.14, `rgba(${cs},0.9)`);
    q.addColorStop(0.35, `rgba(${cs},0.28)`);
  } else {
    q.addColorStop(0, kind === "soft" ? `rgba(${cs},0.9)` : "rgba(255,255,255,1)");
    q.addColorStop(kind === "soft" ? 0.12 : 0.07, `rgba(${cs},1)`);
    q.addColorStop(0.25, `rgba(${cs},0.42)`);
    q.addColorStop(0.55, `rgba(${cs},0.1)`);
  }
  q.addColorStop(1, `rgba(${cs},0)`);
  g.fillStyle = q;
  g.fillRect(0, 0, 48, 48);
  sprites.set(key, c);
  return c;
}

interface Speck {
  x: number;
  y: number;
  z: number;
  vz: number;
  s: number;
  ph: number;
  ci: number;
  /** Stagger for gathering and fading, 0..1. */
  d: number;
  /** Place on the orb: angle round, angle down, how far it flies in the burst, curve side. */
  th: number;
  po: number;
  out: number;
  sw: number;
}

interface Bloom {
  x: number;
  y: number;
  c: number;
  age: number;
  life: number;
  r0: number;
  ph: number;
  d: number;
}

export class LoaderEngine {
  private host: HTMLElement;
  private card: HTMLDivElement;
  private underC: HTMLCanvasElement;
  private auroraC: HTMLCanvasElement;
  private main: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private actx: CanvasRenderingContext2D;
  private o: LoaderOptions;
  private W = 1;
  private H = 1;
  private dpr = 1;
  private phase: Phase = "idle";
  private raf = 0;
  private last = 0;
  private T = 0;
  private DT = 0;
  private t0 = 0;
  private tA = 0;
  private tR = 0;
  private tS = 0;
  private aS = 0;
  /** Waiting intensity when the result arrived (so the reveal starts from where it was). */
  private aR = 1;
  private orbF = 0;
  private orbPh = 0;
  private orbRot = 0;
  private hold = 0;
  private underSrc: Src | null = null;
  private resultSrc: Src | null = null;
  private UNDER: HTMLCanvasElement | null = null;
  private WIRE: HTMLCanvasElement | null = null;
  private LV: HTMLCanvasElement[] = [];
  private SMP: Uint8ClampedArray | null = null;
  private TMP: HTMLCanvasElement | null = null;
  private MASK: HTMLCanvasElement | null = null;
  private P: Speck[] = [];
  private blooms: Bloom[] = [];
  private bloomT = 0;
  private resolveReveal: (() => void) | null = null;
  private ro: ResizeObserver | null = null;
  private onVis = () => this.kick();

  constructor(host: HTMLElement, opts: LoaderOptions) {
    this.host = host;
    this.o = { ...opts };
    host.classList.add("rl-host");
    this.card = document.createElement("div");
    this.card.className = "rl-card";
    this.underC = document.createElement("canvas");
    this.underC.className = "rl-layer";
    this.auroraC = document.createElement("canvas");
    this.auroraC.className = "rl-aurora";
    this.auroraC.width = 64;
    this.auroraC.height = 36;
    this.main = document.createElement("canvas");
    this.main.className = "rl-layer";
    host.append(this.card, this.underC, this.auroraC, this.main);
    this.ctx = this.main.getContext("2d")!;
    this.actx = this.auroraC.getContext("2d")!;
    this.makeSpecks();
    if (typeof ResizeObserver !== "undefined") {
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(host);
    }
    document.addEventListener("visibilitychange", this.onVis);
    this.resize();
    this.paintIdle();
  }

  get state(): Phase {
    return this.phase;
  }

  setOptions(p: Partial<LoaderOptions>): void {
    const styleChanged = p.style !== undefined && p.style !== this.o.style;
    const countChanged = p.count !== undefined && p.count !== this.o.count;
    this.o = { ...this.o, ...p };
    if (countChanged) this.makeSpecks();
    if (styleChanged) this.blooms = [];
    this.kick();
  }

  /** The user's view, shown very faintly under the waiting animation. */
  setUnder(src: Src | null): void {
    this.underSrc = src;
    this.buildUnder();
  }

  start(): void {
    this.cancelReveal();
    this.phase = "wait";
    this.t0 = this.T;
    this.orbF = 0;
    this.hold = 0;
    this.blooms = [];
    this.resultSrc = null;
    this.LV = [];
    this.SMP = null;
    for (const p of this.P) this.spawn(p, true);
    this.kick();
  }

  /** The result is here: play the reveal, resolve when the crisp image is showing. */
  arrive(src: Src): Promise<void> {
    if (this.phase !== "wait" && this.phase !== "idle") return Promise.resolve();
    if (this.phase === "idle") this.start();
    this.resultSrc = src;
    this.buildResult();
    this.aR = sm((this.T - this.t0) / 1.6);
    this.tA = this.T;
    this.hold = 0;
    if (this.o.style === "orb" && !this.o.reduced) this.phase = "gather";
    else this.beginReveal();
    this.kick();
    return new Promise<void>((res) => {
      this.resolveReveal = res;
    });
  }

  /** Stopped or failed: fade back to the empty card. */
  stop(): void {
    if (this.phase !== "wait" && this.phase !== "gather") return;
    this.aS = this.intensity();
    this.tS = this.T;
    this.phase = "stop";
    this.kick();
  }

  /** After the reveal: fade the whole layer away so the page underneath shows. */
  clear(): void {
    if (this.phase === "idle") return;
    this.cancelReveal();
    this.tS = this.T;
    this.phase = "clear";
    this.kick();
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.cancelReveal();
    this.ro?.disconnect();
    document.removeEventListener("visibilitychange", this.onVis);
    this.card.remove();
    this.underC.remove();
    this.auroraC.remove();
    this.main.remove();
    this.host.classList.remove("rl-host");
  }

  // ---------- setup ----------

  private makeSpecks(): void {
    const n = this.o.count ?? 1400;
    this.P = Array.from({ length: n }, () => {
      const p = { d: Math.random(), th: rnd(0, Math.PI * 2), po: Math.acos(rnd(-1, 1)), out: rnd(0.6, 1.4), sw: Math.random() < 0.5 ? -1 : 1 } as Speck;
      this.spawn(p, true);
      return p;
    });
  }

  private spawn(p: Speck, init: boolean): void {
    p.z = init ? 0.15 + Math.random() * 1.05 : 1.2;
    p.x = (Math.random() * 2 - 1) * 2;
    p.y = (Math.random() * 2 - 1) * 1.25;
    p.vz = -(0.05 + Math.random() * 0.05);
    p.s = Math.random();
    p.ph = Math.random() * 6.283;
    p.ci = pickColour();
  }

  private resize(): void {
    const r = this.host.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width * this.dpr));
    const h = Math.max(1, Math.round(r.height * this.dpr));
    if (w === this.W && h === this.H) return;
    this.W = this.main.width = this.underC.width = w;
    this.H = this.main.height = this.underC.height = h;
    this.TMP = mk(w, h);
    this.MASK = mk(w, h);
    this.buildUnder();
    this.buildResult();
    this.kick();
  }

  private buildUnder(): void {
    const { W, H } = this;
    const g = this.underC.getContext("2d")!;
    g.clearRect(0, 0, W, H);
    this.UNDER = null;
    this.WIRE = null;
    if (!this.underSrc) return;
    this.UNDER = mk(W, H);
    drawCover(this.UNDER.getContext("2d")!, this.underSrc, W, H);
    g.drawImage(this.UNDER, 0, 0);
    this.WIRE = this.makeWire(this.UNDER);
  }

  /** A glowing blue line drawing of the view, found from its edges. */
  private makeWire(view: HTMLCanvasElement): HTMLCanvasElement {
    const { W, H } = this;
    const sw = Math.min(360, W);
    const sh = Math.max(1, Math.round((sw * H) / W));
    const small = mk(sw, sh);
    const sg = small.getContext("2d", { willReadFrequently: true })!;
    sg.drawImage(view, 0, 0, sw, sh);
    const src = sg.getImageData(0, 0, sw, sh).data;
    const lum = new Float32Array(sw * sh);
    for (let i = 0; i < sw * sh; i++) lum[i] = src[i * 4] * 0.3 + src[i * 4 + 1] * 0.59 + src[i * 4 + 2] * 0.11;
    const out = sg.createImageData(sw, sh);
    for (let y = 1; y < sh - 1; y++) {
      for (let x = 1; x < sw - 1; x++) {
        const i = y * sw + x;
        const gx = lum[i - sw + 1] + 2 * lum[i + 1] + lum[i + sw + 1] - lum[i - sw - 1] - 2 * lum[i - 1] - lum[i + sw - 1];
        const gy = lum[i + sw - 1] + 2 * lum[i + sw] + lum[i + sw + 1] - lum[i - sw - 1] - 2 * lum[i - sw] - lum[i - sw + 1];
        const m = Math.min(1, Math.max(0, (Math.hypot(gx, gy) - 40) / 160));
        out.data[i * 4] = 150;
        out.data[i * 4 + 1] = 220;
        out.data[i * 4 + 2] = 255;
        out.data[i * 4 + 3] = Math.round(m * 255);
      }
    }
    sg.putImageData(out, 0, 0);
    const c = mk(W, H);
    const g = c.getContext("2d")!;
    g.fillStyle = "#0a1324";
    g.fillRect(0, 0, W, H);
    g.strokeStyle = "rgba(90,160,255,0.08)";
    g.lineWidth = 1;
    const step = W / 24;
    for (let x = 0; x < W; x += step) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, H);
      g.stroke();
    }
    for (let y = 0; y < H; y += step) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }
    g.imageSmoothingEnabled = true;
    g.globalCompositeOperation = "lighter";
    g.filter = `blur(${2 * this.dpr}px)`;
    g.drawImage(small, 0, 0, W, H);
    g.filter = "none";
    g.drawImage(small, 0, 0, W, H);
    return c;
  }

  private buildResult(): void {
    this.LV = [];
    this.SMP = null;
    if (!this.resultSrc) return;
    const { W, H } = this;
    const sharp = mk(W, H);
    drawCover(sharp.getContext("2d")!, this.resultSrc, W, H);
    const k = Math.max(0.5, W / 900);
    this.LV = [36, 20, 10, 5, 2].map((b) => {
      const c = mk(W, H);
      const g = c.getContext("2d")!;
      g.filter = `blur(${b * k}px)`;
      drawCover(g, this.resultSrc!, W, H, b * k * 2);
      return c;
    });
    this.LV.push(sharp);
    const s = mk(40, 30);
    const sg = s.getContext("2d", { willReadFrequently: true })!;
    sg.drawImage(sharp, 0, 0, 40, 30);
    this.SMP = sg.getImageData(0, 0, 40, 30).data;
  }

  // ---------- loop ----------

  private kick(): void {
    if (this.raf || document.hidden) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (now: number): void => {
    this.raf = 0;
    this.DT = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.T += this.DT;
    if (document.hidden) return;
    const keep = this.step();
    if (keep) this.raf = requestAnimationFrame(this.frame);
  };

  private intensity(): number {
    if (this.phase === "wait" || this.phase === "gather") return sm((this.T - this.t0) / 1.6);
    return 0;
  }

  private beginReveal(): void {
    this.phase = "reveal";
    this.tR = this.T;
  }

  private finish(): void {
    this.phase = "done";
    const r = this.resolveReveal;
    this.resolveReveal = null;
    r?.();
  }

  private cancelReveal(): void {
    const r = this.resolveReveal;
    this.resolveReveal = null;
    r?.();
  }

  private comp(): GlobalCompositeOperation {
    return this.o.light ? "source-over" : "lighter";
  }

  /** Draws one frame. Returns whether to keep animating. */
  private step(): boolean {
    const { ctx, W, H, o } = this;
    ctx.clearRect(0, 0, W, H);
    this.actx.clearRect(0, 0, 64, 36);
    const el = this.T - this.t0;
    const ob = s5(this.orbF);
    this.orbPh += this.DT * lerp(0.6, 1.4, ob);
    this.orbRot += this.DT * lerp(0.12, 0.45, ob);

    let cardA = 0;
    let underA = 0;
    let auroraA = 0;
    let layerA = 1;

    switch (this.phase) {
      case "idle":
        this.paintIdle();
        return false;
      case "wait": {
        const a = sm(el / 1.6);
        cardA = sm(el / 0.5);
        if (o.reduced) {
          underA = 0.07 * cardA;
          break;
        }
        underA = 0.07 * a;
        auroraA = this.waitDraw(a, el);
        break;
      }
      case "gather": {
        cardA = 1;
        const a = this.aR;
        this.orbF = Math.min(1, this.orbF + this.DT / Math.max(0.5, o.gatherSec));
        underA = 0.07 * a * (1 - s5(this.orbF));
        auroraA = this.orbDraw(a, 0, 1) * a * (1 - 0.45 * s5(this.orbF));
        if (this.orbF >= 1) {
          this.hold += this.DT;
          if (this.hold > 0.7) this.beginReveal();
        }
        break;
      }
      case "reveal": {
        cardA = 1;
        const rd = o.reduced ? 0.6 : this.revealLength();
        const e = Math.min(1, (this.T - this.tR) / rd);
        if (o.reduced) {
          underA = 0.07 * (1 - e);
          this.lv(1, sm(e));
        } else auroraA = this.revealDraw(e);
        if (e >= 1) this.finish();
        break;
      }
      case "stop": {
        const k = sm((this.T - this.tS) / 0.9);
        const a = this.aS * (1 - k);
        cardA = 1 - k;
        underA = 0.07 * a;
        if (!o.reduced) auroraA = this.waitDraw(a, el);
        if (k >= 1) {
          this.phase = "idle";
          this.paintIdle();
          return false;
        }
        break;
      }
      case "done":
        cardA = 1;
        this.lv(1, 1);
        this.paintLayers(cardA, 0, 0, 1);
        return false;
      case "clear": {
        const k = sm((this.T - this.tS) / 0.35);
        cardA = 1;
        layerA = 1 - k;
        if (this.LV.length) this.lv(1, 1);
        if (k >= 1) {
          this.phase = "idle";
          this.paintIdle();
          return false;
        }
        break;
      }
    }
    this.paintLayers(cardA, underA, auroraA, layerA);
    return true;
  }

  private paintLayers(card: number, under: number, aurora: number, all: number): void {
    this.host.style.opacity = all >= 1 ? "" : all.toFixed(3);
    this.card.style.opacity = card.toFixed(3);
    this.underC.style.opacity = (this.o.style === "blueprint" ? 0 : under).toFixed(3);
    this.auroraC.style.opacity = (aurora * (this.o.light ? 0.55 : 0.75)).toFixed(3);
  }

  private paintIdle(): void {
    this.ctx.clearRect(0, 0, this.W, this.H);
    this.actx.clearRect(0, 0, 64, 36);
    this.paintLayers(0, 0, 0, 1);
  }

  private revealLength(): number {
    switch (this.o.style) {
      case "orb":
        return 2.2;
      case "blur":
        return 2.2;
      case "grid":
        return 1.9;
      case "blueprint":
        return 2.2;
      case "ink":
        return 2.4;
      case "words":
        return 0.35;
    }
  }

  /** Draws the sharp result at a blur level (0 = most blurred, 1 = crisp). */
  private lv(k: number, al: number, c: CanvasRenderingContext2D = this.ctx): void {
    const L = this.LV;
    if (!L.length || al <= 0) return;
    const p = clamp01(k) * (L.length - 1);
    const i = Math.floor(p);
    const f = p - i;
    c.globalAlpha = al;
    c.drawImage(L[i], 0, 0);
    if (f > 0 && L[i + 1]) {
      c.globalAlpha = al * f;
      c.drawImage(L[i + 1], 0, 0);
    }
    c.globalAlpha = 1;
  }

  /** Soft colour light behind the specks, on slow sine paths (never jumps back). */
  private aurora(t: number): void {
    const a = this.actx;
    a.globalCompositeOperation = this.o.light ? "source-over" : "lighter";
    const blobs: [number, number, number, number][] = [
      [0, 0.31, 0, 0.55],
      [2, 0.23, 1.7, 0.55],
      [3, 0.19, 3.1, 0.45],
      [1, 0.27, 4.4, 0.5],
      [4, 0.15, 5.3, 0.25],
    ];
    for (const [ci, sp, ph, al] of blobs) {
      const x = 32 + 26 * Math.sin(t * sp + ph);
      const y = 18 + 12 * Math.sin(t * sp * 0.8 + ph * 1.7);
      const c = PAL[ci].join(",");
      const g = a.createRadialGradient(x, y, 0, x, y, 26);
      g.addColorStop(0, `rgba(${c},${al})`);
      g.addColorStop(1, `rgba(${c},0)`);
      a.fillStyle = g;
      a.fillRect(0, 0, 64, 36);
    }
  }

  // ---------- waiting, per style. Returns the aurora strength. ----------

  private waitDraw(a: number, el: number): number {
    switch (this.o.style) {
      case "orb":
        this.orbDraw(a, 0, 1);
        this.aurora(this.T);
        return sm(el / 2.5) * a;
      case "blur":
        this.mesh(a);
        return 0;
      case "grid":
        this.grid(a, this.gridPull(el), 0);
        return 0;
      case "blueprint":
        this.blueprintWait(a);
        return 0;
      case "ink":
        this.ink(a, a > 0.5, 0);
        return 0;
      case "words":
        this.pulse(a, 1);
        this.words(a, el);
        return 0;
    }
  }

  private revealDraw(e: number): number {
    const a0 = this.aR;
    const { ctx, W, H } = this;
    switch (this.o.style) {
      case "orb":
        this.aurora(this.T);
        this.lv(sm((e - 0.25) / 0.75), sm((e - 0.12) / 0.4));
        this.orbDraw(1 - sm(e / 0.8), sm(e / 0.9), 0.3);
        return 0.55 * (1 - sm(e / 0.6));
      case "blur":
        this.mesh(a0 * (1 - sm(e / 0.55)));
        this.lv(sm((e - 0.05) / 0.95), sm(e / 0.35));
        return 0;
      case "grid": {
        const c0 = this.gridPull(this.tA - this.t0);
        this.grid(a0, lerp(c0, 1, sm(e / 0.3)), sm(e / 0.6));
        this.lv(sm((e - 0.6) / 0.4), sm((e - 0.5) / 0.3));
        return 0;
      }
      case "blueprint": {
        if (this.WIRE) ctx.drawImage(this.WIRE, 0, 0);
        else this.blueprintWait(1);
        const l = -0.15 + 1.35 * sm(e);
        this.masked((g) => this.lv(1, 1, g), 0, 0, W, H, l, 0.12);
        this.beam(0, 0, W, H, l, 0.05, "rgba(200,240,255,0.55)");
        return 0;
      }
      case "ink": {
        const mg = this.MASK!.getContext("2d")!;
        mg.clearRect(0, 0, W, H);
        for (const b of this.blooms) {
          const x = W * (b.x + 0.06 * Math.sin(this.T * 0.3 + b.ph));
          const y = H * (b.y + 0.06 * Math.cos(this.T * 0.27 + b.ph));
          const r = W * b.r0 * (1 + sm(e) * 3.5);
          const g = mg.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, "#000");
          g.addColorStop(1, "rgba(0,0,0,0)");
          mg.fillStyle = g;
          mg.fillRect(0, 0, W, H);
        }
        mg.globalAlpha = sm((e - 0.45) / 0.45);
        mg.fillStyle = "#000";
        mg.fillRect(0, 0, W, H);
        mg.globalAlpha = 1;
        this.ink(a0 * (1 - sm((e - 0.2) / 0.6)), false, sm(e / 0.8) * 0.6);
        const tg = this.TMP!.getContext("2d")!;
        tg.clearRect(0, 0, W, H);
        this.lv(sm((e - 0.25) / 0.75), 1, tg);
        tg.globalCompositeOperation = "destination-in";
        tg.drawImage(this.MASK!, 0, 0);
        tg.globalCompositeOperation = "source-over";
        ctx.drawImage(this.TMP!, 0, 0);
        return 0;
      }
      case "words": {
        const k = 1 - Math.pow(1 - e, 3);
        this.pulse(a0 * (1 - k), 1 + k * 2);
        const s = 0.97 + 0.03 * k;
        ctx.save();
        ctx.translate((W * (1 - s)) / 2, (H * (1 - s)) / 2);
        ctx.scale(s, s);
        this.lv(1, k);
        ctx.restore();
        return 0;
      }
    }
  }

  // ---------- orb style ----------

  /**
   * The specks. Waiting: they fly slowly toward you, fading in far away and out up close,
   * with a gentle twinkle. Gathering (orbF 0..1): the first ones drift into a spinning orb
   * one by one while the rest dim away. Burst (0..1): the orb pushes outward and fades.
   */
  private orbDraw(a: number, burst: number, speed: number): number {
    const { ctx, W, H, P, dpr } = this;
    const light = this.o.light;
    const ob = s5(this.orbF);
    const F = W * 0.32;
    const M = 40 * dpr;
    const nOrb = Math.round(P.length / 2);
    const Rr = Math.min(W, H) * 0.2 * lerp(1.7, 1, ob) * (1 + 0.05 * Math.sin(this.orbPh)) * (1 + burst * 4.5);
    const dt = this.DT;
    const t = this.T;
    if (ob > 0) {
      const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Rr * 1.5);
      g.addColorStop(0, `rgba(155,107,255,${0.2 * ob * a})`);
      g.addColorStop(1, "rgba(155,107,255,0)");
      ctx.globalCompositeOperation = this.comp();
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.globalCompositeOperation = this.comp();
    const ct = Math.cos(0.4);
    const st = Math.sin(0.4);
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      const isO = i < nOrb;
      const fi = isO ? s5((this.orbF - p.d * 0.45) / 0.55) : 0;
      const mv = speed * (1 - fi);
      if (mv > 0) {
        p.z += p.vz * dt * mv;
        const w = 0.03 * dt * mv;
        const nx = p.x - p.y * w;
        const ny = p.y + p.x * w * 0.6;
        p.x = nx + Math.sin(t * 0.4 + p.ph) * 0.02 * dt * mv;
        p.y = ny + Math.cos(t * 0.33 + p.ph * 1.3) * 0.02 * dt * mv;
      }
      let sx = W / 2 + (p.x / p.z) * F;
      let sy = H / 2 + (p.y / p.z) * F;
      const off = p.z < 0.14 || sx < -M || sx > W + M || sy < -M || sy > H + M;
      if (off && fi <= 0) {
        // Only new specks are born while waiting; once gathering starts, the free ones just fade.
        if (this.phase === "wait" || this.phase === "stop") this.spawn(p, false);
        continue;
      }
      if (p.z < 0.15) p.z = 0.15;
      // Distance fade (in from far away, out up close) and a gentle twinkle.
      const dep = 1 - (p.z - 0.14) / 1.06;
      let aF = 0.25 + 0.75 * dep;
      if (p.z > 1) aF *= (1.2 - p.z) / 0.2;
      if (p.z < 0.25) aF *= (p.z - 0.14) / 0.11;
      const tw = 0.78 + 0.22 * Math.sin(t * 1.7 + p.ph * 5);
      aF = Math.max(0, aF) * tw * (p.ci === 4 ? 0.7 : 1);
      const szF = Math.min(18, (2.2 + 3.2 * p.s) / p.z) * dpr * 2.2;
      let sz = szF;
      let al = aF;
      if (isO && fi > 0) {
        const th = p.th + this.orbRot;
        const ox0 = Math.sin(p.po) * Math.cos(th);
        const y0 = Math.cos(p.po);
        const z0 = Math.sin(p.po) * Math.sin(th);
        const oy0 = y0 * ct - z0 * st;
        const oz = y0 * st + z0 * ct;
        const s = 3 / (3 + oz);
        const rr = Rr * (burst > 0 ? lerp(1, p.out, burst) : 1);
        const ox = W / 2 + ox0 * rr * s;
        const oy = H / 2 + oy0 * rr * s;
        const dx = ox - sx;
        const dy = oy - sy;
        const curve = Math.sin(fi * Math.PI) * 0.18 * p.sw;
        sx = lerp(sx, ox, fi) - dy * curve;
        sy = lerp(sy, oy, fi) + dx * curve;
        sz = lerp(szF, (2 + s * 3) * dpr * 3.2, fi);
        const aO = (0.35 + 0.65 * (1 - (oz + 1) / 2)) * tw;
        al = lerp(aF, aO, s5(fi * 1.15 - 0.15));
      } else if (!isO) al *= 1 - s5((this.orbF - p.d * 0.4) / 0.6);
      // Fading out (stop or burst): each speck dies at its own moment, softly.
      al *= sm((a - p.d * 0.6) / 0.4);
      if (al < 0.01) continue;
      const kind = light ? "light" : p.z > 0.6 && fi < 0.5 ? "soft" : "hard";
      ctx.globalAlpha = Math.min(1, al * (light ? 0.85 : 1));
      ctx.drawImage(sprite(PAL[p.ci], kind), sx - sz / 2, sy - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    if (this.phase === "gather") this.aurora(this.T);
    return 1;
  }

  // ---------- other styles ----------

  private mesh(a: number): void {
    const { ctx, W, H, T } = this;
    ctx.globalCompositeOperation = this.comp();
    for (let i = 0; i < 5; i++) {
      const c = PAL[i].join(",");
      const x = W * (0.5 + 0.42 * Math.sin(T * 0.17 + i * 1.3));
      const y = H * (0.5 + 0.4 * Math.cos(T * 0.14 + i * 2.1));
      const r = Math.max(W, H) * 0.55;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${c},${0.42 * a * (i === 4 ? 0.5 : 1)})`);
      g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.globalCompositeOperation = "source-over";
  }

  /** How far the grid specks have lined up: a slow time curve, never a promise of progress. */
  private gridPull(el: number): number {
    const typ = Math.max(4000, this.o.typicalMs) / 1000;
    return s5((1 - Math.exp(-el / (typ * 0.6))) * 1.05);
  }

  private grid(a: number, pull: number, rev: number): void {
    const { ctx, W, H, T } = this;
    const cols = 40;
    const rows = 30;
    const cw = W / cols;
    const ch = H / rows;
    const smp = this.SMP;
    const r = lerp(1.3 * this.dpr, Math.max(cw, ch) * 0.62, sm((rev - 0.15) / 0.6));
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const n = j * cols + i;
        const ph = (n * 2.399) % 6.283;
        const f = 0.5 + ((n * 0.618) % 1);
        const d = (n * 0.381) % 0.6;
        const rx = W * (0.5 + 0.48 * Math.sin(T * 0.07 * f + ph));
        const ry = H * (0.5 + 0.48 * Math.cos(T * 0.06 * f + ph * 1.3));
        const x = lerp(rx, (i + 0.5) * cw, pull);
        const y = lerp(ry, (j + 0.5) * ch, pull);
        const tw = 0.55 + 0.45 * Math.sin(T * 2.3 + ph * 4);
        const dk = sm((a - d) / 0.4);
        if (rev > 0 && smp) {
          const k = n * 4;
          ctx.fillStyle = `rgb(${lerp(205, smp[k], rev) | 0},${lerp(214, smp[k + 1], rev) | 0},${lerp(255, smp[k + 2], rev) | 0})`;
        } else ctx.fillStyle = this.o.light ? "#5a6280" : "#cfd6ff";
        ctx.globalAlpha = dk * (rev > 0 ? lerp(tw, 1, rev) : tw);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 6.283);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  private blueprintWait(a: number): void {
    const { ctx, W, H } = this;
    ctx.globalAlpha = a;
    if (this.WIRE) ctx.drawImage(this.WIRE, 0, 0);
    else {
      ctx.fillStyle = "#0a1324";
      ctx.fillRect(0, 0, W, H);
    }
    ctx.globalAlpha = 1;
    const p = ((this.T * 0.17) % 1.9) - 0.45;
    this.beam(0, 0, W, H, p, 0.09, `rgba(120,220,255,${0.3 * a})`);
  }

  private beam(x0: number, y0: number, x1: number, y1: number, pos: number, w: number, col: string): void {
    const { ctx, W, H } = this;
    ctx.globalCompositeOperation = this.comp();
    const g = ctx.createLinearGradient(lerp(x0, x1, pos - w), lerp(y0, y1, pos - w), lerp(x0, x1, pos + w), lerp(y0, y1, pos + w));
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(0.5, col);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";
  }

  /** Draws something, kept only on the near side of a moving soft edge. */
  private masked(draw: (g: CanvasRenderingContext2D) => void, x0: number, y0: number, x1: number, y1: number, pos: number, fe: number): void {
    const { W, H } = this;
    const g = this.TMP!.getContext("2d")!;
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 1;
    g.clearRect(0, 0, W, H);
    draw(g);
    g.globalCompositeOperation = "destination-in";
    const gr = g.createLinearGradient(lerp(x0, x1, pos - fe), lerp(y0, y1, pos - fe), lerp(x0, x1, pos), lerp(y0, y1, pos));
    gr.addColorStop(0, "#000");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = "source-over";
    this.ctx.drawImage(this.TMP!, 0, 0);
  }

  private ink(a: number, spawn: boolean, grow: number): void {
    const { ctx, W, H, T } = this;
    if (spawn && T - this.bloomT > 0.6 && this.blooms.length < 16) {
      this.bloomT = T;
      this.blooms.push({ x: rnd(0.1, 0.9), y: rnd(0.1, 0.9), c: Math.floor(Math.random() * 4), age: 0, life: rnd(5, 8), r0: rnd(0.18, 0.32), ph: rnd(0, 6.28), d: rnd(0, 0.5) });
    }
    ctx.globalCompositeOperation = this.o.light ? "multiply" : "screen";
    for (let i = this.blooms.length - 1; i >= 0; i--) {
      const b = this.blooms[i];
      b.age += this.DT;
      if (b.age > b.life && spawn) {
        this.blooms.splice(i, 1);
        continue;
      }
      const env = sm(b.age / 1.8) * (spawn ? 1 - sm((b.age - b.life + 2.4) / 2.4) : 1) * sm((a - b.d) / 0.5);
      const x = W * (b.x + 0.06 * Math.sin(T * 0.3 + b.ph));
      const y = H * (b.y + 0.06 * Math.cos(T * 0.27 + b.ph));
      const r = W * b.r0 * (0.4 + sm(b.age / 3) * 0.9) * (1 + grow * 3);
      const c = PAL[b.c].join(",");
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${c},${0.6 * env})`);
      g.addColorStop(0.6, `rgba(${c},${0.22 * env})`);
      g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.globalCompositeOperation = "source-over";
  }

  private pulse(a: number, scale: number): void {
    const { ctx, W, H, T } = this;
    const r = Math.min(W, H) * 0.12 * (1 + 0.08 * Math.sin(T * 2.2)) * scale;
    ctx.globalCompositeOperation = this.comp();
    [0, 2, 3].forEach((ci, i) => {
      const x = W / 2 + r * 0.35 * Math.cos(T * 1.1 + i * 2.1);
      const y = H * 0.44 + r * 0.35 * Math.sin(T * 1.3 + i * 2.1);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.4);
      g.addColorStop(0, `rgba(${PAL[ci].join(",")},${0.7 * a})`);
      g.addColorStop(1, `rgba(${PAL[ci].join(",")},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    });
    ctx.globalCompositeOperation = "source-over";
  }

  private words(a: number, el: number): void {
    const { ctx, W, H, dpr } = this;
    const list = this.o.words?.length ? this.o.words : STATUS_WORDS;
    const n = list.length;
    const i = Math.floor(el / 2.6) % n;
    const f = (el % 2.6) / 2.6;
    const al = sm(f / 0.2) * (1 - sm((f - 0.8) / 0.2));
    ctx.globalAlpha = a * al;
    ctx.fillStyle = this.o.light ? "#3a3c48" : "rgba(255,255,255,0.85)";
    const font = getComputedStyle(this.host).fontFamily || "system-ui, sans-serif";
    ctx.font = `500 ${Math.max(12, Math.min(16, W / dpr / 30)) * dpr}px ${font}`;
    ctx.textAlign = "center";
    ctx.fillText(list[i], W / 2, H * 0.74 + (1 - sm(f / 0.2)) * 6 * dpr);
    ctx.globalAlpha = 1;
  }
}

/** Loads a data URL (or any URL) into an image the engine can draw. */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error("image"));
    im.src = src;
  });
}
