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

import { frameRect, FRAMES } from "../src/frame";
import { beamIntensity, BEAMS, kelvinToRgb, ledIntensity, LED_PROFILES, settingsId } from "../src/lightgen";
import { fixtureLines, sketchUpSunText, lightingText, ASPECT_RATIOS } from "../src/prompt";

test("frame rect fits the ratio inside the viewport, centred", () => {
  assert.deepEqual(frameRect(1200, 800, 0), [0, 0, 1200, 800]);
  const [x, y, w, hh] = frameRect(1200, 800, 16 / 9);
  assert.equal(x, 0);
  assert.ok(Math.abs(w / hh - 16 / 9) < 1e-9);
  assert.ok(Math.abs(y - (800 - hh) / 2) < 1e-9);
  const p = frameRect(1200, 800, 9 / 16);
  assert.equal(p[3], 800);
  assert.ok(Math.abs(p[0] - (1200 - p[2]) / 2) < 1e-9);
});

test("every frame ratio is one Gemini can output", () => {
  for (const f of FRAMES.filter((f) => f.ratio)) assert.ok(ASPECT_RATIOS.includes(f.id), f.id);
});

test("colour temperature runs warm to cool", () => {
  const warm = kelvinToRgb(2700);
  const cool = kelvinToRgb(6500);
  assert.equal(warm[0], 255);
  assert.ok(warm[2] < cool[2]);
  assert.ok(cool[2] > 240);
});

test("beams are brightest at the source and fade with distance", () => {
  for (const b of BEAMS) {
    assert.ok(beamIntensity(b, 0, 0.05) > beamIntensity(b, 0, 0.8), b.id);
    assert.ok(beamIntensity(b, 0, 0.3) >= beamIntensity(b, 0.95, 0.3), b.id);
  }
  for (const p of LED_PROFILES) assert.ok(ledIntensity(p, 0) > ledIntensity(p, 0.9));
  assert.equal(settingsId("spot", { a: 1 }), settingsId("spot", { a: 1 }));
  assert.notEqual(settingsId("spot", { a: 1 }), settingsId("spot", { a: 2 }));
});

test("SketchUp sun time becomes plain lighting text", () => {
  assert.match(sketchUpSunText({ shadowTime: "2026-03-10T16:30" })!, /afternoon sun at 16:30, low from the west and to the south/);
  assert.match(sketchUpSunText({ shadowTime: "2026-06-10T07:15" })!, /morning sun .* slightly to the north/);
  assert.match(sketchUpSunText({ shadowTime: "2026-06-10T21:00" })!, /night/);
  assert.equal(sketchUpSunText({}), null);
  assert.match(lightingText("sketchup", {})!, /east/);
});

test("placed lights and mirrors are described in the prompt", () => {
  const lines = fixtureLines({ lights: { spots: 2, leds: 1, mirrors: 1, kelvin: [2700, 3000], visible: true } });
  assert.match(lines[0], /spotlights washing the walls and LED strips at about 2700K and 3000K/);
  assert.match(lines[1], /mirrors/);
  assert.deepEqual(fixtureLines({ lights: { spots: 2, leds: 0, mirrors: 0, kelvin: [], visible: false } }), []);
});
