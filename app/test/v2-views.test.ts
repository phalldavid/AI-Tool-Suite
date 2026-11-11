import { test } from "node:test";
import assert from "node:assert/strict";
import { cameraViewPrompt, partOfDay, shotViewPrompt, sunWords } from "../src/lib/views";
import { BUILT_IN_NOTES, labelFor, noteLines } from "../src/lib/notes";

test("sun is described against the building", () => {
  assert.equal(sunWords({ bearing: 249, elevation: 14, when: "late afternoon" }), "sun from the west-south-west, low at about 14°, late afternoon");
  assert.match(sunWords({ elevation: -3 }), /below the horizon/);
  assert.equal(partOfDay(16.5), "late afternoon");
});

test("exterior and interior views get only their own lines", () => {
  const ext = shotViewPrompt({ type: "exterior", sun: "sun from the west", notes: [] });
  const int = shotViewPrompt({ type: "interior", sun: "sun from the west", notes: ["N1."] });
  assert.match(ext, /green ground plane/);
  assert.doesNotMatch(ext, /section cut/);
  assert.match(int, /section cut/);
  assert.doesNotMatch(int, /green ground plane/);
  assert.match(int, /N1\./);
  assert.match(ext, /Priority if anything conflicts: geometry of Image 1 > camera of Image 1 > look of Image 2\.$/);
});

test("camera view keeps unseen sides simple", () => {
  const p = cameraViewPrompt("Camera: 35° to the right.", "sun from the west", []);
  assert.match(p, /Do not invent new features/);
  assert.match(p, /35° to the right/);
});

test("note chips become sentences, glass colour filled in", () => {
  const lines = noteLines(["led", "glass"], BUILT_IN_NOTES, "blue");
  assert.equal(lines[0], "Turn the blue solid-colour surfaces into clear glass with natural reflections.");
  assert.equal(lines[1], "Turn the orange and yellow solid colors into glowing warm-white 3300K LED strips.");
  assert.equal(labelFor("Turn the red solid colors into brick."), "Turn the red solid");
});
