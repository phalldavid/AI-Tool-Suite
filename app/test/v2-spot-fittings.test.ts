import { test } from "node:test";
import assert from "node:assert/strict";
import { GLOBAL_PRESETS, ZONE_GROUPS, appendLine, materialSentence } from "../src/lib/spot";
import { DEFAULT_FITTINGS, fittingsFor, fittingsLine } from "../src/lib/fittings";
import { ENV_SHEETS, envSheetPrompt } from "../src/lib/envPreviews";
import { CONTEXT_GROUPS } from "../src/core/context";

test("zone quick actions add sentences without repeating them", () => {
  const add = ZONE_GROUPS[0].actions.find((a) => a.id === "add-led")!.text;
  const once = appendLine("", add);
  assert.equal(appendLine(once, add), once);
  assert.equal(appendLine("Keep the sofa.", add), `Keep the sofa.\n${add}`);
  assert.equal(materialSentence("floor", "travertine"), "Change the floor here to travertine, with realistic texture, scale and reflections.");
  assert.match(GLOBAL_PRESETS.find((g) => g.id === "day-night")!.text, /every interior and exterior light fitting switched on/);
});

test("fittings change with interior or exterior, and say nothing when nothing is picked", () => {
  assert.ok(fittingsFor("interior").some((f) => f.id === "cove"));
  assert.ok(!fittingsFor("exterior").some((f) => f.id === "cove"));
  assert.equal(fittingsLine("interior", DEFAULT_FITTINGS.interior), null);
  const line = fittingsLine("interior", { on: true, types: ["ceiling", "cove"], other: "", kelvin: 3000, level: 2 })!;
  assert.match(line, /bright brightness, 3000K soft white: recessed ceiling downlights, indirect cove lighting/);
  assert.match(fittingsLine("exterior", { ...DEFAULT_FITTINGS.exterior, on: false })!, /switched off/);
});

test("environment sheets cover every environment exactly once", () => {
  const all = CONTEXT_GROUPS.flatMap((g) => g.items.map((i) => i.id)).sort();
  const sheets = ENV_SHEETS.flatMap((s) => s.ids).sort();
  assert.deepEqual(sheets, all);
  for (const s of ENV_SHEETS) {
    assert.equal(s.ids.length, s.cols * s.rows);
    const p = envSheetPrompt(s);
    assert.match(p, /4 x 3 grid of 12 equal panels/);
    assert.match(p, /\n12\. /);
  }
});
