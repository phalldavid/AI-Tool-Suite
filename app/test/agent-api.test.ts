import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBatch, buildPrompt, inferView, listOptions, listPresets, resolvePreset } from "../src/core/agent-api";
import { libraryItems } from "../src/core/library";

test("preset search finds Khmer presets and resolves by id, name and words", () => {
  const r = listPresets({ query: "khmer stilt", scene: "exterior" });
  assert.ok(r.total > 0);
  assert.ok(r.items.every((x) => x.scene === "exterior"));
  assert.equal(resolvePreset("int-bathroom-khmer")?.id, "int-bathroom-khmer");
  assert.equal(resolvePreset("Bathroom, stone and teak")?.id, "bathroom-stone");
  assert.ok(resolvePreset("bathroom japandi"));
  assert.equal(resolvePreset("zzzz nothing"), undefined);
});

test("build_prompt matches the panel's builder and applies overrides", () => {
  const r = buildPrompt({ preset: "bathroom-stone", lighting: "overcast", fixtures: { led: true, kelvin: 3000 }, view: "vanity", notes: "marble walls" });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.match(r.prompt, /Keep the exact geometry/);
  assert.match(r.prompt, /switched on at 3000K/);
  assert.match(r.prompt, /vanity, basin, mirror/);
  assert.match(r.prompt, /35 mm lens/);
  assert.match(r.prompt, /marble walls/);
  assert.match(r.prompt, /Avoid: CGI look/);
});

test("build_prompt reports bad input instead of throwing", () => {
  const a = buildPrompt({ preset: "nope nope nope" });
  assert.equal(a.ok, false);
  const b = buildPrompt({ preset: "bathroom-stone", lighting: "no-such-light" });
  assert.equal(b.ok, false);
  const c = buildPrompt({ preset: "bathroom-stone", environment: "no-such-place" });
  assert.equal(c.ok, false);
  const d = buildPrompt({ preset: "bathroom-stone", view: "no-such-view" });
  assert.equal(d.ok, false);
});

test("batch guesses the view from the file name", () => {
  assert.equal(inferView("EXP_B03-2 Vanity.jpg"), "vanity");
  assert.equal(inferView("EXP_M01-2 Shower-Tub.jpg"), "shower");
  assert.equal(inferView("Bath Tub.jpg"), "tub");
  assert.equal(inferView("plain.jpg"), undefined);
  const out = buildBatch({ preset: "bathroom-stone" }, [{ image: "EXP_B02 Wide.jpg" }, { image: "EXP_B03-3 Shower.jpg" }]);
  assert.equal(out[0].view, "wide");
  assert.equal(out[1].view, "shower");
  assert.ok(out.every((x) => x.result.ok));
});

test("options and library stay consistent", () => {
  const o = listOptions();
  assert.equal(o.presetCount, libraryItems().length);
  assert.ok(o.lighting.some((l) => l.id === "overcast"));
  assert.ok(o.environments.length > 0);
});

test("the preset count shown in the UI matches the library", async () => {
  const { readFileSync } = await import("node:fs");
  const n = String(libraryItems().length);
  for (const file of ["src/ui/Header.tsx", "src/ui/Palette.tsx", "src/lib/i18n.ts"]) {
    const text = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.ok(text.includes(n), `${file} should mention ${n} presets`);
  }
});
