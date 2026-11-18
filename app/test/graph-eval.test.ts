import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SETTINGS } from "../src/core/settings";
import { GRAPH_DEFAULT_LOOK, allPrompts, connect, defaultsFromSettings, evaluateGraph, makeNode } from "../src/core/graph";
import type { EvalCache, Graph, GraphNode } from "../src/core/graph";

const D = defaultsFromSettings(DEFAULT_SETTINGS);

function batch(names: string[], withLook = true): Graph {
  let g: Graph = { name: "batch", nodes: [], wires: [], view: { x: 0, y: 0, zoom: 1 } };
  const nodes: GraphNode[] = [{ ...makeNode("light", "light"), settings: { lighting: "interior-day", scene: "auto" } }, makeNode("prompt", "p")];
  if (withLook) nodes.unshift({ ...makeNode("look", "look"), settings: { presetId: "int-bathroom-minimal" } });
  names.forEach((name, i) => nodes.push({ ...makeNode("image", `img${i}`), settings: { name } }));
  g.nodes = nodes;
  const link = (f: string, fp: string, t: string, tp: string) => {
    const r = connect(g, { node: f, port: fp }, { node: t, port: tp }, `w${g.wires.length}`);
    if ("reason" in r) throw new Error(r.reason);
    g = r.graph;
  };
  if (withLook) link("look", "look", "light", "look");
  link("light", "look", "p", "look");
  names.forEach((_, i) => link(`img${i}`, "image", "p", "images"));
  return g;
}

test("one Look and one Light wired to many images gives one prompt per image", () => {
  const names = Array.from({ length: 10 }, (_, i) => `Bath view ${i + 1}.png`);
  const g = batch(names);
  const r = evaluateGraph(g, D);
  assert.ok(r.ok);
  const items = allPrompts(g, r.outputs);
  assert.equal(items.length, 10);
  assert.deepEqual(items.map((p) => p.name), names);
  assert.ok(items.every((p) => p.lookId === "int-bathroom-minimal" && !p.guessed));
  assert.equal(new Set(items.map((p) => p.text)).size, 1, "same look and light, same prompt text");
  assert.match(items[0].text, /natural daylight entering through the windows/);
});

test("with no Look wired each image gets its room guess, else the default look", () => {
  const g = batch(["Kitchen A.jpg", "master bedroom.png", "scene 12.png"], false);
  const r = evaluateGraph(g, D);
  assert.ok(r.ok);
  const items = allPrompts(g, r.outputs);
  assert.deepEqual(items.map((p) => p.lookId), ["int-kitchen-japandi", "int-bedroom-tropical", GRAPH_DEFAULT_LOOK]);
  assert.ok(items.every((p) => p.guessed));
});

test("only changed nodes are worked out again", () => {
  const g = batch(["a.png", "b.png"]);
  const first = evaluateGraph(g, D);
  assert.ok(first.ok);
  assert.equal(first.recomputed.length, g.nodes.length);

  const same = evaluateGraph(g, D, first.outputs);
  assert.ok(same.ok);
  assert.deepEqual(same.recomputed, []);

  // change the light: light and prompt only
  const lit = { ...g, nodes: g.nodes.map((n) => (n.id === "light" ? { ...n, settings: { lighting: "interior-evening", scene: "auto" } } : n)) } as Graph;
  const second = evaluateGraph(lit, D, first.outputs);
  assert.ok(second.ok);
  assert.deepEqual(second.recomputed.sort(), ["light", "p"]);
  assert.notEqual(allPrompts(lit, second.outputs)[0].text, allPrompts(g, first.outputs)[0].text);

  // moving a node on the canvas changes nothing
  const moved = { ...g, nodes: g.nodes.map((n) => ({ ...n, x: n.x + 50 })) };
  const third = evaluateGraph(moved, D, first.outputs as EvalCache);
  assert.ok(third.ok);
  assert.deepEqual(third.recomputed, []);

  // a different Render tab setting reaches the prompt node only
  const cgi = evaluateGraph(g, { ...D, look: "cgi" }, first.outputs);
  assert.ok(cgi.ok);
  assert.deepEqual(cgi.recomputed, ["p"]);
});

test("the user's own wording replaces the built text for that image only", () => {
  const g = batch(["a.png", "b.png"]);
  const p = g.nodes.find((n) => n.id === "p")!;
  p.settings = { edits: { img1: "My own prompt." } };
  const r = evaluateGraph(g, D);
  assert.ok(r.ok);
  const [a, b] = allPrompts(g, r.outputs);
  assert.equal(a.edited, false);
  assert.equal(b.edited, true);
  assert.equal(b.text, "My own prompt.");
  assert.equal(b.built, a.built);
});

test("a graph with a loop does not run", () => {
  const g = batch(["a.png"]);
  g.wires.push({ id: "x", from: { node: "light", port: "look" }, to: { node: "look", port: "look" } });
  const r = evaluateGraph(g, D);
  assert.equal(r.ok, false);
});

test("evaluating never needs a browser or a backend", () => {
  // Nothing in the engine touches window, localStorage or fetch.
  const g = batch(["a.png"]);
  const saved = { fetch: globalThis.fetch };
  (globalThis as { fetch?: unknown }).fetch = () => {
    throw new Error("network call");
  };
  try {
    assert.ok(evaluateGraph(g, D).ok);
  } finally {
    globalThis.fetch = saved.fetch;
  }
});
