// Test mode: renders without a key or credits. Waits a few seconds like a
// real job, then returns the first image with a "TEST" band across it, so
// every button and progress bar can be tried for free.

import type { ImageData64, RenderRequest, RenderResult } from "../types";
import type { Provider } from "./types";
import { ProviderError } from "./types";

export class MockProvider implements Provider {
  readonly id = "mock";
  readonly label = "Test mode (no AI)";
  readonly modelName = "test-mode";

  constructor(private delayMs = 4000) {}

  async render(req: RenderRequest, signal?: AbortSignal): Promise<RenderResult> {
    const src = req.images[0];
    if (!src) throw new ProviderError("Test mode needs an image to work on.");
    req.onJob?.(`test-${Date.now().toString(36)}`);
    await wait(this.delayMs, signal);
    return { image: await stamp(src, req.prompt), note: "Test mode: no AI was used." };
  }

  async test(): Promise<string> {
    return "Test mode is on: renders are sample images, no key or credits used.";
  }
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new ProviderError("Cancelled."));
    });
  });
}

/** Draws a warm tint and a TEST band over the image. Falls back to the image itself outside a browser. */
async function stamp(img: ImageData64, prompt: string): Promise<ImageData64> {
  if (typeof document === "undefined") return img;
  const el = new Image();
  el.src = `data:${img.mimeType};base64,${img.data}`;
  await el.decode();
  const c = document.createElement("canvas");
  c.width = el.naturalWidth;
  c.height = el.naturalHeight;
  const g = c.getContext("2d");
  if (!g) return img;
  g.drawImage(el, 0, 0);
  g.fillStyle = "rgba(240, 162, 74, 0.18)";
  g.fillRect(0, 0, c.width, c.height);
  const band = Math.max(40, Math.round(c.height * 0.12));
  g.fillStyle = "rgba(15, 16, 18, 0.72)";
  g.fillRect(0, (c.height - band) / 2, c.width, band);
  g.fillStyle = "#fff";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `700 ${Math.round(band * 0.42)}px system-ui, sans-serif`;
  g.fillText("TEST RENDER · no AI used", c.width / 2, c.height / 2 - band * 0.12);
  g.font = `400 ${Math.round(band * 0.18)}px system-ui, sans-serif`;
  g.fillText(prompt.split("\n")[0].slice(0, 90), c.width / 2, c.height / 2 + band * 0.28);
  const data = c.toDataURL("image/png").split(",")[1];
  return { mimeType: "image/png", data, width: c.width, height: c.height };
}

/** Canned analysis replies, shaped like the real ones. */
export function mockAnalysis(prompt: string): string {
  if (/style reference/i.test(prompt)) return "Style: tropical modern (test)\nMood and light: late afternoon, warm 3000K, soft shadows\nMaterial palette: teak, white render, grey terrazzo";
  if (/json/i.test(prompt)) return '{"scene":"exterior","subject":"villa","style":"modern","details":"Test mode sample: two-storey villa, white render, timber louvers"}';
  if (/people|person/i.test(prompt)) return "Two people talk by the entrance and one walks along the path (test mode sample).";
  return "Wall: smooth white render, matt\nRoof: dark grey standing-seam metal\nWindow frames: black aluminium\nGround: grey concrete pavers";
}
