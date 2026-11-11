// Kie.ai backend: one API key for Nano Banana, GPT Image and Seedream. The
// user's own key, billed to their own Kie credits. A render is four steps:
// upload each image, start a job with the uploaded links, poll the job until
// it is done, then download the result.
//
// Inside SketchUp the calls go through the plugin (Ruby), because Kie's
// servers may not allow calls straight from a web page. In the browser they
// use fetch.

import type { Host } from "../host";
import type { ImageData64, RenderRequest, RenderResult } from "../types";
import { findKieModel, ratioFor, resolutionFor, USD_PER_CREDIT, type KieResolution } from "./kie-models";
import { ProviderError, type Provider } from "./types";

const API = "https://api.kie.ai/api/v1";
const UPLOAD = "https://kieai.redpandaai.co/api/file-base64-upload";
export const KIE_KEY_PAGE = "https://kie.ai/api-key";

export interface KieTransport {
  /** JSON request. Resolves with the HTTP status and the parsed body (null if not JSON). */
  json(method: "GET" | "POST", url: string, key: string, body?: unknown): Promise<{ status: number; body: unknown }>;
  /** Downloads an image. */
  image(url: string): Promise<ImageData64>;
}

export const fetchTransport: KieTransport = {
  async json(method, url, key, body) {
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${key}`, ...(body ? { "Content-Type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new ProviderError("Could not reach Kie.ai. Check the internet connection.");
    }
    let parsed: unknown = null;
    try {
      parsed = await res.json();
    } catch {
      /* not JSON */
    }
    return { status: res.status, body: parsed };
  },
  async image(url) {
    let res: Response;
    try {
      res = await fetch(url);
    } catch {
      throw new ProviderError("The render is done but could not be downloaded. Open History and try again.");
    }
    if (!res.ok) throw new ProviderError(`Could not download the render (error ${res.status}).`);
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
    const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
    if (!m) throw new ProviderError("The render came back in a format that could not be read.");
    return { mimeType: m[1], data: m[2] };
  },
};

export function hostTransport(host: Host): KieTransport {
  return {
    json: (method, url, key, body) => host.call("kieHttp", { method, url, key, body: body ?? null }),
    image: (url) => host.call("kieDownload", { url }),
  };
}

interface KieEnvelope {
  code?: number;
  msg?: string;
  success?: boolean;
  data?: unknown;
}

interface TaskInfo {
  state?: string;
  resultJson?: string;
  failCode?: string | number;
  failMsg?: string;
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      const err = new Error("Cancelled.");
      err.name = "AbortError";
      reject(err);
    });
  });

function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) {
    const err = new Error("Cancelled.");
    err.name = "AbortError";
    throw err;
  }
}

export function explainKie(status: number, msg: string): string {
  // SketchUp reports 0 when the request never left the computer.
  if (status === 0) return "No internet connection. Check your Wi-Fi, then try again.";
  if (status === 401) return "Kie.ai rejected the API key. Check it in Settings.";
  if (status === 402) return "Not enough Kie credits. Top up at kie.ai, then render again.";
  if (status === 429) return "Kie.ai is busy (too many requests). Wait a moment and try again.";
  if (status === 422 || status === 400) return `Kie.ai did not accept the request${msg ? `: ${msg}` : "."}`;
  if (status >= 500) return "Kie.ai had a server error. Try again in a moment.";
  return msg ? `Kie.ai error ${status}: ${msg}` : `Kie.ai error ${status}.`;
}

export class KieProvider implements Provider {
  readonly id = "kie";
  readonly label: string;
  readonly modelName: string;
  /** How often to ask whether the job is done, in ms. */
  pollMs = 3000;
  /** Give up after this long, in ms. */
  timeoutMs = 10 * 60 * 1000;

  constructor(
    private apiKey: string,
    private modelId: string,
    private resolution: KieResolution,
    private transport: KieTransport,
  ) {
    const m = findKieModel(modelId);
    this.label = `${m.label} (Kie.ai)`;
    this.modelName = m.id;
  }

  /** Calls Kie and unwraps its { code, msg, data } envelope. */
  private async call(method: "GET" | "POST", url: string, body?: unknown): Promise<unknown> {
    const { status, body: res } = await this.transport.json(method, url, this.apiKey, body);
    const env = (res ?? {}) as KieEnvelope;
    const code = typeof env.code === "number" ? env.code : status;
    if (status >= 400 || code !== 200) throw new ProviderError(explainKie(status >= 400 ? status : code, env.msg ?? ""), code);
    return env.data;
  }

  async upload(img: ImageData64, i: number): Promise<string> {
    const ext = img.mimeType.includes("jpeg") ? "jpg" : "png";
    const data = (await this.call("POST", UPLOAD, {
      base64Data: `data:${img.mimeType};base64,${img.data}`,
      uploadPath: "david-render-studio",
      fileName: `view_${Date.now().toString(36)}_${i + 1}.${ext}`,
    })) as { downloadUrl?: string; fileUrl?: string } | undefined;
    const url = data?.downloadUrl ?? data?.fileUrl;
    if (!url) throw new ProviderError("Kie.ai took the image but gave no link back. Try again.");
    return url;
  }

  async render(req: RenderRequest, signal?: AbortSignal): Promise<RenderResult> {
    if (!this.apiKey) throw new ProviderError("Add your Kie.ai API key in Settings first.");
    const m = findKieModel(this.modelId);
    if (!req.images.length && m.family === "seedream") {
      throw new ProviderError(`${m.label} needs an image. Capture a view or upload one first.`);
    }
    const urls: string[] = [];
    for (let i = 0; i < req.images.length; i++) {
      checkAbort(signal);
      urls.push(await this.upload(req.images[i], i));
    }
    checkAbort(signal);
    const res = resolutionFor(m, this.resolution);
    const model = !urls.length && m.textId ? m.textId : m.id;
    const started = (await this.call("POST", `${API}/jobs/createTask`, {
      model,
      input: m.input(req.prompt, urls, ratioFor(m, req.aspectRatio), res),
    })) as { taskId?: string } | undefined;
    const taskId = started?.taskId;
    if (!taskId) throw new ProviderError("Kie.ai did not start the job. Try again.");
    req.onJob?.(taskId);

    const t0 = Date.now();
    for (;;) {
      await sleep(this.pollMs, signal);
      const info = (await this.call("GET", `${API}/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`)) as TaskInfo | undefined;
      const state = info?.state ?? "";
      if (state === "success") {
        const url = resultUrl(info?.resultJson);
        if (!url) throw new ProviderError("Kie.ai finished but sent no image.");
        checkAbort(signal);
        return { image: await this.transport.image(url) };
      }
      if (state === "fail") {
        throw new ProviderError(`${m.label} could not make this image${info?.failMsg ? `: ${info.failMsg}` : "."}`);
      }
      if (Date.now() - t0 > this.timeoutMs) {
        throw new ProviderError("Kie.ai is taking more than 10 minutes. The job may still finish in your Kie.ai logs.");
      }
    }
  }

  /**
   * Checks a job started earlier (e.g. before SketchUp closed): the image when
   * it finished, "running" while it is still going, null when it failed.
   */
  async resume(taskId: string): Promise<ImageData64 | "running" | null> {
    const info = (await this.call("GET", `${API}/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`)) as TaskInfo | undefined;
    const state = info?.state ?? "";
    if (state === "success") {
      const url = resultUrl(info?.resultJson);
      return url ? this.transport.image(url) : null;
    }
    if (state === "fail") return null;
    return "running";
  }

  /** Credits left on the key, or null if Kie does not say. */
  async balance(): Promise<number | null> {
    if (!this.apiKey) return null;
    const credits = Number(await this.call("GET", `${API}/chat/credit`));
    return Number.isFinite(credits) ? credits : null;
  }

  async test(): Promise<string> {
    if (!this.apiKey) throw new ProviderError("Paste your Kie.ai API key first.");
    const credits = Number(await this.call("GET", `${API}/chat/credit`));
    if (!Number.isFinite(credits)) return "Key works.";
    return `Key works · ${Math.floor(credits).toLocaleString("en-US")} credits left (about $${(credits * USD_PER_CREDIT).toFixed(2)})`;
  }
}

export function resultUrl(resultJson?: string): string | null {
  if (!resultJson) return null;
  try {
    const r = JSON.parse(resultJson) as { resultUrls?: string[] };
    return r.resultUrls?.[0] ?? null;
  } catch {
    return null;
  }
}
