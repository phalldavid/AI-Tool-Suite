import { test } from "node:test";
import assert from "node:assert/strict";
import { composeSlorCheam } from "../src/core/render-prompt";
import type { RenderTabInput } from "../src/core/render-prompt";
import { BUILT_IN_PRESETS } from "../src/core/presets";
import { DEFAULT_SETTINGS } from "../src/core/settings";
import { DEFAULT_FITTINGS } from "../src/lib/fittings";
import { PLACEHOLDER_RULE } from "../src/core/prompt";
import { SLOR_CHEAM_HARDSCAPE, SLOR_CHEAM_OPENING, SLOR_CHEAM_PLANTING } from "../src/core/slor-cheam";
import type { ProjectType } from "../src/core/types";

const S = DEFAULT_SETTINGS;
const presetOf = (type: ProjectType) => BUILT_IN_PRESETS.find((p) => p.projectType === type)!;

function input(over: Partial<RenderTabInput> = {}): RenderTabInput {
  return {
    preset: presetOf("exterior"),
    lightScene: null,
    fittings: { interior: DEFAULT_FITTINGS.interior, exterior: DEFAULT_FITTINGS.exterior },
    dynamic: S.dynamic,
    sunLine: null,
    hasLinePass: false,
    lineStrength: S.lineStrength,
    look: S.look,
    materialLock: S.materialLock,
    boundaryLock: S.boundaryLock,
    avoid: "CGI look, cartoon",
    noteLines: [],
    notes: "",
    ...over,
  };
}

test("one fixed opening, camera and geometry lock, material and boundary lock", () => {
  const p = composeSlorCheam(input()).prompt;
  assert.ok(p.startsWith(SLOR_CHEAM_OPENING));
  assert.match(p, /Camera lock:/);
  assert.match(p, /Geometry lock:/);
  assert.match(p, /Material lock:/);
  assert.match(p, /Boundary lock:/);
});

test("indoors gets no paving, planting or green-ground text", () => {
  const p = composeSlorCheam(input({ preset: presetOf("interior") })).prompt;
  for (const block of [SLOR_CHEAM_HARDSCAPE, SLOR_CHEAM_PLANTING, PLACEHOLDER_RULE]) assert.ok(!p.includes(block), block.slice(0, 30));
  // the interior light switch also counts as indoors
  const sw = composeSlorCheam(input({ lightScene: "interior" })).prompt;
  assert.ok(!sw.includes(SLOR_CHEAM_PLANTING));
});

test("outdoors gets paving, planting and the green-ground fix", () => {
  const p = composeSlorCheam(input()).prompt;
  for (const block of [SLOR_CHEAM_HARDSCAPE, SLOR_CHEAM_PLANTING, PLACEHOLDER_RULE]) assert.ok(p.includes(block));
});

test("the user's own time and sun lines pass through unchanged", () => {
  const p = composeSlorCheam(input({ preset: { ...presetOf("exterior"), lighting: "time:16:30" } })).prompt;
  assert.match(p, /^Lighting: .+\.$/m);
  const sun = composeSlorCheam(input({ sunLine: "Sun: low from the west, 25° above the horizon." })).prompt;
  assert.ok(sun.includes("Sun: low from the west, 25° above the horizon."));
  assert.doesNotMatch(sun, /^Lighting: /m, "the exact sun replaces the dial light");
});

test("notes go on top, Avoid stays last", () => {
  const p = composeSlorCheam(input({ notes: "Keep the timber louvres dark" })).prompt;
  assert.ok(p.indexOf("Keep the timber louvres dark") < p.indexOf(SLOR_CHEAM_OPENING));
  const lines = p.trim().split("\n");
  assert.equal(lines[lines.length - 1], "Avoid: CGI look, cartoon.");
});

test("the SketchUp material list appears only when given", () => {
  assert.doesNotMatch(composeSlorCheam(input()).prompt, /Material list/);
  const p = composeSlorCheam(input(), ["Floor: Polished concrete, grey", "Walls and facade: White render"]).prompt;
  assert.match(p, /Material list[^\n]*\n- Floor: Polished concrete, grey\n- Walls and facade: White render/);
});

test("the style preset text is not used", () => {
  const preset = { ...presetOf("exterior"), style: "UNIQUE-STYLE-WORDS" };
  assert.doesNotMatch(composeSlorCheam(input({ preset })).prompt, /UNIQUE-STYLE-WORDS/);
});

test("the Environment picks are kept", () => {
  const p = composeSlorCheam(input({ preset: { ...presetOf("exterior"), environment: "tropical-garden" } })).prompt;
  assert.match(p, /^Surroundings: .*tropical garden/m);
  assert.doesNotMatch(composeSlorCheam(input({ preset: { ...presetOf("interior"), environment: "keep" } })).prompt, /^Surroundings:/m);
});
