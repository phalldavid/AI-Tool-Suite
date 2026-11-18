import { test } from "node:test";
import assert from "node:assert/strict";
import { GRAPH_FORMAT, LIMITS, connect, graphFileName, makeNode, parseGraph, serializeGraph } from "../src/core/graph";
import type { Graph } from "../src/core/graph";

function file(over: Record<string, unknown> = {}): Record<string, unknown> {
  return { format: GRAPH_FORMAT, version: 1, name: "Bathroom batch", nodes: [], wires: [], ...over };
}

function errorOf(input: unknown): string {
  const r = parseGraph(input);
  assert.equal(r.ok, false);
  return (r as { error: string }).error;
}

test("malformed files are rejected with a plain message", () => {
  assert.match(errorOf("{not json"), /not valid JSON/);
  assert.match(errorOf("[]"), /not a graph/);
  assert.match(errorOf(null), /not a graph/);
  assert.match(errorOf({ ...file(), format: "comfyui" }), /not a David Render Studio graph/);
  assert.match(errorOf({ ...file(), version: 99 }), /newer version/);
  assert.match(errorOf({ ...file(), version: "1" }), /no valid version/);
  assert.match(errorOf({ ...file(), nodes: "x" }), /no node list/);
  assert.match(errorOf({ ...file(), wires: {} }), /broken wire list/);
  const dup = file({ nodes: [{ id: "a", kind: "note" }, { id: "a", kind: "note" }] });
  assert.match(errorOf(dup), /share the id/);
});

test("limits are enforced", () => {
  const many = Array.from({ length: LIMITS.nodes + 1 }, (_, i) => ({ id: `n${i}`, kind: "note" }));
  assert.match(errorOf(file({ nodes: many })), /limit is 200/);
  const imgs = Array.from({ length: LIMITS.images + 1 }, (_, i) => ({ id: `i${i}`, kind: "image", settings: { name: `${i}.png` } }));
  assert.match(errorOf(file({ nodes: imgs })), /limit is 30/);
  assert.match(errorOf("x".repeat(LIMITS.fileChars + 1)), /too large/);
  const long = parseGraph(file({ nodes: [{ id: "n", kind: "note", settings: { text: "a".repeat(LIMITS.text + 50) } }] }));
  assert.ok(long.ok);
  assert.equal((long.graph.nodes[0].settings as { text: string }).text.length, LIMITS.text);
  assert.ok(long.warnings.some((w) => /was cut/.test(w)));
});

test("unknown fields and kinds are dropped, nothing from the file runs", () => {
  const raw = JSON.stringify(
    file({
      apiKey: "sk-secret",
      script: "alert(1)",
      nodes: [
        { id: "img", kind: "image", x: 10, y: Infinity, settings: { name: "C:\\Users\\me\\Bathroom 1.png", data: "base64...", onload: "x" } },
        { id: "look", kind: "look", settings: { presetId: "not-a-real-look" } },
        { id: "light", kind: "light", settings: { lighting: "time:25:00", scene: "attic" } },
        { id: "sur", kind: "surroundings", settings: { contexts: ["pp-street", "made-up", "custom:lane, trees", 7] } },
        { id: "fit", kind: "fittings", settings: { fittings: { on: "yes", types: ["cove", "laser"], kelvin: 9999, level: 7 }, materialLock: "true" } },
        { id: "rnd", kind: "time-machine", settings: { model: "x" } },
        { id: "bad id!", kind: "note" },
      ],
      wires: [{ id: "w1", from: { node: "rnd", port: "result" }, to: { node: "img", port: "image" } }, "junk"],
    }),
  ).replace('"settings":{"name"', '"__proto__":{"polluted":true},"settings":{"name"');
  const r = parseGraph(raw);
  assert.ok(r.ok);
  const g = r.graph;
  assert.deepEqual(g.nodes.map((n) => n.id), ["img", "look", "light", "sur", "fit"]);
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
  const [img, look, light, sur, fit] = g.nodes;
  assert.deepEqual(img.settings, { name: "Bathroom 1.png" });
  assert.equal(img.y, 0);
  assert.deepEqual(look.settings, { presetId: null });
  assert.deepEqual(light.settings, { lighting: "morning", scene: "auto" });
  assert.deepEqual(sur.settings, { contexts: ["pp-street", "custom:lane trees"] });
  assert.deepEqual(fit.settings, { fittings: { on: true, types: ["cove"], other: "", kelvin: 3000, level: 1 }, materialLock: null, notes: "" });
  assert.equal(g.wires.length, 0);
  assert.ok(r.warnings.length > 0);
  const out = serializeGraph(g);
  assert.doesNotMatch(out, /sk-secret|alert|base64|apiKey|Users/);
});

test("bad wires in a file are dropped, good ones kept", () => {
  const r = parseGraph(
    file({
      nodes: [
        { id: "a", kind: "image", settings: { name: "a.png" } },
        { id: "l", kind: "light" },
        { id: "s", kind: "surroundings" },
        { id: "p", kind: "prompt", settings: { edits: { a: "my own text", ghost: "x" } } },
      ],
      wires: [
        { id: "w1", from: { node: "a", port: "image" }, to: { node: "p", port: "images" } },
        { id: "w2", from: { node: "a", port: "image" }, to: { node: "p", port: "look" } },
        { id: "w3", from: { node: "l", port: "look" }, to: { node: "s", port: "look" } },
        { id: "w4", from: { node: "s", port: "look" }, to: { node: "l", port: "look" } },
        { id: "w1", from: { node: "s", port: "look" }, to: { node: "p", port: "look" } },
      ],
    }),
  );
  assert.ok(r.ok);
  assert.deepEqual(r.graph.wires.map((w) => w.id), ["w1", "w3"]);
  assert.deepEqual((r.graph.nodes[3].settings as { edits: Record<string, string> }).edits, { a: "my own text" });
  assert.ok(r.warnings.some((w) => /loop/.test(w)));
  assert.ok(r.warnings.some((w) => /sends an image/.test(w)));
});

test("save and load round trip", () => {
  let g: Graph = {
    name: "One look, many views",
    nodes: [
      { ...makeNode("image", "img1", 40, 80), settings: { name: "Bathroom 01.png" } },
      { ...makeNode("image", "img2", 40, 240), settings: { name: "Bathroom 02.png" } },
      { ...makeNode("look", "look", 300, 0), settings: { presetId: "int-bathroom-minimal" } },
      { ...makeNode("light", "light", 520, 0), settings: { lighting: "time:16:30", scene: "interior" } },
      { ...makeNode("surroundings", "sur", 740, 0), settings: { contexts: ["view-garden", "custom:rice fields far off"] } },
      { ...makeNode("fittings", "fit", 960, 0), settings: { fittings: { on: true, types: ["cove"], other: "brass", kelvin: 2700, level: 2 }, materialLock: false, notes: "ផ្ទះ" } },
      { ...makeNode("prompt", "p", 1200, 120), settings: { edits: { img2: "custom words" } } },
      { ...makeNode("note", "note", 0, -200), settings: { text: "Client wants\nwarm light." } },
    ],
    wires: [],
    view: { x: -120, y: 30, zoom: 0.75 },
  };
  const pairs: [string, string, string, string][] = [
    ["look", "look", "light", "look"],
    ["light", "look", "sur", "look"],
    ["sur", "look", "fit", "look"],
    ["fit", "look", "p", "look"],
    ["img1", "image", "p", "images"],
    ["img2", "image", "p", "images"],
  ];
  pairs.forEach(([f, fp, t, tp], i) => {
    const r = connect(g, { node: f, port: fp }, { node: t, port: tp }, `w${i}`);
    assert.ok("graph" in r);
    g = r.graph;
  });
  const text = serializeGraph(g);
  const back = parseGraph(text);
  assert.ok(back.ok);
  assert.deepEqual(back.warnings, []);
  assert.deepEqual(back.graph, g);
  assert.equal(serializeGraph(back.graph), text);
  assert.equal(graphFileName(g), "One-look-many-views.graph.json");
});
