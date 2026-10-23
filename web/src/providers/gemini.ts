// Gemini backend. Calls Google's Generative Language API directly with the
// user's own API key. Nothing passes through any server of ours.

import type { RenderRequest, RenderResult } from "../types";
import { ProviderError, type Provider } from "./types";

const API = "https://generativelanguage.googleapis.com/v1beta";
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-image";

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  inline_data?: { mime_type: string; data: string };
}

interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; status?: string };
}

export class GeminiProvider implements Provider {
  readonly id = "gemini";
  readonly label = "Gemini";

  constructor(
    private apiKey: string,
    private model: string = DEFAULT_GEMINI_MODEL,
  ) {}

  get modelName(): string {
    return this.model;
  }

  async render(req: RenderRequest, signal?: AbortSignal): Promise<RenderResult> {
    if (!this.apiKey) throw new ProviderError("Add your Gemini API key in Settings first.");
    const parts: GeminiPart[] = [{ text: req.prompt }];
    for (const img of req.images) {
      parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
    }
    const generationConfig: Record<string, unknown> = { responseModalities: ["TEXT", "IMAGE"] };
    if (req.aspectRatio) generationConfig.imageConfig = { aspectRatio: req.aspectRatio };

    const res = await this.call(
      `/models/${encodeURIComponent(this.model)}:generateContent`,
      { method: "POST", body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig }) },
      signal,
    );
    const json = (await res.json()) as GeminiResponse;
    return parseGeminiResponse(json);
  }

  async test(): Promise<string> {
    const models = await this.listImageModels();
    if (models.length === 0) return "Key works, but no image models are available on this account.";
    return `Key works. Image models available: ${models.join(", ")}`;
  }

  /** Models on this key that can return images. */
  async listImageModels(): Promise<string[]> {
    const res = await this.call("/models?pageSize=1000", { method: "GET" });
    const json = (await res.json()) as {
      models?: { name: string; supportedGenerationMethods?: string[] }[];
    };
    return (json.models ?? [])
      .filter((m) => m.name.includes("image") && (m.supportedGenerationMethods ?? []).includes("generateContent"))
      .map((m) => m.name.replace(/^models\//, ""));
  }

  private async call(path: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
    let res: Response;
    try {
      res = await fetch(API + path, {
        ...init,
        signal,
        headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") throw err;
      throw new ProviderError("Could not reach Google. Check the internet connection.");
    }
    if (!res.ok) {
      let detail = "";
      try {
        const body = (await res.json()) as GeminiResponse;
        detail = body.error?.message ?? "";
      } catch {
        /* body was not JSON */
      }
      throw new ProviderError(explainStatus(res.status, detail), res.status);
    }
    return res;
  }
}

export function explainStatus(status: number, detail: string): string {
  if (status === 400 && /api key/i.test(detail)) return "Google rejected the API key. Check it in Settings.";
  if (status === 403) return "This API key is not allowed to use that model. Check the key's project in Google AI Studio.";
  if (status === 404) return "That model was not found. Pick another one in Settings.";
  if (status === 429)
    return "Gemini quota reached. Wait a minute, or turn on billing for the key in Google AI Studio.";
  if (status >= 500) return "Gemini had a server error. Try again in a moment.";
  return detail ? `Gemini error ${status}: ${detail}` : `Gemini error ${status}.`;
}

export function parseGeminiResponse(json: GeminiResponse): RenderResult {
  if (json.promptFeedback?.blockReason) {
    throw new ProviderError(`Gemini blocked the request (${json.promptFeedback.blockReason}). Try rewording the prompt.`);
  }
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  let note = "";
  for (const p of parts) {
    const inline = p.inlineData ?? (p.inline_data && { mimeType: p.inline_data.mime_type, data: p.inline_data.data });
    if (inline?.data) {
      return { image: { mimeType: inline.mimeType || "image/png", data: inline.data }, note: note || undefined };
    }
    if (p.text) note += p.text;
  }
  const reason = json.candidates?.[0]?.finishReason;
  throw new ProviderError(
    note
      ? `Gemini answered with text instead of an image: "${note.slice(0, 200)}"`
      : `Gemini returned no image${reason ? ` (${reason})` : ""}. Try again or reword the prompt.`,
  );
}
