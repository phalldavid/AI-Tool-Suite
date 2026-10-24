// Image models on Kie.ai that the model picker offers: two per family, so the
// choice stays simple. This list is the one place to edit (for example to
// add or swap a model when Kie releases a new one). Ids, inputs and
// prices come from docs.kie.ai and kie.ai/pricing (GPT and Seedream Flash
// prices from David, 2026-10-24). Prices are Kie credits per image; they
// change often, so the app also loads prices.json from the website (see
// applyPriceList) and that file wins over the numbers here.

export type KieResolution = "1K" | "2K" | "4K";

export interface KieModel {
  id: string;
  family: KieFamilyId;
  label: string;
  /** one line under the label in the dropdown */
  note: string;
  /** model id to use when there is no input image, if the model has one */
  textId?: string;
  /** Kie credits per image by resolution; absent = not published */
  credits?: Partial<Record<KieResolution, number>>;
  /** short name on the model card, e.g. "2.5 Flare" */
  short: string;
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
  /** one short line on what the family is good at */
  bestFor: string;
}

export const KIE_FAMILIES: KieFamily[] = [
  { id: "nano", label: "Nano Banana", maker: "Google", badge: "Fast", bestFor: "Fast all-rounder, keeps your geometry" },
  { id: "gpt", label: "GPT Image", maker: "OpenAI", badge: "Text", bestFor: "Best at signs and lettering" },
  { id: "seedream", label: "Seedream", maker: "ByteDance", badge: "2K", bestFor: "Rich materials, up to 2K" },
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
    short: "2.1",
    credits: { "1K": 4, "2K": 6, "4K": 9 },
    resolutions: ["1K", "2K", "4K"],
    ratios: ["1:1", "2:3", "3:2", "1:4", "4:1", "3:4", "4:3", "4:5", "5:4", "1:8", "8:1", "9:16", "16:9", "21:9"],
    input: nanoInput,
  },
  {
    id: "nano-banana-pro",
    family: "nano",
    label: "Nano Banana Pro",
    note: "Best detail and text, slower",
    short: "Pro",
    credits: { "1K": 18, "2K": 18, "4K": 24 },
    resolutions: ["1K", "2K", "4K"],
    ratios: GOOGLE_RATIOS,
    input: nanoInput,
  },
  {
    id: "gpt-image-2-5-flare-image-to-image",
    family: "gpt",
    label: "GPT Image 2.5 Flare",
    short: "2.5 Flare",
    note: "Newest GPT, quicker",
    credits: { "1K": 6, "2K": 10, "4K": 16 },
    resolutions: ["1K", "2K", "4K"],
    ratios: GPT_RATIOS,
    input: (prompt, urls, ratio, res) => ({ prompt, input_urls: urls, aspect_ratio: ratio, resolution: res, background: "opaque" }),
  },
  {
    id: "gpt-image-2-5-sunburst-image-to-image",
    family: "gpt",
    label: "GPT Image 2.5 Sunburst",
    short: "2.5 Sunburst",
    note: "Newest GPT, best detail",
    credits: { "1K": 6, "2K": 10, "4K": 16 },
    resolutions: ["1K", "2K", "4K"],
    ratios: GPT_RATIOS,
    input: (prompt, urls, ratio, res) => ({ prompt, input_urls: urls, aspect_ratio: ratio, resolution: res, background: "opaque" }),
  },
  {
    id: "gpt-image-2-image-to-image",
    family: "gpt",
    label: "GPT Image 2",
    short: "2",
    note: "Strong at signs and lettering",
    textId: "gpt-image-2-text-to-image",
    credits: { "1K": 6, "2K": 10, "4K": 16 },
    resolutions: ["1K", "2K", "4K"],
    ratios: GPT_RATIOS,
    input: (prompt, urls, ratio, res) => (urls.length ? { prompt, input_urls: urls, aspect_ratio: ratio, resolution: res } : { prompt, aspect_ratio: ratio, resolution: res }),
  },
  {
    id: "seedream/5-pro-image-to-image",
    family: "seedream",
    label: "Seedream 5.0 Pro",
    note: "1K or 2K, rich materials",
    short: "5.0 Pro",
    credits: { "1K": 7, "2K": 14 },
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
    short: "5 Flash",
    note: "Fastest Seedream, 2K only",
    // Same price at every size on Kie, so it is locked to 2K.
    credits: { "2K": 3.24 },
    resolutions: ["2K"],
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

/** Kie credits are bought at 200 per US dollar (list rate). */
export const USD_PER_CREDIT = 0.005;

/** Credits per image at the resolution used, or null when Kie does not publish the price. */
export function creditsFor(m: KieModel, wanted: KieResolution): number | null {
  return m.credits?.[resolutionFor(m, wanted)] ?? null;
}

/** Price per image in USD at the resolution used, or null when Kie does not publish it. */
export function priceFor(m: KieModel, wanted: KieResolution): number | null {
  const c = creditsFor(m, wanted);
  return c === null ? null : c * USD_PER_CREDIT;
}

export function priceText(m: KieModel, wanted: KieResolution): string {
  const p = priceFor(m, wanted);
  if (p === null) return "price on kie.ai";
  return `~$${p < 0.1 ? p.toFixed(3).replace(/0$/, "") : p.toFixed(2)}`;
}

/** 6 stays 6, 3.24 stays 3.24, 6.480001 becomes 6.48. */
export function creditNumber(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** A price list from the website: { "credits": { "<model id>": { "2K": 6 } } }. */
export interface PriceList {
  updated?: string;
  credits: Record<string, Partial<Record<KieResolution, number>>>;
}

/** Applies a price list over the built-in prices; returns how many models changed. */
export function applyPriceList(list: PriceList): number {
  let n = 0;
  for (const m of KIE_MODELS) {
    const next = list.credits?.[m.id];
    if (!next) continue;
    const clean = Object.fromEntries(Object.entries(next).filter(([r, v]) => (m.resolutions as string[]).includes(r) && typeof v === "number" && v > 0 && v < 1000));
    if (!Object.keys(clean).length) continue;
    if (JSON.stringify(clean) !== JSON.stringify(m.credits)) n++;
    m.credits = { ...m.credits, ...clean };
  }
  return n;
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

