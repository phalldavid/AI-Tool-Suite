import { test } from "node:test";
import assert from "node:assert/strict";
import { BOARD_PRESETS, boardAspect, boardLayout, buildBoardPrompt, findBoardPreset, sheetMm, sheetPixels } from "../src/core/boards";

test("A-series sheets in mm, with orientation", () => {
  assert.deepEqual(sheetMm("A1", "landscape"), [841, 594]);
  assert.deepEqual(sheetMm("A1", "portrait"), [594, 841]);
  assert.deepEqual(sheetMm("A3", "portrait"), [297, 420]);
});

test("layout fits inside the sheet: margins, picture, then the band", () => {
  for (const size of ["A0", "A1", "A2", "A3"] as const) {
    for (const orient of ["landscape", "portrait"] as const) {
      const L = boardLayout(size, orient);
      assert.ok(L.pic.x > 0 && L.pic.y > 0);
      assert.ok(L.pic.y + L.pic.h < L.band.y, "picture ends above the band");
      assert.ok(Math.abs(L.band.y + L.band.h + L.margin - L.h) < 0.2, "band sits on the bottom margin");
      assert.ok(Math.abs(L.pic.x + L.pic.w + L.margin - L.w) < 0.2);
    }
  }
});

test("the model is asked for a picture shape that matches the sheet", () => {
  assert.equal(boardAspect("A1", "landscape"), "16:9");
  assert.ok(["3:4", "4:5"].includes(boardAspect("A1", "portrait")));
});

test("board prompt: orientation, subject, layout, and no text at all", () => {
  const p = buildBoardPrompt({ preset: findBoardPreset("joinery"), subject: "bathroom vanity", orient: "portrait" });
  assert.match(p, /single portrait sheet/);
  assert.match(p, /front view, a side view and a top view/);
  assert.match(p, /flat views of the bathroom vanity/);
  assert.match(p, /NO TEXT: no words, letters, numbers/);
  assert.doesNotMatch(p, /\{subject\}/);
});

test("every preset fills its subject and has pin suggestions", () => {
  for (const preset of BOARD_PRESETS) {
    const p = buildBoardPrompt({ preset, subject: "X-SUBJECT", orient: "landscape" });
    assert.match(p, /X-SUBJECT/);
    assert.doesNotMatch(p, /\{subject\}/);
    assert.ok(preset.pins.length > 0, preset.id);
  }
});

test("A1 at 150 dpi, big sheets capped for the browser", () => {
  const a1 = sheetPixels("A1", "landscape");
  assert.equal(a1.w, 4967);
  assert.equal(a1.h, 3508);
  const a0 = sheetPixels("A0", "landscape", 300);
  assert.ok(a0.w * a0.h <= 40_000_000);
});
