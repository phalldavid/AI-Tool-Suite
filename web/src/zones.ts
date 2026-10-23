// Zone painting for spot edits: up to five coloured zones, each with its own
// instruction. Brush, rectangle and lasso tools, an eraser, undo and redo.
// Masks are kept at up to 1280 px on the long side; they are scaled up and
// feathered when the edit is pasted back, so this costs no visible quality.

export interface Zone {
  id: string;
  name: string;
  /** colour word used in the prompt */
  colour: string;
  css: string;
}

export const ZONES: Zone[] = [
  { id: "A", name: "Zone A", colour: "red", css: "#ff2a2a" },
  { id: "B", name: "Zone B", colour: "blue", css: "#2f6bff" },
  { id: "C", name: "Zone C", colour: "yellow", css: "#ffd21f" },
  { id: "D", name: "Zone D", colour: "green", css: "#1fbf4a" },
  { id: "E", name: "Zone E", colour: "purple", css: "#b04cff" },
];

export type PaintTool = "brush" | "rect" | "lasso";

interface Snapshot {
  zone: string;
  data: ImageData;
}

const MAX_SIDE = 1280;
const MAX_UNDO = 20;

export class ZonePainter {
  readonly canvases: Record<string, HTMLCanvasElement> = {};
  private preview = document.createElement("canvas");
  private undoStack: Snapshot[][] = [];
  private redoStack: Snapshot[][] = [];
  width = 0;
  height = 0;
  active = "A";
  tool: PaintTool = "brush";
  /** brush size in screen pixels */
  size = 40;
  erase = false;
  onChange: () => void = () => undefined;

  constructor() {
    for (const z of ZONES) {
      const c = document.createElement("canvas");
      c.className = "zone-layer";
      c.dataset.zone = z.id;
      this.canvases[z.id] = c;
    }
    this.preview.className = "zone-preview";
  }

  /** Sizes the masks for an image; clears them only if the size changes. */
  fit(imageW: number, imageH: number): void {
    const k = Math.min(1, MAX_SIDE / Math.max(imageW, imageH));
    const w = Math.round(imageW * k);
    const h = Math.round(imageH * k);
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    for (const c of [...Object.values(this.canvases), this.preview]) {
      c.width = w;
      c.height = h;
    }
    this.undoStack = [];
    this.redoStack = [];
  }

  ctx(id: string): CanvasRenderingContext2D {
    return this.canvases[id].getContext("2d")!;
  }

  hasPaint(id: string): boolean {
    const c = this.canvases[id];
    if (!c.width) return false;
    const d = this.ctx(id).getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < d.length; i += 32) if (d[i] > 0) return true;
    return false;
  }

  paintedZones(): string[] {
    return ZONES.map((z) => z.id).filter((id) => this.hasPaint(id));
  }

  /** All zones together, for pasting the edit back. */
  union(): HTMLCanvasElement {
    const c = document.createElement("canvas");
    c.width = this.width;
    c.height = this.height;
    const ctx = c.getContext("2d")!;
    for (const z of ZONES) ctx.drawImage(this.canvases[z.id], 0, 0);
    return c;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  private snap(ids: string[]): Snapshot[] {
    return ids.map((zone) => ({ zone, data: this.ctx(zone).getImageData(0, 0, this.width, this.height) }));
  }

  private remember(ids: string[]): void {
    this.undoStack.push(this.snap(ids));
    if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
    this.redoStack = [];
  }

  undo(): void {
    const step = this.undoStack.pop();
    if (!step) return;
    this.redoStack.push(this.snap(step.map((s) => s.zone)));
    for (const s of step) this.ctx(s.zone).putImageData(s.data, 0, 0);
    this.onChange();
  }

  redo(): void {
    const step = this.redoStack.pop();
    if (!step) return;
    this.undoStack.push(this.snap(step.map((s) => s.zone)));
    for (const s of step) this.ctx(s.zone).putImageData(s.data, 0, 0);
    this.onChange();
  }

  clearZone(id: string): void {
    this.remember([id]);
    this.ctx(id).clearRect(0, 0, this.width, this.height);
    this.onChange();
  }

  clearAll(): void {
    const ids = this.paintedZones();
    if (!ids.length) return;
    this.remember(ids);
    for (const id of ids) this.ctx(id).clearRect(0, 0, this.width, this.height);
    this.onChange();
  }

  private style(ctx: CanvasRenderingContext2D): void {
    const z = ZONES.find((x) => x.id === this.active)!;
    ctx.globalCompositeOperation = this.erase ? "destination-out" : "source-over";
    ctx.fillStyle = z.css;
    ctx.strokeStyle = z.css;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }

  /** Builds the paint surface over an image element. */
  surface(img: HTMLImageElement): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "paint-wrap";
    wrap.append(img, ...ZONES.map((z) => this.canvases[z.id]), this.preview);
    const ready = () => this.fit(img.naturalWidth, img.naturalHeight);
    if (img.complete && img.naturalWidth) ready();
    else img.addEventListener("load", ready);

    let down = false;
    let pts: [number, number][] = [];
    const point = (e: PointerEvent): [number, number] => {
      const r = this.preview.getBoundingClientRect();
      return [((e.clientX - r.left) / r.width) * this.width, ((e.clientY - r.top) / r.height) * this.height];
    };
    const scale = () => this.width / Math.max(1, this.preview.getBoundingClientRect().width);
    const pctx = this.preview.getContext("2d")!;
    const drawPreview = () => {
      pctx.clearRect(0, 0, this.width, this.height);
      if (pts.length < 2) return;
      const z = ZONES.find((x) => x.id === this.active)!;
      pctx.save();
      pctx.lineWidth = 2 * scale();
      pctx.setLineDash([6 * scale(), 4 * scale()]);
      pctx.strokeStyle = this.erase ? "#ffffff" : z.css;
      pctx.fillStyle = this.erase ? "rgba(255,255,255,0.15)" : `${z.css}55`;
      pctx.beginPath();
      if (this.tool === "rect") {
        const [a, b] = [pts[0], pts[pts.length - 1]];
        pctx.rect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
      } else {
        pctx.moveTo(pts[0][0], pts[0][1]);
        for (const p of pts.slice(1)) pctx.lineTo(p[0], p[1]);
        pctx.closePath();
      }
      pctx.fill();
      pctx.stroke();
      pctx.restore();
    };
    const brushTo = (p: [number, number]) => {
      const ctx = this.ctx(this.active);
      ctx.save();
      this.style(ctx);
      ctx.lineWidth = this.size * scale();
      const from = pts.length ? pts[pts.length - 1] : p;
      ctx.beginPath();
      ctx.moveTo(from[0], from[1]);
      ctx.lineTo(p[0], p[1]);
      ctx.stroke();
      ctx.restore();
      pts.push(p);
    };
    this.preview.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || !this.width) return;
      e.preventDefault();
      down = true;
      try {
        this.preview.setPointerCapture(e.pointerId);
      } catch {
        /* old Chromium */
      }
      this.remember([this.active]);
      pts = [];
      const p = point(e);
      if (this.tool === "brush") brushTo(p);
      else pts.push(p);
    });
    this.preview.addEventListener("pointermove", (e) => {
      if (!down) return;
      const p = point(e);
      if (this.tool === "brush") brushTo(p);
      else {
        if (this.tool === "rect") pts = [pts[0], p];
        else pts.push(p);
        drawPreview();
      }
    });
    const finish = () => {
      if (!down) return;
      down = false;
      if (this.tool !== "brush" && pts.length >= 2) {
        const ctx = this.ctx(this.active);
        ctx.save();
        this.style(ctx);
        ctx.beginPath();
        if (this.tool === "rect") {
          const [a, b] = [pts[0], pts[pts.length - 1]];
          ctx.rect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
        } else {
          ctx.moveTo(pts[0][0], pts[0][1]);
          for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
          ctx.closePath();
        }
        ctx.fill();
        ctx.restore();
      }
      pts = [];
      pctx.clearRect(0, 0, this.width, this.height);
      this.onChange();
    };
    this.preview.addEventListener("pointerup", finish);
    this.preview.addEventListener("pointercancel", finish);
    return wrap;
  }
}
