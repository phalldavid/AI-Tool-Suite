// Renders through the user's own signed-in chat site (Gemini, ChatGPT,
// Google Flow) in the plugin's browser window. No API key: the site's own
// plan and limits apply. Works only inside SketchUp.

import type { Host } from "../host";
import type { RenderRequest, RenderResult } from "../types";
import { ProviderError, type Provider } from "./types";

export class BrowserProvider implements Provider {
  readonly id = "browser";
  readonly label: string;
  readonly modelName: string;

  constructor(
    private host: Host,
    private site: string,
    private siteLabel: string,
  ) {
    this.label = `${siteLabel} (your account)`;
    this.modelName = `${siteLabel} in browser`;
  }

  async render(req: RenderRequest, signal?: AbortSignal): Promise<RenderResult> {
    if (this.host.kind !== "sketchup") {
      throw new ProviderError("Rendering with your own account works inside the SketchUp plugin. In the web app, use a Gemini API key.");
    }
    const onAbort = () => this.host.call("browserCancel").catch(() => undefined);
    signal?.addEventListener("abort", onAbort);
    try {
      const image = await this.host.call<RenderResult["image"]>("browserRender", {
        site: this.site,
        prompt: req.prompt,
        images: req.images,
      });
      return { image };
    } catch (e) {
      if (signal?.aborted) {
        const err = new Error("Cancelled.");
        err.name = "AbortError";
        throw err;
      }
      throw e;
    } finally {
      signal?.removeEventListener("abort", onAbort);
    }
  }

  async test(): Promise<string> {
    await this.host.call("browserOpen", { site: this.site });
    return `${this.siteLabel} is open. Sign in there once; SketchUp remembers it.`;
  }
}
