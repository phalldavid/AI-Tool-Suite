import { test } from "node:test";
import assert from "node:assert/strict";
import { appendLine, removeLine, ZONE_GROUPS, PLANTS } from "../src/lib/spot";
import { styleCopyPrompt } from "../src/lib/lighting";

test("quick actions toggle: add then remove leaves the zone text as it was", () => {
  const led = ZONE_GROUPS[0].actions.find((a) => a.id === "add-led")!;
  const start = "Make it brighter.";
  const added = appendLine(start, led.text);
  assert.ok(added.includes(led.text));
  assert.equal(removeLine(added, led.text), start);
});

test("every add action has a remove pair and back", () => {
  const all = ZONE_GROUPS.flatMap((g) => g.actions);
  for (const a of all.filter((x) => x.pair)) assert.equal(all.find((y) => y.id === a.pair)?.pair, a.id, a.id);
});

test("plant list has the Golden Pothos sentence and unique ids", () => {
  assert.ok(PLANTS.some((p) => p.text.includes("Golden Pothos") && p.text.includes("wall shelf")));
  assert.equal(new Set(PLANTS.map((p) => p.id)).size, PLANTS.length);
});

test("style copy keeps Image 1's orientation", () => {
  const p = styleCopyPrompt({ scene: "interior", dialLight: null, base: { width: 1080, height: 1920, ratio: "9:16" } });
  assert.match(p, /portrait \(taller than wide\), 9:16/);
  assert.match(p, /Ignore the orientation and aspect ratio of Image 2/);
  const q = styleCopyPrompt({ scene: "exterior", dialLight: null });
  assert.match(q, /orientation and aspect ratio of Image 1/);
});
