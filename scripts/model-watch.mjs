// Pure helpers for the Monday model check: find image models named on Kie's
// pages that the app's model list doesn't have yet.

const FAMILIES = [
  /Nano Banana(?:\s+(?:Pro|Flash|\d+(?:\.\d+)?))*/g,
  /GPT[- ]Image(?:[- ]\d+(?:\.\d+)?)?(?:\s+(?:Mini|Flare|Sunburst|Pro|Flash|[A-Z][a-z]+))?/g,
  /Seedream(?:\s+(?:\d+(?:\.\d+)?))?(?:\s+(?:Pro|Flash|Lite))?/g,
  /Flux(?:\.\d+|\s+\d+(?:\.\d+)?)?(?:\s+(?:Pro|Max|Klein|Dev|Kontext|Flex))*/g,
  /Qwen[- ]Image(?:[- ](?:Edit|\d+(?:\.\d+)?))*/g,
  /Imagen\s*\d+(?:\.\d+)?(?:\s+(?:Ultra|Fast))?/g,
];

/** Lower case, no spaces or dashes: "GPT Image 2.5 Flare" -> "gptimage2.5flare". */
export function norm(name) {
  return String(name).toLowerCase().replace(/[\s_-]+/g, "");
}

/** Model labels and ids from kie-models.ts source text. */
export function knownModels(source) {
  const out = new Set();
  for (const m of source.matchAll(/(?:label|id):\s*"([^"]+)"/g)) out.add(norm(m[1]));
  return out;
}

/** Visible text of an HTML page, tags and scripts removed. */
export function pageText(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

/** Image model names in the text that aren't in `known`, deduplicated, longest name first. */
export function newModels(text, known) {
  const found = new Map();
  for (const re of FAMILIES) {
    for (const m of text.matchAll(re)) {
      const name = m[0].trim();
      const key = norm(name);
      if (key.length < 6 || known.has(key)) continue;
      // A bare family name ("Seedream") is not a model.
      if (/^(nanobanana|gptimage|seedream|flux|qwenimage)$/.test(key)) continue;
      if (!found.has(key)) found.set(key, name);
    }
  }
  return [...found.values()].sort((a, b) => a.localeCompare(b));
}
