import { test } from "node:test";
import assert from "node:assert/strict";
import { boxToRect, canAutoRun, entryFor, parseFixFile, patchPrompt, rollup, setStatus, sortFindings } from "../src/core/fixes";

const file = JSON.stringify({
  schema: "drs-fixes/1",
  inspector: "Claude",
  images: [
    {
      image: "Villa_StairLobby_01.png",
      verdict: "fail",
      findings: [
        { id: "a", category: "lighting", severity: "blocker", title: "Sun patches on stairs", what: "x", box: [0.6, 0.1, 0.3, 0.7], fix: { size: 3, method: "relight", prompt: "night", light: "night" } },
        { id: "b", category: "finish", severity: "minor", title: "Stamped floor", what: "y", box: [0.1, 0.8, 0.2, 0.1], fix: { size: 2, method: "spot-edit", prompt: "plain timber planks" } },
        { id: "c", category: "construction", severity: "major", title: "Door hits basin", what: "z", fix: { size: 5, method: "source", prompt: "move door" } },
        { title: "", what: "dropped, no title" },
      ],
    },
  ],
});

test("fix file: reads, clamps boxes, skips bad findings, rejects other JSON", () => {
  const f = parseFixFile(file);
  assert.equal(f.images[0].findings.length, 3);
  assert.deepEqual(f.images[0].findings[0].box, [0.6, 0.1, 0.3, 0.7]);
  assert.equal(f.images[0].findings[0].status, "open");
  assert.throws(() => parseFixFile("{"), /valid JSON/);
  assert.throws(() => parseFixFile('{"hello":1}'), /isn't a David Render Studio/);
  const wide = parseFixFile(file.replace("[0.6,0.1,0.3,0.7]", "[0.8,-0.2,0.9,2]"));
  assert.deepEqual(wide.images[0].findings[0].box, [0.8, 0, 0.19999999999999996, 1]);
});

test("matching a picture: by id, then by name without extension or case", () => {
  const f = parseFixFile(file);
  assert.equal(entryFor(f, "villa_stairlobby_01.PNG")?.image, "Villa_StairLobby_01.png");
  assert.equal(entryFor(f, "other.png"), undefined);
  const withId = { ...f, images: [{ ...f.images[0], imageId: "r-7" }] };
  assert.equal(entryFor(withId, "renamed.png", "r-7")?.image, "Villa_StairLobby_01.png");
});

test("what the app can run itself, and what a clean-up costs", () => {
  const list = parseFixFile(file).images[0].findings;
  assert.deepEqual(list.map(canAutoRun), [true, true, false]);
  const r = rollup(list);
  assert.deepEqual(r, { open: 3, blockers: 1, majors: 1, closed: 0, runs: 2 });
  const closed = setStatus(parseFixFile(file), "Villa_StairLobby_01.png", "a", "closed").images[0].findings;
  assert.equal(rollup(closed).runs, 1);
  assert.equal(canAutoRun(closed[0]), false);
});

test("order: open before done, worst first, quick fixes first", () => {
  const f = parseFixFile(file);
  const done = setStatus(f, "Villa_StairLobby_01.png", "a", "accepted").images[0].findings;
  assert.deepEqual(sortFindings(done).map((x) => x.id), ["c", "b", "a"]);
  assert.deepEqual(sortFindings(f.images[0].findings).map((x) => x.id), ["a", "c", "b"]);
});

test("prompt patch: replace a phrase, add lines, say what was missing", () => {
  const p = patchPrompt("Photoreal living room at golden hour, warm sun.", {
    replace: [{ from: "golden hour", to: "night" }, { from: "bright", to: "dark blue windows" }],
    add: ["No sun rays or window light patches."],
  });
  assert.match(p.prompt, /^Photoreal living room at night, warm sun\./);
  assert.match(p.prompt, /Corrections:\n- No sun rays or window light patches\.\n- dark blue windows\./);
  assert.equal(p.notes.length, 1);
  assert.equal(patchPrompt("same", undefined).prompt, "same");
});

test("box to pixels with a small margin, inside the picture", () => {
  assert.deepEqual(boxToRect([0.5, 0.5, 0.25, 0.25], 1000, 400, 0), { x: 500, y: 200, w: 250, h: 100 });
  const edge = boxToRect([0, 0, 1, 1], 1000, 400);
  assert.deepEqual(edge, { x: 0, y: 0, w: 1000, h: 400 });
});
