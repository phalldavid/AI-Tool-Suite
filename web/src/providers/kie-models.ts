// Image models on Kie.ai that the model picker offers: two per family, so the
// choice stays simple. This list is the one place to edit (for example to
// add or swap a model when Kie releases a new one). Ids, inputs and
// prices come from docs.kie.ai and kie.ai model pages (checked 2026-10-23).
// Prices are Kie's list price per image in USD and change often, so they are
// shown as "about".

export type KieResolution = "1K" | "2K" | "4K";

export interface KieModel {
  id: string;
  family: KieFamilyId;
  label: string;
  /** one line under the label in the dropdown */
  note: string;
  /** model id to use when there is no input image, if the model has one */
  textId?: string;
  /** USD per image by resolution; absent = not published */
  price?: Partial<Record<KieResolution, number>>;
  /** resolutions the model takes; the first is used when the chosen one is not listed */
  resolutions: KieResolution[];
  /** aspect ratios the model takes */
  ratios: string[];
  /** builds the model's own "input" object */
  input(prompt: string, imageUrls: string[], ratio: string, res: KieResolution): Record<string, unknown>;
}

export type KieFamilyId = "nano" | "gpt" | "seedream";

export interface KieFamily {
  id: KieFamilyId;
  label: string;
  maker: string;
  badge: string;
}

export const KIE_FAMILIES: KieFamily[] = [
  { id: "nano", label: "Nano Banana", maker: "Google", badge: "Fast" },
  { id: "gpt", label: "GPT Image", maker: "OpenAI", badge: "Text" },
  { id: "seedream", label: "Seedream", maker: "ByteDance", badge: "2K" },
];

// Google's list for Nano Banana Pro.
const GOOGLE_RATIOS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];

const GPT_RATIOS = ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16", "2:1", "1:2", "3:1", "1:3", "21:9", "9:21", "5:4", "4:5"];

const nanoInput = (prompt: string, urls: string[], ratio: string, res: KieResolution) => ({
  prompt,
  image_input: urls,
  aspect_ratio: ratio,
  resolution: res,
  output_format: "png",
});

export const KIE_MODELS: KieModel[] = [
  {
    id: "nano-banana-2-1",
    family: "nano",
    label: "Nano Banana 2.1",
    note: "Newest, cheapest, good all-rounder",
    price: { "1K": 0.02, "2K": 0.03, "4K": 0.045 },
    resolutions: ["1K", "2K", "4K"],
    ratios: ["1:1", "2:3", "3:2", "1:4", "4:1", "3:4", "4:3", "4:5", "5:4", "1:8", "8:1", "9:16", "16:9", "21:9"],
    input: nanoInput,
  },
  {
    id: "nano-banana-pro",
    family: "nano",
    label: "Nano Banana Pro",
    note: "Best detail and text, slower",
    price: { "1K": 0.09, "2K": 0.09, "4K": 0.12 },
    resolutions: ["1K", "2K", "4K"],
    ratios: GOOGLE_RATIOS,
    input: nanoInput,
  },
  {
    id: "gpt-image-2-5-sunburst-image-to-image",
    family: "gpt",
    label: "GPT Image 2.5",
    note: "Newest GPT image model",
    resolutions: ["1K", "2K", "4K"],
    ratios: GPT_RATIOS,
    input: (prompt, urls, ratio, res) => ({ prompt, input_urls: urls, aspect_ratio: ratio, resolution: res, background: "opaque" }),
  },
  {
    id: "gpt-image-2-image-to-image",
    family: "gpt",
    label: "GPT Image 2",
    note: "Strong at signs and lettering",
    textId: "gpt-image-2-text-to-image",
    price: { "1K": 0.03 },
    resolutions: ["1K"],
    ratios: GPT_RATIOS,
    input: (prompt, urls, ratio) => (urls.length ? { prompt, input_urls: urls, aspect_ratio: ratio } : { prompt, aspect_ratio: ratio }),
  },
  {
    id: "seedream/5-pro-image-to-image",
    family: "seedream",
    label: "Seedream 5.0 Pro",
    note: "1K or 2K, rich materials",
    price: { "1K": 0.035, "2K": 0.07 },
    resolutions: ["2K", "1K"],
    ratios: ["1:1", "4:3", "3:4", "16:9", "9:16", "2:3", "3:2", "21:9"],
    input: (prompt, urls, ratio, res) => ({
      prompt,
      image_urls: urls,
      aspect_ratio: ratio,
      quality: res === "1K" ? "basic" : "high",
      output_format: "png",
      nsfw_checker: false,
    }),
  },
  {
    id: "seedream/5-flash-image-to-image",
    family: "seedream",
    label: "Seedream 5 Flash",
    note: "Fastest Seedream",
    resolutions: ["1K"],
    ratios: ["1:1", "4:3", "3:4", "16:9", "9:16", "2:3", "3:2", "21:9"],
    input: (prompt, urls, ratio, res) => ({
      prompt,
      image_urls: urls,
      aspect_ratio: ratio,
      size: res,
      output_format: "png",
      nsfw_checker: false,
    }),
  },
];

export const DEFAULT_KIE_MODEL = "nano-banana-2-1";

export function findKieModel(id: string): KieModel {
  return KIE_MODELS.find((m) => m.id === id) ?? KIE_MODELS[0];
}

export function modelsIn(family: KieFamilyId): KieModel[] {
  return KIE_MODELS.filter((m) => m.family === family);
}

/** The resolution actually sent: the chosen one if the model has it, else its first. */
export function resolutionFor(m: KieModel, wanted: KieResolution): KieResolution {
  return m.resolutions.includes(wanted) ? wanted : m.resolutions[0];
}

/** Price per image in USD at the resolution used, or null when Kie does not publish it. */
export function priceFor(m: KieModel, wanted: KieResolution): number | null {
  return m.price?.[resolutionFor(m, wanted)] ?? null;
}

export function priceText(m: KieModel, wanted: KieResolution): string {
  const p = priceFor(m, wanted);
  if (p === null) return "price on kie.ai";
  return `~$${p < 0.1 ? p.toFixed(3).replace(/0$/, "") : p.toFixed(2)}`;
}

/** The model's own ratio closest to the wanted one. */
export function ratioFor(m: KieModel, wanted?: string): string {
  if (!wanted) return m.ratios.includes("1:1") ? "1:1" : m.ratios[0];
  if (m.ratios.includes(wanted)) return wanted;
  const value = (r: string) => {
    const [a, b] = r.split(":").map(Number);
    return Math.log(a / b);
  };
  const target = value(wanted);
  return m.ratios.reduce((best, r) => (Math.abs(value(r) - target) < Math.abs(value(best) - target) ? r : best));
}

/** Kie credits are bought at 200 per US dollar (list rate). */
export const USD_PER_CREDIT = 0.005;
