// ComfyUI backend (experimental, Phase 2). Talks to a ComfyUI server on the
// user's own PC. Start ComfyUI with --enable-cors-header so the browser or
// SketchUp panel is allowed to call it.
//
// The user supplies a workflow saved with "Export (API)" in ComfyUI. Text and
// image inputs are marked with placeholders that we fill in:
//   "{{PROMPT}}"   the full prompt text
//   "{{IMAGE_1}}"  first image (the view), "{{IMAGE_2}}" second (line pass or mask), ...

import type { ImageData64, RenderRequest, RenderResult } from "../types";
import { ProviderError, type Provider } from "./types";
import { base64ToBlob, blobToBase64 } from "../images";

export class ComfyProvider implements Provider {
  readonly id = "comfyui";
  readonly label = "ComfyUI (local)";

  constructor(
    private baseUrl: string,
    private workflowJson: string,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async render(req: RenderRequest, signal?: AbortSignal): Promise<RenderResult> {
    if (!this.workflowJson.trim()) throw new ProviderError("Paste a ComfyUI workflow (API format) in Settings first.");
    const names: string[] = [];
    for (let i = 0; i < req.images.length; i++) {
      names.push(await this.upload(req.images[i], `airs_input_${i + 1}.png`, signal));
    }
    const workflow = fillWorkflow(this.workflowJson, req.prompt, names);
    const queued = await this.json<{ prompt_id: string }>(
      "/prompt",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: workflow, client_id: "ai-render-suite" }) },
      signal,
    );
    const image = await this.waitForImage(queued.prompt_id, signal);
    return { image };
  }

  async test(): Promise<string> {
    const stats = await this.json<{ system?: { comfyui_version?: string } }>("/system_stats", { method: "GET" });
    return `Connected to ComfyUI${stats.system?.comfyui_version ? ` ${stats.system.comfyui_version}` : ""}.`;
  }

  private async upload(img: ImageData64, filename: string, signal?: AbortSignal): Promise<string> {
    const form = new FormData();
    form.append("image", base64ToBlob(img), filename);
    form.append("overwrite", "true");
    const res = await this.json<{ name: string; subfolder?: string }>("/upload/image", { method: "POST", body: form }, signal);
    return res.subfolder ? `${res.subfolder}/${res.name}` : res.name;
  }

  private async waitForImage(promptId: string, signal?: AbortSignal): Promise<ImageData64> {
    const deadline = Date.now() + 10 * 60 * 1000;
    while (Date.now() < deadline) {
      await sleep(1500, signal);
      const hist = await this.json<Record<string, HistoryEntry>>(`/history/${encodeURIComponent(promptId)}`, { method: "GET" }, signal);
      const entry = hist[promptId];
      if (!entry) continue;
      if (entry.status?.status_str === "error") throw new ProviderError("ComfyUI reported an error while running the workflow.");
      for (const node of Object.values(entry.outputs ?? {})) {
        const out = node.images?.find((im) => im.type === "output") ?? node.images?.[0];
        if (out) {
          const q = new URLSearchParams({ filename: out.filename, subfolder: out.subfolder ?? "", type: out.type ?? "output" });
          const res = await this.fetch(`/view?${q}`, { method: "GET" }, signal);
          const blob = await res.blob();
          return { mimeType: blob.type || "image/png", data: await blobToBase64(blob) };
        }
      }
    }
    throw new ProviderError("ComfyUI took longer than 10 minutes. Check the ComfyUI window for errors.");
  }

  private async fetch(path: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
    let res: Response;
    try {
      res = await fetch(this.baseUrl + path, { ...init, signal });
    } catch (err) {
      if ((err as Error).name === "AbortError") throw err;
      throw new ProviderError(
        `Could not reach ComfyUI at ${this.baseUrl}. Is it running, and was it started with --enable-cors-header?`,
      );
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new ProviderError(`ComfyUI error ${res.status}${text ? `: ${text.slice(0, 300)}` : ""}`, res.status);
    }
    return res;
  }

  private async json<T>(path: string, init: RequestInit, signal?: AbortSignal): Promise<T> {
    return (await (await this.fetch(path, init, signal)).json()) as T;
  }
}

interface HistoryEntry {
  status?: { status_str?: string };
  outputs?: Record<string, { images?: { filename: string; subfolder?: string; type?: string }[] }>;
}

/** Replaces placeholders anywhere in the workflow's string values. */
export function fillWorkflow(workflowJson: string, prompt: string, imageNames: string[]): unknown {
  let parsed: unknown;
  try {
    parsed = JSON.parse(workflowJson);
  } catch {
    throw new ProviderError("The ComfyUI workflow is not valid JSON. Export it again with \"Export (API)\".");
  }
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") {
      if (v === "{{PROMPT}}") return prompt;
      const m = /^\{\{IMAGE_(\d+)\}\}$/.exec(v);
      if (m) {
        const name = imageNames[Number(m[1]) - 1];
        if (!name) throw new ProviderError(`The workflow asks for image ${m[1]}, but only ${imageNames.length} were sent.`);
        return name;
      }
      return v.replace(/\{\{PROMPT\}\}/g, prompt);
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, walk(x)]));
    }
    return v;
  };
  return walk(parsed);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}
