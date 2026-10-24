// Writes web/src/preview-files.ts: the card ids that have their own picture
// in web/public/previews/<id>.webp. Runs on every build, so adding or
// removing a picture needs no hand edit.
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";

const dir = "web/public/previews";
const ids = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".webp")).map((f) => f.slice(0, -5)).sort() : [];
const out = `// Card ids with their own preview picture in web/public/previews/<id>.webp.
// Written by scripts/list-previews.mjs on every build. Do not edit by hand.

const IDS: string[] = ${JSON.stringify(ids)};

const set = new Set(IDS);

/** Relative path to the card's own picture, or null. Works from file:// in SketchUp too. */
export function previewFile(id: string): string | null {
  return set.has(id) ? \`previews/\${id}.webp\` : null;
}
`;
const file = "web/src/preview-files.ts";
if (!existsSync(file) || readFileSync(file, "utf8") !== out) writeFileSync(file, out);
console.log(`${ids.length} card pictures listed`);
