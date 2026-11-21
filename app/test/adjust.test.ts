import { test } from "node:test";
import assert from "node:assert/strict";
import { ADJUST_GROUPS, BANDS, NEUTRAL, applyAdjust, boxBlur, curveLut, isNeutral, mixControl } from "../src/core/adjust";
import type { Adjust, Pixels } from "../src/core/adjust";

function solid(w: number, h: number, r: number, g: number, b: number): Pixels {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set([r, g, b, 255], i * 4);
  return { data, width: w, height: h };
}
const run = (px: Pixels, o: Partial<Adjust>) => { applyAdjust(px, { ...NEUTRAL, ...o }); return px; };
const at = (px: Pixels, x: number, y: number) => [...px.data.slice((y * px.width + x) * 4, (y * px.width + x) * 4 + 3)];

test("neutral settings leave every pixel exactly as it was", () => {
  const px = solid(8, 6, 12, 130, 250);
  const copy = new Uint8ClampedArray(px.data);
  run(px, {});
  assert.deepEqual([...px.data], [...copy]);
  assert.equal(isNeutral(NEUTRAL), true);
  assert.equal(isNeutral({ ...NEUTRAL, tint: 1 }), false);
});

test("exposure +1 brightens, -1 darkens, and alpha is untouched", () => {
  const up = run(solid(4, 4, 100, 100, 100), { exposure: 1 });
  const dn = run(solid(4, 4, 100, 100, 100), { exposure: -1 });
  assert.ok(at(up, 1, 1)[0] > 100 && at(dn, 1, 1)[0] < 100);
  assert.equal(up.data[3], 255);
  const hot = run(solid(4, 4, 200, 200, 200), { exposure: 2 });
  assert.deepEqual(at(hot, 0, 0), [255, 255, 255], "clips cleanly, no wrap-around");
});

test("shadows lift dark pixels far more than bright ones", () => {
  const dark = run(solid(4, 4, 30, 30, 30), { shadows: 100 });
  const bright = run(solid(4, 4, 230, 230, 230), { shadows: 100 });
  assert.ok(at(dark, 0, 0)[0] - 30 > 15);
  assert.ok(Math.abs(at(bright, 0, 0)[0] - 230) < 4);
});

test("highlights down darkens bright pixels and spares dark ones", () => {
  const bright = run(solid(4, 4, 230, 230, 230), { highlights: -100 });
  const dark = run(solid(4, 4, 30, 30, 30), { highlights: -100 });
  assert.ok(at(bright, 0, 0)[0] < 215);
  assert.ok(Math.abs(at(dark, 0, 0)[0] - 30) < 3);
});

test("contrast pushes darks darker and lights lighter", () => {
  assert.ok(at(run(solid(2, 2, 70, 70, 70), { contrast: 100 }), 0, 0)[0] < 70);
  assert.ok(at(run(solid(2, 2, 190, 190, 190), { contrast: 100 }), 0, 0)[0] > 190);
});

test("temperature warms (more red than blue) and cools the other way; tint moves green", () => {
  const warm = at(run(solid(2, 2, 128, 128, 128), { temperature: 100 }), 0, 0);
  const cool = at(run(solid(2, 2, 128, 128, 128), { temperature: -100 }), 0, 0);
  assert.ok(warm[0] > warm[2] && cool[2] > cool[0]);
  const mag = at(run(solid(2, 2, 128, 128, 128), { tint: 100 }), 0, 0);
  assert.ok(mag[1] < mag[0]);
});

test("saturation -100 gives grey; vibrance spares already vivid colours", () => {
  const g = at(run(solid(2, 2, 200, 80, 40), { saturation: -100 }), 0, 0);
  assert.ok(Math.abs(g[0] - g[1]) <= 1 && Math.abs(g[1] - g[2]) <= 1);
  const dull = at(run(solid(2, 2, 130, 120, 115), { vibrance: 100 }), 0, 0);
  const vivid = at(run(solid(2, 2, 250, 20, 20), { vibrance: 100 }), 0, 0);
  assert.ok(dull[0] - dull[2] > 15, "dull colour gets more colour");
  assert.ok(Math.abs(vivid[0] - 250) < 6, "vivid colour barely moves");
});

test("vignette darkens the corners, not the centre", () => {
  const px = run(solid(41, 41, 180, 180, 180), { vignette: -100 });
  assert.ok(at(px, 0, 0)[0] < 120);
  assert.equal(at(px, 20, 20)[0], 180);
});

test("flat pictures do not change under clarity, texture, sharpening or noise reduction", () => {
  for (const o of [{ clarity: 100 }, { texture: 100 }, { sharpen: 100 }, { noise: 100 }]) {
    const px = run(solid(30, 30, 140, 140, 140), o);
    assert.ok(Math.abs(at(px, 15, 15)[0] - 140) <= 1, JSON.stringify(o));
  }
});

test("sharpening raises contrast across an edge", () => {
  const px = solid(40, 10, 80, 80, 80);
  for (let y = 0; y < 10; y++) for (let x = 20; x < 40; x++) px.data.set([170, 170, 170, 255], (y * 40 + x) * 4);
  run(px, { sharpen: 100 });
  assert.ok(at(px, 18, 5)[0] < 80 && at(px, 21, 5)[0] > 170);
});

test("noise reduction smooths flat noise but keeps a strong edge", () => {
  const px = solid(40, 10, 100, 100, 100);
  for (let i = 0; i < 400; i++) { const v = 100 + (i % 2 ? 6 : -6); px.data.set([v, v, v, 255], i * 4); }
  for (let y = 0; y < 10; y++) for (let x = 20; x < 40; x++) px.data.set([220, 220, 220, 255], (y * 40 + x) * 4);
  run(px, { noise: 100 });
  const spread = Math.abs(at(px, 5, 5)[0] - at(px, 6, 5)[0]);
  assert.ok(spread < 6, "noise on the flat side is smaller");
  assert.ok(at(px, 25, 5)[0] > 200 && at(px, 15, 5)[0] < 130, "edge survives");
});

test("dehaze removes a grey veil: dark things get darker", () => {
  const out = at(run(solid(30, 30, 150, 150, 150), { dehaze: 100 }), 15, 15)[0];
  assert.ok(out < 150);
  assert.ok(at(run(solid(30, 30, 150, 150, 150), { dehaze: -100 }), 15, 15)[0] > 150 - 1);
});

test("grain is the same every time and only adds noise", () => {
  const a = run(solid(20, 20, 128, 128, 128), { grain: 60 });
  const b = run(solid(20, 20, 128, 128, 128), { grain: 60 });
  assert.deepEqual([...a.data], [...b.data]);
  const vals = new Set<number>(); for (let i = 0; i < 400; i++) vals.add(a.data[i * 4]);
  assert.ok(vals.size > 5);
});

test("boxBlur keeps a flat field flat and the mean the same", () => {
  const src = new Float32Array(25).fill(0.4);
  assert.ok(boxBlur(src, 5, 5, 2).every((v) => Math.abs(v - 0.4) < 1e-6));
});

test("every slider is listed once and has a sensible range", () => {
  const keys = ADJUST_GROUPS.flatMap((g) => g.items.map((i) => i.key));
  assert.equal(new Set(keys).size, keys.length);
  const mix = BANDS.flatMap((b) => (["h", "s", "l"] as const).map((k) => mixControl(k, b.id).key));
  assert.deepEqual([...keys, ...mix, "curve"].sort(), (Object.keys(NEUTRAL) as string[]).sort());
  for (const g of ADJUST_GROUPS) for (const i of g.items) assert.ok(i.min < i.max && i.min <= 0 && i.max > 0);
});

test("colour mix moves only its own colour band", () => {
  const red = at(run(solid(2, 2, 200, 40, 40), { s_red: -100 }), 0, 0);
  assert.ok(Math.max(...red) - Math.min(...red) < 40, "red loses its colour");
  const blue = at(run(solid(2, 2, 40, 40, 200), { s_red: -100 }), 0, 0);
  assert.deepEqual(blue, [40, 40, 200], "blue is untouched by the red band");
  const grey = at(run(solid(2, 2, 120, 120, 120), { h_red: 100, s_red: 100, l_red: 100 }), 0, 0);
  assert.deepEqual(grey, [120, 120, 120], "greys are left alone");
});

test("colour mix hue turns a red toward orange and luminance brightens it", () => {
  const o = at(run(solid(2, 2, 200, 40, 40), { h_red: 100 }), 0, 0);
  assert.ok(o[1] > 40 + 20, "more green means it moved toward orange");
  const l = at(run(solid(2, 2, 200, 40, 40), { l_red: 100 }), 0, 0);
  assert.ok(l[0] + l[1] + l[2] > 280);
});

test("curve: a straight line changes nothing, a lifted middle brightens midtones only", () => {
  const id = curveLut([[0, 0], [1, 1]]);
  for (let i = 0; i < 256; i++) assert.equal(id[i], i);
  const lift = curveLut([[0, 0], [0.5, 0.7], [1, 1]]);
  assert.ok(lift[128] > 160 && lift[0] === 0 && lift[255] === 255);
  const px = run(solid(2, 2, 128, 128, 128), { curve: [[0, 0], [0.5, 0.7], [1, 1]] });
  assert.ok(at(px, 0, 0)[0] > 160);
});

test("curve never overshoots (stays between 0 and 255 and keeps order)", () => {
  const lut = curveLut([[0, 0.2], [0.3, 0.1], [0.6, 0.9], [1, 0.8]]);
  for (let i = 0; i < 256; i++) assert.ok(lut[i] >= 0 && lut[i] <= 255);
  const mono = curveLut([[0, 0], [0.25, 0.1], [0.75, 0.95], [1, 1]]);
  for (let i = 1; i < 256; i++) assert.ok(mono[i] >= mono[i - 1]);
});

test("geometry: a plain picture stays plain (no empty corners) at any setting", () => {
  for (const o of [{ straighten: 15 }, { straighten: -8 }, { vertical: 100 }, { horizontal: -100 }, { straighten: 5, vertical: 60, horizontal: 30 }]) {
    const px = run(solid(60, 40, 200, 200, 200), o);
    for (let i = 0; i < 60 * 40; i++) assert.ok(px.data[i * 4] >= 199 && px.data[i * 4 + 3] === 255, JSON.stringify(o));
  }
});

test("geometry: straighten turns a vertical edge, top and bottom move opposite ways", () => {
  const px = solid(80, 60, 0, 0, 0);
  for (let y = 0; y < 60; y++) for (let x = 40; x < 80; x++) px.data.set([255, 255, 255, 255], (y * 80 + x) * 4);
  run(px, { straighten: 8 });
  const edgeAt = (y: number) => { for (let x = 0; x < 80; x++) if (at(px, x, y)[0] > 127) return x; return 80; };
  assert.ok(edgeAt(5) !== edgeAt(55) && Math.abs(edgeAt(5) - edgeAt(55)) > 4);
});

test("geometry: vertical perspective makes the top wider than the bottom", () => {
  const px = solid(80, 60, 0, 0, 0);
  for (let y = 0; y < 60; y++) for (let x = 25; x < 55; x++) px.data.set([255, 255, 255, 255], (y * 80 + x) * 4);
  run(px, { vertical: 100 });
  const width = (y: number) => { let c = 0; for (let x = 0; x < 80; x++) if (at(px, x, y)[0] > 127) c++; return c; };
  assert.ok(width(3) > width(56) + 6);
});
