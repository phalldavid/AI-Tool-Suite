import { test } from "node:test";
import assert from "node:assert/strict";
import { nonePreset, parseScene, sceneLabel, scenePreset, sceneTemplate } from "../src/scene-scan";

test("scene scan: bathroom, Scandinavian picks that template and adds what was seen", () => {
  const s = parseScene('```json\n{"scene":"Interior","subject":"bathroom (Bathroom)","style":"scandinavian","details":"White hex tiles, oak vanity, walk-in shower with black frame."}\n```')!;
  assert.equal(s.scene, "interior");
  assert.equal(sceneTemplate(s)?.id, `int-${s.subject}-scandinavian`);
  assert.match(sceneLabel(s), /Interior · .*Bath.* · Scandinavian/);
  const p = scenePreset(s, nonePreset("exterior"));
  assert.equal(p.projectType, "interior");
  assert.match(p.style, /as in the image: White hex tiles, oak vanity/);
});

test("scene scan: unknown ids fall back, junk gives null", () => {
  const s = parseScene('{"scene":"exterior","subject":"castle","style":"gothic","details":""}')!;
  assert.ok(sceneTemplate(s), "closest template still found");
  assert.equal(parseScene("I think it is a bathroom"), null);
  assert.equal(parseScene('{"scene":"underwater"}'), null);
});

test("none preset adds nothing", () => {
  const p = nonePreset("interior");
  assert.equal(p.style, "");
  assert.equal(p.environment, "keep");
});

test("none preset: prompt has no style, lighting or surroundings line", async () => {
  const { buildRenderPrompt } = await import("../src/prompt");
  const out = buildRenderPrompt({ preset: nonePreset("interior"), notes: "", hasLinePass: false, extras: [] } as Parameters<typeof buildRenderPrompt>[0]);
  assert.doesNotMatch(out, /Materials and style:|Lighting:|Surroundings:/);
});

test("detecting twice on a sketch replaces the earlier words", () => {
  const s = parseScene('{"scene":"sketch","subject":"","style":"","details":"Two-storey house, flat roof."}')!;
  const once = scenePreset(s, { ...nonePreset("sketch"), style: "pencil look" });
  const twice = scenePreset({ ...s, details: "Same house, timber louvers." }, once);
  assert.equal(twice.style, "pencil look; as in the image: Same house, timber louvers");
});
