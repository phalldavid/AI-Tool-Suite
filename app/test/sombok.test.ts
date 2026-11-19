import { test } from "node:test";
import assert from "node:assert/strict";
import { buildStyleMatchPrompt } from "../src/core/style-match";
import { buildFloorplanPrompt, DEFAULT_PLAN } from "../src/core/floorplan";
import { buildRenderPrompt, PLACEHOLDER_RULE } from "../src/core/prompt";
import { BUILT_IN_PRESETS } from "../src/core/presets";

test("style match: target first, chosen parts and strength", () => {
  const p = buildStyleMatchPrompt(["lighting", "grade"], "subtle");
  assert.match(p, /Image 1 = TARGET/);
  assert.match(p, /Step 2 - Read Image 2 for: lighting direction.*; overall colour grade/);
  assert.doesNotMatch(p, /Step 2[^\n]*materials, textures/);
  assert.match(p, /keep Image 1's own materials/);
  assert.match(p, /geometry of Image 1 > camera of Image 1 > look of Image 2/);
});

test("floorplan: cut height, rules and only one preset block", () => {
  const p = buildFloorplanPrompt({ ...DEFAULT_PLAN, preset: "tropical", cutHeight: 900, furniture: "furnish", labels: "keep" });
  assert.match(p, /at 900 mm/);
  assert.match(p, /furnish empty rooms/);
  assert.match(p, /keep the room names/);
  assert.match(p, /terrazzo/);
  assert.doesNotMatch(p, /light oak plank/);
  assert.match(buildFloorplanPrompt(DEFAULT_PLAN), /No people, no text at all/);
});

test("exterior renders ask for SketchUp's green ground and white sky to be replaced", () => {
  const ext = BUILT_IN_PRESETS.find((p) => p.projectType === "exterior")!;
  assert.ok(buildRenderPrompt({ preset: ext, notes: "", hasLinePass: false }).includes(PLACEHOLDER_RULE));
  const int = BUILT_IN_PRESETS.find((p) => p.projectType === "interior" && (p.environment === "keep" || !p.environment));
  if (int) assert.ok(!buildRenderPrompt({ preset: int, notes: "", hasLinePass: false }).includes(PLACEHOLDER_RULE));
});
