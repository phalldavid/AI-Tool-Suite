import { test } from "node:test";
import assert from "node:assert/strict";
import { cropBox, padPlan, sameShape, upscalePrompt } from "../src/core/upscale";

test("padPlan: a picture a little narrower than 16:9 is padded on the sides only", () => {
  const p = padPlan(960, 561, "16:9");
  assert.equal(p.height, 561);
  assert.equal(p.width, Math.round(561 * 16 / 9));
  assert.equal(p.y, 0);
  assert.ok(p.x > 0 && !p.none);
});

test("padPlan: a taller picture is padded top and bottom", () => {
  const q = padPlan(1000, 700, "1:1");
  assert.equal(q.width, 1000);
  assert.equal(q.height, 1000);
  assert.equal(q.x, 0);
  assert.equal(q.y, 150);
});

test("padPlan: nothing to pad when the ratio already matches", () => {
  assert.equal(padPlan(1920, 1080, "16:9").none, true);
});

test("pad then crop gives back exactly the original shape at any result size", () => {
  const plan = padPlan(960, 561, "16:9");
  for (const [w, h] of [[2048, 1152], [3840, 2160], [1376, 774]]) {
    const b = cropBox(w, h, plan.crop);
    assert.ok(sameShape(b.w, b.h, 960, 561), `${w}x${h} -> ${b.w}x${b.h}`);
  }
});

test("upscale prompts lock the design and differ by strength", () => {
  const f = upscalePrompt("faithful");
  const e = upscalePrompt("enhance");
  for (const t of [f, e]) {
    assert.match(t, /same camera, framing and composition/);
    assert.match(t, /never invent new text/);
    assert.match(t, /soft blurred border/);
  }
  assert.notEqual(f, e);
  assert.match(e, /realism of materials/);
});
