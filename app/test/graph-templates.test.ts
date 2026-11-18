import { test } from "node:test";
import assert from "node:assert/strict";
import { TEMPLATES, addImages, allPrompts, applyTemplate, defaultsFromSettings, duplicateNodes, emptyGraph, evaluateGraph, parseGraph, serializeGraph, starterGraph, updateSettings, wiresOf } from "../src/core/graph";
import type { Graph, SettingsByKind } from "../src/core/graph";
import { findLibraryItem } from "../src/core/library";
import { DEFAULT_SETTINGS } from "../src/core/settings";

const D = defaultsFromSettings(DEFAULT_SETTINGS);

test("every template is valid, saves and loads, and only names real looks", () => {
  for (const t of TEMPLATES) {
    const g = t.build();
    const back = parseGraph(serializeGraph(g));
    assert.ok(back.ok, t.id);
    assert.deepEqual(back.warnings, [], t.id);
    assert.deepEqual(back.graph, g, t.id);
    for (const n of g.nodes) {
      if (n.kind === "look") {
        const id = (n.settings as SettingsByKind["look"]).presetId;
        if (id) assert.ok(findLibraryItem(id), `${t.id}: ${id}`);
      }
    }
    assert.ok(evaluateGraph(g, D).ok, t.id);
  }
});

test("a template keeps the images on the canvas and wires them to every prompt", () => {
  let g = starterGraph();
  const r = addImages(g, ["a.png", "b.png", "c.png"], 0, 0);
  g = r.graph;
  const next = applyTemplate(g, TEMPLATES.find((t) => t.id === "compare-4")!.build());
  const ids = next.nodes.map((n) => n.id);
  assert.equal(new Set(ids).size, ids.length, "unique ids");
  for (const id of r.added) assert.ok(ids.includes(id), "image kept with its id");
  const ev = evaluateGraph(next, D);
  assert.ok(ev.ok);
  const items = allPrompts(next, ev.outputs);
  assert.equal(items.length, 12, "3 images x 4 looks");
  assert.equal(new Set(items.map((p) => p.lookId)).size, 4);
  // no images: the template as it is
  const plain = TEMPLATES[1].build();
  assert.equal(applyTemplate(emptyGraph(), plain), plain);
});

test("Ctrl D copies nodes and the wires between them, not outside inputs", () => {
  let g = starterGraph();
  g = addImages(g, ["a.png"], 0, 0).graph;
  const look = g.nodes.find((n) => n.kind === "look")!;
  const light = g.nodes.find((n) => n.kind === "light")!;
  const prompt = g.nodes.find((n) => n.kind === "prompt")!;
  g = updateSettings(g, look.id, { presetId: "int-bathroom-minimal" });
  const r = duplicateNodes(g, [light.id, prompt.id]);
  assert.ok("graph" in r);
  const [l2, p2] = r.ids;
  const wires = r.graph.wires;
  assert.ok(wires.some((w) => w.from.node === l2 && w.to.node === p2), "inner wire copied");
  assert.ok(!wires.some((w) => w.to.node === l2), "no outside input without keepInputs");
  assert.ok(!wires.some((w) => w.to.node === p2 && w.to.port === "images"));
  const moved = r.graph.nodes.find((n) => n.id === l2)!;
  assert.equal(moved.x, light.x + 40);
  // the copy is independent
  const changed = updateSettings(r.graph, l2, { lighting: "night" });
  assert.equal((changed.nodes.find((n) => n.id === light.id)!.settings as SettingsByKind["light"]).lighting, "morning");
});

test("Ctrl Shift D keeps the inputs too", () => {
  let g: Graph = starterGraph();
  g = addImages(g, ["a.png", "b.png"], 0, 0).graph;
  const prompt = g.nodes.find((n) => n.kind === "prompt")!;
  const r = duplicateNodes(g, [prompt.id], 40, 40, true);
  assert.ok("graph" in r);
  const into = r.graph.wires.filter((w) => w.to.node === r.ids[0]);
  assert.equal(into.length, 3, "two images and the look");
  const ev = evaluateGraph(r.graph, D);
  assert.ok(ev.ok);
  assert.equal(allPrompts(r.graph, ev.outputs).length, 4);
  assert.equal(wiresOf(r.graph, [r.ids[0]]).length, 3);
});

test("duplicating stops at the image limit", () => {
  let g = emptyGraph();
  g = addImages(g, Array.from({ length: 30 }, (_, i) => `${i}.png`), 0, 0).graph;
  const r = duplicateNodes(g, [g.nodes[0].id]);
  assert.ok("reason" in r);
});

test("Ctrl C then Ctrl V pastes copies at the mouse, inner wires kept", async () => {
  const { pasteNodes } = await import("../src/core/graph");
  let g = starterGraph();
  g = addImages(g, ["a.png"], 0, 0).graph;
  const prompt = g.nodes.find((n) => n.kind === "prompt")!;
  const light = g.nodes.find((n) => n.kind === "light")!;
  const img = g.nodes.find((n) => n.kind === "image")!;
  g = updateSettings(g, prompt.id, { edits: { [img.id]: "mine" } });
  const slice = { nodes: [light, g.nodes.find((n) => n.id === prompt.id)!], wires: g.wires.filter((w) => w.from.node === light.id && w.to.node === prompt.id) };
  const r = pasteNodes(g, slice, 2000, 900);
  assert.ok("graph" in r);
  const copies = r.graph.nodes.filter((n) => r.ids.includes(n.id));
  assert.equal(Math.min(...copies.map((n) => n.x)), 2000);
  assert.equal(Math.min(...copies.map((n) => n.y)), 900);
  assert.equal(r.graph.wires.filter((w) => r.ids.includes(w.from.node) && r.ids.includes(w.to.node)).length, 1);
  const p2 = copies.find((n) => n.kind === "prompt")!;
  assert.deepEqual((p2.settings as SettingsByKind["prompt"]).edits, {}, "edits for images not copied are dropped");
});
