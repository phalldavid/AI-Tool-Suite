import { test } from "node:test";
import assert from "node:assert/strict";
import { solar, sector, sunPromptLine, compass, toCamera } from "../src/lib/sun";
import { cameraPromptLine, cameraHeight, fieldOfView } from "../src/lib/camera";
import { splitTypology, namedType } from "../src/lib/typology";
import { lintPrompt } from "../src/lib/lint";
import { backendStatus } from "../src/lib/status";
import { renderCost } from "../src/lib/cost";
import { DEFAULT_SETTINGS } from "../src/core/settings";

test("sun: Phnom Penh 11 Nov 16:30 is low in the west-southwest", () => {
  const s = solar(315, 16.5);
  assert.ok(Math.abs(s.elevation - 13.9) < 0.6, `elevation ${s.elevation}`);
  assert.ok(Math.abs(s.bearing - 248.7) < 1, `bearing ${s.bearing}`);
  assert.equal(compass(s.bearing), "WSW");
});

test("sun: in June the afternoon sun is north of west", () => {
  const s = solar(172, 16.5);
  assert.ok(s.bearing > 280 && s.bearing < 300, `bearing ${s.bearing}`);
});

test("sun: labels stick until 5 degrees past the boundary", () => {
  const first = sector(110);
  assert.equal(first, 2);
  assert.equal(sector(116, first), 2);
  assert.equal(sector(118, first), 3);
});

test("sun: prompt line has numbers and words", () => {
  const line = sunPromptLine({ toCamera: 225, elevation: 14, bearing: 249, when: "11 Nov, 16:30, Phnom Penh" });
  assert.match(line, /behind the camera, from the left/);
  assert.match(line, /135° to the left/);
  assert.match(line, /14° above the horizon, low/);
  assert.match(line, /249° WSW/);
  assert.match(line, /Shadows fall away and to the right, long/);
  assert.match(sunPromptLine({ toCamera: 0, elevation: -5 }), /^Night/);
  assert.equal(toCamera(249, 336), 225);
});

test("camera: prompt line and height", () => {
  const m = { orbit: 35, tilt: 15, lensMm: 35, distanceM: 35 };
  assert.equal(Math.round(fieldOfView(35)), 54);
  assert.ok(Math.abs(cameraHeight(m) - 10.66) < 0.05);
  assert.match(cameraPromptLine(m), /move 35° to the right/);
  assert.match(cameraPromptLine({ ...m, orbit: -20, tilt: 0 }), /move 20° to the left.*eye level/);
});

test("typology: building type leaves, style stays (H-02)", () => {
  const r = splitTypology("row of four-storey shophouses, flat roof with thin projecting slabs, teak shutters, terrazzo floors");
  assert.equal(r.style, "teak shutters, terrazzo floors");
  assert.equal(r.removed.length, 2);
  assert.equal(namedType("modern shophouse row"), "shophouse");
  assert.equal(splitTypology("timber louvres, laterite base, deep eaves").removed.length, 0);
});

test("lint: plate text removes 'text' from the avoid list (H-04)", () => {
  const p = [
    "Turn the first image into a photo.",
    "Additional notes: number plate reads D4VID.",
    "Make it look like a real photograph. No text, no watermark, no illustration style.",
    "Avoid: CGI look, warped lines, text, watermark.",
  ].join("\n");
  const r = lintPrompt(p);
  assert.equal(r.fixes.length, 1);
  assert.doesNotMatch(r.prompt.split("\n")[3], /\btext\b/);
  assert.match(r.prompt, /Only the text asked for/);
});

test("lint: day and night together is flagged", () => {
  const r = lintPrompt("Lighting: blue hour at 18:45, deep blue sky.\nTime: tropical sun at 12:00, high in the sky.");
  assert.equal(r.warnings.length, 1);
});

test("status: copy-paste is never 'Connected' (H-01)", () => {
  const s = { ...DEFAULT_SETTINGS, backend: "browser" as const };
  assert.equal(backendStatus(s, "ok").tone, "neutral");
  assert.match(backendStatus(s, "ok").label, /Free/);
  const k = { ...DEFAULT_SETTINGS, backend: "kie" as const, kieKey: "abc" };
  assert.equal(backendStatus(k, "bad").label, "Key rejected");
  assert.equal(backendStatus(k, "ok").tone, "ok");
  assert.equal(backendStatus({ ...k, kieKey: "" }, "ok").tone, "bad");
});

test("cost: free paths are free, Kie shows credits (M-03)", () => {
  assert.equal(renderCost({ ...DEFAULT_SETTINGS, backend: "browser" }).paid, false);
  const c = renderCost({ ...DEFAULT_SETTINGS, backend: "kie", kieKey: "x", kieModel: "nano-banana-2-1", kieResolution: "2K", imageCount: 2 });
  assert.equal(c.paid, true);
  assert.ok(c.credits === null || c.credits > 0);
});
