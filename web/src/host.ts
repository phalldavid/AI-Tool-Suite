// The host is where the interface runs: inside SketchUp's HtmlDialog, or a
// normal browser tab. Everything that differs between the two lives here.

import type { Capture, ImageData64 } from "./types";

export interface CaptureOptions {
  /** Long side of the exported view in px. */
  size: number;
  linePass: boolean;
  mask: boolean;
}

export interface Host {
  readonly kind: "sketchup" | "browser";
  capture(opts: CaptureOptions): Promise<Capture>;
  /** Saves an image. In SketchUp it lands next to the .skp; in the browser it downloads. */
  save(image: ImageData64, baseName: string): Promise<string>;
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
  openRenderFolder(): Promise<void>;
}

declare global {
  interface Window {
    sketchup?: Record<string, (...args: unknown[]) => void>;
    AIRS?: { receive: (message: string | BridgeReply) => void };
  }
}

interface BridgeReply {
  id: number;
  ok: boolean;
  result?: unknown;
  error?: string;
}

class SketchUpHost implements Host {
  readonly kind = "sketchup" as const;
  private nextId = 1;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

  constructor() {
    window.AIRS = {
      receive: (message) => {
        const reply: BridgeReply = typeof message === "string" ? JSON.parse(message) : message;
        const p = this.pending.get(reply.id);
        if (!p) return;
        this.pending.delete(reply.id);
        if (reply.ok) p.resolve(reply.result);
        else p.reject(new Error(reply.error || "SketchUp request failed"));
      },
    };
  }

  private request<T>(action: string, payload: unknown = {}): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      window.sketchup!.request(JSON.stringify({ id, action, payload }));
    });
  }

  async capture(opts: CaptureOptions): Promise<Capture> {
    const r = await this.request<Omit<Capture, "source">>("capture", opts);
    return { ...r, source: "sketchup" };
  }

  save(image: ImageData64, baseName: string): Promise<string> {
    return this.request<string>("save", { baseName, mimeType: image.mimeType, data: image.data });
  }

  getSetting(key: string): Promise<string | null> {
    return this.request<string | null>("getSetting", { key });
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.request("setSetting", { key, value });
  }

  async openRenderFolder(): Promise<void> {
    await this.request("openFolder");
  }
}

class BrowserHost implements Host {
  readonly kind = "browser" as const;

  async capture(): Promise<Capture> {
    throw new Error("Capturing a view needs the SketchUp plugin. In the browser, upload an image instead.");
  }

  async save(image: ImageData64, baseName: string): Promise<string> {
    const ext = image.mimeType.includes("jpeg") ? "jpg" : "png";
    const name = `${baseName}.${ext}`;
    const a = document.createElement("a");
    a.href = `data:${image.mimeType};base64,${image.data}`;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return name;
  }

  async getSetting(key: string): Promise<string | null> {
    try {
      return localStorage.getItem(`airs.${key}`);
    } catch {
      return null;
    }
  }

  async setSetting(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(`airs.${key}`, value);
    } catch {
      /* storage blocked; setting lasts for this session only */
    }
  }

  async openRenderFolder(): Promise<void> {
    /* nothing to open in a browser */
  }
}

export function detectHost(): Host {
  return window.sketchup && typeof window.sketchup.request === "function" ? new SketchUpHost() : new BrowserHost();
}
