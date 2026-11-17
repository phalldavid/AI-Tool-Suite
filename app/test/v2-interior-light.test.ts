import { test } from "node:test";
import assert from "node:assert/strict";
import { INTERIOR_SKY, buildRenderPrompt, LIGHTING } from "../src/core/prompt";
import { BUILT_IN_PRESETS } from "../src/core/presets";
import { KM } from "../src/lib/i18n";

const room = BUILT_IN_PRESETS.find((p) => p.id === "bathroom-stone")!;
const house = BUILT_IN_PRESETS.find((p) => p.id === "borey-villa-dusk")!;

test("interior prompts say sky and sun from inside the room", () => {
  const p = buildRenderPrompt({ preset: { ...room, lighting: "overcast" }, hasLinePass: false });
  assert.match(p, /soft even daylight falling into the room/);
  assert.doesNotMatch(p, /wet ground/);
  for (const id of Object.keys(INTERIOR_SKY)) {
    const q = buildRenderPrompt({ preset: { ...room, lighting: id }, hasLinePass: false });
    assert.doesNotMatch(q, /across the ground|under the overhangs|facade lighting/, id);
  }
});

test("exterior prompts keep the original sky wording", () => {
  const p = buildRenderPrompt({ preset: { ...house, lighting: "overcast" }, hasLinePass: false });
  assert.match(p, /wet ground with light reflections/);
  const text = LIGHTING.find((l) => l.id === "overcast")!.text;
  assert.ok(p.includes(text));
});

test("interior ids that are not overridden keep their text", () => {
  const p = buildRenderPrompt({ preset: { ...room, lighting: "blue-hour" }, hasLinePass: false });
  assert.ok(p.includes(LIGHTING.find((l) => l.id === "blue-hour")!.text));
});

test("new review buttons have Khmer text", () => {
  for (const k of ["Prompt saved", "Save as .txt", "Save as .json", "Couldn't save the file.", "Couldn't copy. Select the text and press Ctrl C.", "Copy"]) {
    assert.ok(KM[k], k);
  }
});
