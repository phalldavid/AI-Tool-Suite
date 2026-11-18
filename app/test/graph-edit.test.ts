import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LIMITS, addImages, addNode, allPrompts, batchEntries, cannotAdd, crc32, defaultsFromSettings, emptyGraph, evaluateGraph,
  moveNodes, nextId, parseGraph, promptFiles, record, redo, removeNodes, removeWires, searchAddMenu, serializeGraph,
  startUndo, starterGraph, undo, updateSettings, wire, wiresInto, zipFiles,
} from "../src/core/graph";
import type { Graph } from "../src/core/graph";
import { DEFAULT_SETTINGS } from "../src/core/settings";

function must(r: { graph: Graph } | { reason: string }): Graph {
  if ("reason" in r) throw new Error(r.reason);
  return r.graph;
}

test("the starter graph is valid, wired, and survives save and load", () => {
  const g = starterGraph();
  assert.deepEqual(g.nodes.map((n) => n.kind).sort(), ["light", "look", "note", "prompt", "render", "result"]);
  assert.equal(g.wires.length, 4);
  const back = parseGraph(serializeGraph(g));
  assert.ok(back.ok);
  assert.deepEqual(back.graph, g);
});

test("adding images wires them to the only Prompt node and stops at the limit", () => {
  const names = Array.from({ length: LIMITS.images + 3 }, (_, i) => `view ${i}.png`);
  const r = addImages(starterGraph(), names, 0, 0);
  assert.equal(r.added.length, LIMITS.images);
  assert.equal(r.skipped, 3);
  assert.equal(r.wired, true);
  assert.match(cannotAdd(r.graph, "image")!, /at most 30 images/);
  const ev = evaluateGraph(r.graph, defaultsFromSettings(DEFAULT_SETTINGS));
  assert.ok(ev.ok);
  assert.equal(allPrompts(r.graph, ev.outputs).length, LIMITS.images);
});

test("removing a node removes its wires and its prompt edits", () => {
  let g = starterGraph();
  const r = addImages(g, ["a.png", "b.png"], 0, 0);
  g = r.graph;
  const p = g.nodes.find((n) => n.kind === "prompt")!;
  g = updateSettings(g, p.id, { edits: { [r.added[0]]: "mine", [r.added[1]]: "also mine" } });
  g = removeNodes(g, [r.added[0]]);
  assert.equal(g.wires.some((w) => w.from.node === r.added[0]), false);
  assert.deepEqual((g.nodes.find((n) => n.id === p.id)!.settings as { edits: object }).edits, { [r.added[1]]: "also mine" });
});

test("ids stay unique and wires can be removed by input", () => {
  let g = emptyGraph();
  g = must(addNode(g, "look", 0, 0));
  g = must(addNode(g, "look", 0, 0));
  g = must(addNode(g, "prompt", 0, 0));
  assert.deepEqual(g.nodes.map((n) => n.id), ["look1", "look2", "prompt1"]);
  g = must(wire(g, { node: "look1", port: "look" }, { node: "prompt1", port: "look" }));
  assert.equal(nextId(g, "w"), "w2");
  const into = wiresInto(g, { node: "prompt1", port: "look" });
  assert.equal(into.length, 1);
  g = removeWires(g, into);
  assert.equal(g.wires.length, 0);
});

test("undo and redo, with typing joined into one step", () => {
  const a = emptyGraph();
  let u = startUndo(a);
  const b = must(addNode(a, "note", 0, 0));
  u = record(u, b);
  const c = updateSettings(b, "note1", { text: "h" });
  const d = updateSettings(c, "note1", { text: "hi" });
  u = record(u, c, "text:note1");
  u = record(u, d, "text:note1");
  assert.equal(u.past.length, 2, "two letters, one step");
  const e = moveNodes(d, ["note1"], 40, 0);
  u = record(u, e);
  u = undo(u);
  assert.equal(u.present, d === u.present ? d : u.present);
  assert.equal((u.present.nodes[0].settings as { text: string }).text, "hi");
  assert.equal(u.present.nodes[0].x, 0);
  u = undo(u);
  assert.equal((u.present.nodes[0].settings as { text: string }).text, "");
  u = undo(u);
  assert.equal(u.present.nodes.length, 0);
  assert.equal(undo(u), u, "nothing more to undo");
  u = redo(redo(redo(u)));
  assert.equal(u.present.nodes[0].x, 40);
  assert.equal(redo(u), u);
});

test("undo keeps the current pan and zoom", () => {
  let u = startUndo(emptyGraph());
  u = record(u, must(addNode(u.present, "note", 0, 0)));
  u = { ...u, present: { ...u.present, view: { x: 100, y: 50, zoom: 2 } } };
  u = undo(u);
  assert.deepEqual(u.present.view, { x: 100, y: 50, zoom: 2 });
});

test("add-node search finds kinds by plain words", () => {
  assert.deepEqual(searchAddMenu("sun"), ["light"]);
  assert.deepEqual(searchAddMenu("screenshot"), ["image"]);
  assert.equal(searchAddMenu("").length, 9);
  assert.deepEqual(searchAddMenu("zzz"), []);
});

test("save all prompts: one txt per image, unique names, prompts.json like the CLI batch", () => {
  let g = starterGraph();
  g = addImages(g, ["Bath 1.png", "Bath 1.jpg", "../evil/x?.png", "ផ្ទះ.png"], 0, 0).graph;
  const ev = evaluateGraph(g, defaultsFromSettings(DEFAULT_SETTINGS));
  assert.ok(ev.ok);
  const items = allPrompts(g, ev.outputs);
  const files = promptFiles(items);
  assert.deepEqual(files.map((f) => f.name), ["Bath 1.txt", "Bath 1-2.txt", "evilx.txt", "ផ្ទះ.txt", "prompts.json"]);
  const json = JSON.parse(files[files.length - 1].text);
  assert.deepEqual(json, batchEntries(items));
  assert.equal(json[0].image, "Bath 1.png");
  assert.equal(json[0].result.ok, true);
  assert.equal(json[0].result.prompt, items[0].text);
  assert.ok(json[0].result.words > 20);
});

test("zip writer: known CRC and a well-formed archive", () => {
  assert.equal(crc32(new TextEncoder().encode("hello")), 0x3610a686);
  const zip = zipFiles([{ name: "a.txt", text: "hello\n" }, { name: "ផ្ទះ.txt", text: "x" }], new Date(2026, 10, 18, 9, 30));
  const v = new DataView(zip.buffer);
  assert.equal(v.getUint32(0, true), 0x04034b50);
  const end = zip.length - 22;
  assert.equal(v.getUint32(end, true), 0x06054b50);
  assert.equal(v.getUint16(end + 10, true), 2);
  const cdOffset = v.getUint32(end + 16, true);
  assert.equal(v.getUint32(cdOffset, true), 0x02014b50);
});
