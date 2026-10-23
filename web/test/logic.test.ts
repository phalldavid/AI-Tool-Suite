import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRenderPrompt, buildSpotEditPrompt, lensHint, nearestAspectRatio } from "../src/prompt";
import { BUILT_IN_PRESETS, parsePresetFile } from "../src/presets";
import { fillWorkflow } from "../src/providers/comfyui";
import { explainStatus, parseGeminiResponse } from "../src/providers/gemini";

test("nearest aspect ratio picks the closest supported ratio", () => {
  assert.equal(nearestAspectRatio(1920, 1080), "16:9");
  assert.equal(nearestAspectRatio(1600, 1200), "4:3");
  assert.equal(nearestAspectRatio(1000, 1000), "1:1");
  assert.equal(nearestAspectRatio(1080, 1920), "9:16");
  assert.equal(nearestAspectRatio(2520, 1080), "21:9");
});

test("render prompt keeps geometry, uses preset parts and lens", () => {
  const preset = BUILT_IN_PRESETS[0];
  const p = buildRenderPrompt({ preset, notes: "add a red gate", facts: { focalLengthMm: 28 }, hasLinePass: true });
  assert.match(p, /Keep the exact geometry/);
  assert.match(p, /line drawing/);
  assert.match(p, /blue hour/);
  assert.match(p, /borey/);
  assert.match(p, /28 mm lens/);
  assert.match(p, /add a red gate/);
});

test("render prompt skips line pass and default environment when absent", () => {
  const preset = { ...BUILT_IN_PRESETS[6], environment: "keep" };
  const p = buildRenderPrompt({ preset, hasLinePass: false });
  assert.doesNotMatch(p, /line drawing/);
  assert.doesNotMatch(p, /Surroundings:/);
  assert.match(p, /24 mm lens/);
});

test("lens hint for parallel projection", () => {
  assert.match(lensHint("exterior", { perspective: false }), /no perspective/);
});

test("spot edit prompt confines the change", () => {
  const p = buildSpotEditPrompt("replace the car with a tree");
  assert.match(p, /red area only: replace the car with a tree/);
});

test("preset file import accepts wrapped and bare lists, drops bad rows", () => {
  const good = { name: "A", projectType: "interior", style: "oak" };
  assert.equal(parsePresetFile({ presets: [good, { name: 3 }] }).length, 1);
  assert.equal(parsePresetFile([good, { name: "B", projectType: "spaceship" }]).length, 1);
  assert.deepEqual(parsePresetFile("nope"), []);
  assert.equal(parsePresetFile([good])[0].lighting, "morning");
});

test("built-in presets have unique ids", () => {
  const ids = BUILT_IN_PRESETS.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("ComfyUI workflow placeholders are filled", () => {
  const wf = JSON.stringify({
    "6": { inputs: { text: "{{PROMPT}}" } },
    "10": { inputs: { image: "{{IMAGE_1}}" } },
    "11": { inputs: { image: "{{IMAGE_2}}" } },
    "12": { inputs: { text: "style: {{PROMPT}}", seed: 5 } },
  });
  const out = fillWorkflow(wf, "a villa", ["a.png", "sub/b.png"]) as Record<string, { inputs: Record<string, unknown> }>;
  assert.equal(out["6"].inputs.text, "a villa");
  assert.equal(out["10"].inputs.image, "a.png");
  assert.equal(out["11"].inputs.image, "sub/b.png");
  assert.equal(out["12"].inputs.text, "style: a villa");
  assert.equal(out["12"].inputs.seed, 5);
  assert.throws(() => fillWorkflow(wf, "x", ["a.png"]), /image 2/);
  assert.throws(() => fillWorkflow("{bad", "x", []), /not valid JSON/);
});

test("Gemini response parsing finds the image part", () => {
  const r = parseGeminiResponse({
    candidates: [{ content: { parts: [{ text: "Here it is" }, { inlineData: { mimeType: "image/png", data: "AAAA" } }] } }],
  });
  assert.equal(r.image.data, "AAAA");
  assert.equal(r.note, "Here it is");
  const snake = parseGeminiResponse({ candidates: [{ content: { parts: [{ inline_data: { mime_type: "image/jpeg", data: "BB" } }] } }] });
  assert.equal(snake.image.mimeType, "image/jpeg");
  assert.throws(() => parseGeminiResponse({ candidates: [{ content: { parts: [{ text: "no" }] } }] }), /text instead/);
  assert.throws(() => parseGeminiResponse({ promptFeedback: { blockReason: "SAFETY" } }), /blocked/);
});

test("Gemini status messages are plain", () => {
  assert.match(explainStatus(429, ""), /quota/);
  assert.match(explainStatus(400, "API key not valid"), /rejected the API key/);
});
