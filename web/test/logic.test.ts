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
import { beamIrradiance, BEAMS, candela, kelvinToRgb, ledIrradiance, LED_PROFILES, settingsId } from "../src/lightgen";
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
    // half intensity at the beam angle, nothing behind the fitting
    assert.ok(Math.abs(candela({ ...b, ring: 0 }, (b.angle * Math.PI) / 180) - 0.5) < 1e-9, b.id);
    assert.equal(candela(b, Math.PI / 2), 0);
    // on the wall: centre line brighter than far off to the side, and it fades far down
    // a point well inside the scallop, where the cone meets the wall
    const y = (1.5 * b.offsetMm) / Math.tan((b.angle * Math.PI) / 180);
    assert.ok(beamIrradiance(b, 0, y) > beamIrradiance(b, y, y), b.id);
    assert.ok(beamIrradiance(b, 0, y) > beamIrradiance(b, 0, y * 20), b.id);
  }
  for (const p of LED_PROFILES) {
    assert.equal(ledIrradiance(p, 0), 1);
    assert.ok(ledIrradiance(p, 10) > ledIrradiance(p, 200));
  }
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

import { countSet, dynamicLines } from "../src/dynamic";

test("dynamic prompts leave out fields at No change", () => {
  assert.deepEqual(dynamicLines({}), []);
  assert.deepEqual(dynamicLines({ time: { time: "", sky: "" } }), []);
  const lines = dynamicLines({
    time: { time: "golden", ground: "puddles" },
    vehicles: { types: ["motorbikes", "tuktuks"], amount: "few", motion: "parked" },
    people: { region: "sea", type: "adults", density: "few" },
    material: { s1: "facade", m1: "laterite", f1: "" },
  });
  assert.equal(lines.length, 4);
  assert.match(lines[0], /^Time and weather: golden hour.*puddles/);
  assert.equal(lines[1], "Materials: the facade walls in local laterite block.");
  assert.match(lines[2], /add a few parked motorbikes and scooters and Cambodian tuk-tuks \(remorque\)\./);
  assert.match(lines[3], /^People: add a few people \(three to six\), Southeast Asian adults\./);
  assert.equal(countSet({ a: "", b: "x", c: [], d: ["y"] }), 2);
});

test("render prompt carries dynamic lines before the camera line", () => {
  const p = buildRenderPrompt({ preset: BUILT_IN_PRESETS[0], hasLinePass: false, extras: ["Vehicles: add one tuk-tuk."] });
  const lines = p.split("\n");
  const v = lines.indexOf("Vehicles: add one tuk-tuk.");
  assert.ok(v > 0 && lines[v + 1].startsWith("Camera:"));
});

import { geometryLines, parseDialTime, dialTimeId, sunPhase } from "../src/prompt";
import { contextText, joinContexts, parseContexts } from "../src/context";

test("line drawing strength changes how strict the prompt is", () => {
  assert.match(geometryLines(1).join(" "), /Geometry match: 100%.*strict source of truth/);
  assert.match(geometryLines(0.7).join(" "), /Geometry match: 70%.*Follow the line drawing closely/);
  assert.match(geometryLines(0.4).join(" "), /guide for the overall massing/);
  assert.match(geometryLines(0).join(" "), /loose reference/);
  assert.doesNotMatch(geometryLines(0.4).join(" "), /ignore that part/);
  const p = buildRenderPrompt({ preset: BUILT_IN_PRESETS[0], hasLinePass: true, lineStrength: 0.95 });
  assert.match(p, /Image 2 is a hidden-line drawing/);
  assert.ok(p.indexOf("Image 2") < p.indexOf("Materials and style"));
});

test("sun dial times round-trip and name the light", () => {
  assert.equal(dialTimeId(17.52), "time:17:30");
  assert.equal(parseDialTime("time:17:30"), 17.5);
  assert.equal(parseDialTime("morning"), null);
  assert.equal(sunPhase(6), "Dawn");
  assert.equal(sunPhase(17.5), "Golden hour");
  assert.equal(sunPhase(18.8), "Blue hour");
  assert.match(lightingText("time:16:00", { shadowTime: "2026-06-01T10:00" })!, /afternoon sun at 16:00, low from the west and slightly to the north/);
});

test("site contexts combine, keep custom text, and default to keep", () => {
  assert.deepEqual(parseContexts("keep"), []);
  assert.equal(contextText("keep"), null);
  assert.equal(joinContexts([]), "keep");
  const t = contextText("borey,custom:mango trees along the road")!;
  assert.match(t, /gated borey.*; mango trees along the road/);
  assert.match(contextText("pp-street")!, /Phnom Penh street/);
});

import { findFrame, ratioFromPixels, swapFrameId } from "../src/frame";
import { buildZoneEditPrompt, fixtureSettingsLine } from "../src/prompt";

test("frames swap, accept custom ratios and come from pixel sizes", () => {
  assert.equal(swapFrameId("4:5"), "5:4");
  assert.equal(swapFrameId("1:1"), "1:1");
  assert.equal(swapFrameId("free"), "free");
  assert.equal(findFrame("7:3").ratio, 7 / 3);
  assert.equal(findFrame("nonsense").id, "free");
  assert.deepEqual(ratioFromPixels(2500, 2000), { exact: "5:4", simple: "5:4", ratio: 1.25 });
  assert.equal(ratioFromPixels(1921, 1080)!.simple, "16:9");
  assert.equal(ratioFromPixels(0, 10), null);
});

test("zone edit prompt names each colour with its own change", () => {
  const p = buildZoneEditPrompt([
    { colour: "red", instruction: "remove the car." },
    { colour: "blue", instruction: "add a frangipani tree" },
  ]);
  assert.match(p, /areas painted in red and blue/);
  assert.match(p, /Inside the red area only: remove the car\.\n/);
  assert.match(p, /Inside the blue area only: add a frangipani tree\./);
});

test("fixture line follows the scene type", () => {
  const f = { exterior: true, led: true, strip: false, cabinet: true, kelvin: 2700 };
  assert.match(fixtureSettingsLine("exterior", f)!, /Exterior light fixtures switched on at 2700K/);
  assert.match(fixtureSettingsLine("interior", f)!, /downlights.*cabinet/);
  assert.equal(fixtureSettingsLine("exterior", { ...f, exterior: null }), null);
  assert.equal(fixtureSettingsLine("interior", { ...f, led: false, cabinet: false }), null);
  assert.match(dynamicLines({ plants: { kinds: ["frangipani", "lawn"], where: "front" } })[0], /^Plants: add frangipani trees and a neat green lawn in the front garden\./);
});
