// Monday model check (run by .github/workflows/models.yml).
// Reads Kie's public pages, compares the image models they name with
// app/src/core/providers/kie-models.ts and writes app/public/model-watch.json.
// Prints changed=true to $GITHUB_OUTPUT when the list of new models changed,
// so the workflow can open a pull request. It never edits the model list itself:
// each model needs its own request fields and price checked first.

import { readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { knownModels, newModels, pageText } from "./model-watch.mjs";

const PAGES = ["https://kie.ai/pricing", "https://kie.ai/market", "https://docs.kie.ai/"];
const OUT = "app/public/model-watch.json";

const known = knownModels(readFileSync("app/src/core/providers/kie-models.ts", "utf8"));
const found = new Map();
let reached = 0;
for (const url of PAGES) {
  try {
    const res = await fetch(url, { headers: { "user-agent": "david-render-studio-model-check" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    reached++;
    for (const name of newModels(pageText(await res.text()), known)) if (!found.has(name)) found.set(name, url);
  } catch (e) {
    console.warn(`Couldn't read ${url}: ${e.message}`);
  }
}
if (!reached) {
  console.warn("No Kie page could be read; nothing changed.");
  process.exit(0);
}
const list = [...found].map(([name, source]) => ({ name, source })).sort((a, b) => a.name.localeCompare(b.name));
const before = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")).new ?? [] : [];
const changed = JSON.stringify(before.map((x) => x.name)) !== JSON.stringify(list.map((x) => x.name));
if (changed) {
  writeFileSync(OUT, `${JSON.stringify({ checkedAt: new Date().toISOString(), new: list }, null, 2)}\n`);
  console.log(list.length ? `New on Kie: ${list.map((x) => x.name).join(", ")}` : "No new models any more.");
} else console.log("No change.");
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed && list.length > 0}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `names=${list.map((x) => x.name).join(", ")}\n`);
}
