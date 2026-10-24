import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSheet, EXT_CUES, findCuts, INT_CUES, previewKey, previewMap, SHEETS, sheetPrompt, tilePrompt, type Pixels } from "../src/style-previews";
import { EXT_STYLES, INT_STYLES } from "../src/library";

/** A fake sheet: coloured tiles with white gutters and border, like the model should draw. */
function fakeSheet(cols: number, rows: number, w: number, h: number, gutter: number, opts: { skipX?: number[]; whiteSky?: boolean } = {}): Pixels {
  const data = new Uint8ClampedArray(w * h * 4).fill(255);
  const tw = (w - gutter * (cols + 1)) / cols;
  const th = (h - gutter * (rows + 1)) / rows;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x0 = Math.round(gutter + c * (tw + gutter));
      const y0 = Math.round(gutter + r * (th + gutter));
      // a missing gutter: this tile runs on into the next one
      const x1 = Math.round(x0 + tw + (opts.skipX?.includes(c + 1) ? gutter + 1 : 0));
      for (let y = y0; y < y0 + th; y++)
        for (let x = x0; x < x1; x++) {
          const k = (y * w + x) * 4;
          // pale sky in the top third must not be mistaken for a gutter
          const sky = opts.whiteSky && y < y0 + th / 3;
          data[k] = sky ? 226 : 60 + c * 30;
          data[k + 1] = sky ? 228 : 90 + r * 30;
          data[k + 2] = sky ? 234 : 120;
        }
    }
  return { width: w, height: h, data };
}

test("finds every gutter on a clean 4 x 3 sheet", () => {
  const px = fakeSheet(4, 3, 800, 450, 8);
  const c = checkSheet(px, 4, 3);
  assert.equal(c.ok, true, c.issues.join(" "));
  assert.equal(c.rects.length, 12);
  for (const [, , w, h] of c.rects) {
    assert.ok(Math.abs(w - (800 - 40) / 4) <= 2, `width ${w}`);
    assert.ok(Math.abs(h - (450 - 32) / 3) <= 2, `height ${h}`);
  }
});

test("white sky inside tiles is not a gutter", () => {
  const c = checkSheet(fakeSheet(4, 4, 600, 450, 6, { whiteSky: true }), 4, 4);
  assert.equal(c.ok, true, c.issues.join(" "));
  assert.equal(c.rects.length, 16);
});

test("a missing grid line is flagged and cut evenly", () => {
  const c = checkSheet(fakeSheet(4, 3, 800, 450, 8, { skipX: [2] }), 4, 3);
  assert.equal(c.ok, false);
  assert.match(c.issues[0], /not clear/);
  assert.equal(c.rects.length, 12);
});

test("a sheet with the wrong grid is flagged", () => {
  // model drew 3 columns where 4 were asked for
  const c = checkSheet(fakeSheet(3, 3, 800, 450, 8), 4, 3);
  assert.equal(c.ok, false);
});

test("findCuts on a profile without gutters splits evenly", () => {
  const { spans, found } = findCuts(new Array(100).fill(0), 4);
  assert.equal(found, 0);
  assert.deepEqual(spans, [[0, 25], [25, 50], [50, 75], [75, 100]]);
});

test("three sheets cover all 32 styles with 4:3 tiles", () => {
  assert.equal(SHEETS.reduce((n, s) => n + s.tiles.length, 0), 32);
  for (const s of SHEETS) {
    assert.equal(s.tiles.length, s.cols * s.rows, s.id);
    const [a, b] = s.ratio.split(":").map(Number);
    assert.ok(Math.abs(((a / b) * s.rows) / s.cols - 4 / 3) < 0.01, `${s.id} tiles are 4:3`);
    const p = sheetPrompt(s);
    assert.match(p, new RegExp(`${s.cols} x ${s.rows} grid of ${s.tiles.length} equal panels`));
    assert.match(p, new RegExp(`\\n${s.tiles.length}\\. `));
  }
});

test("cards map to preview keys; hidden tiles fall back to the shipped set", () => {
  assert.equal(previewKey("interior", "japandi"), "int:japandi");
  assert.equal(previewKey("exterior", "featured"), null);
  assert.equal(previewKey("aerial", "golden"), "air:golden");
  assert.equal(previewKey("sketch", "modern"), null);
  const tiles = SHEETS[2].tiles.map((_, i) => `data:image/jpeg;base64,${i}`);
  const m = previewMap({ air: { id: "air", createdAt: 0, sheet: { mimeType: "image/png", data: "" }, tiles, hidden: [1], issues: [] } });
  assert.equal(m.get("air:default"), tiles[0]);
  // a hidden tile falls back to the shipped picture, never the hidden one
  assert.notEqual(m.get("air:golden"), tiles[1]);
});

test("every style has a short sheet cue, and a redo follows the reference", () => {
  for (const s of EXT_STYLES) assert.ok(EXT_CUES[s.id], s.id);
  for (const s of INT_STYLES) assert.ok(INT_CUES[s.id], s.id);
  assert.match(INT_CUES["wabi-sabi"], /no green/);
  const p = tilePrompt(SHEETS[1], 12, true);
  assert.match(p, /Keep the exact room/);
  assert.match(p, /Wabi-sabi/);
  assert.match(tilePrompt(SHEETS[1], 0, false), /SAME living room/);
});
