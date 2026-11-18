import { test } from "node:test";
import assert from "node:assert/strict";
import { canConnect, connect, makeNode, topoSort, wouldLoop } from "../src/core/graph";
import type { Graph } from "../src/core/graph";

function base(): Graph {
  return {
    name: "t",
    nodes: [makeNode("image", "a"), makeNode("image", "b"), makeNode("look", "look"), makeNode("light", "l1"), makeNode("surroundings", "s1"), makeNode("prompt", "p"), makeNode("note", "note")],
    wires: [],
    view: { x: 0, y: 0, zoom: 1 },
  };
}

function ok(g: Graph, f: string, fp: string, t: string, tp: string, id: string): Graph {
  const r = connect(g, { node: f, port: fp }, { node: t, port: tp }, id);
  assert.ok("graph" in r, "reason" in r ? r.reason : "");
  return r.graph;
}

test("wrong wire types are refused with a reason", () => {
  const r = canConnect(base(), { node: "a", port: "image" }, { node: "p", port: "look" });
  assert.equal(r.ok, false);
  assert.match((r as { reason: string }).reason, /sends an image.*takes look settings/);
});

test("unknown ports and self wires are refused", () => {
  const g = base();
  assert.equal(canConnect(g, { node: "a", port: "nope" }, { node: "p", port: "images" }).ok, false);
  assert.equal(canConnect(g, { node: "l1", port: "look" }, { node: "l1", port: "look" }).ok, false);
  assert.equal(canConnect(g, { node: "gone", port: "image" }, { node: "p", port: "images" }).ok, false);
  // a Note has no ports at all
  assert.equal(canConnect(g, { node: "note", port: "look" }, { node: "p", port: "look" }).ok, false);
});

test("a single input takes one wire, the images input takes many, outputs fan out", () => {
  let g = base();
  g = ok(g, "a", "image", "p", "images", "w1");
  g = ok(g, "b", "image", "p", "images", "w2");
  g = ok(g, "look", "look", "p", "look", "w3");
  const second = canConnect(g, { node: "l1", port: "look" }, { node: "p", port: "look" });
  assert.equal(second.ok, false);
  assert.match((second as { reason: string }).reason, /already has a wire/);
  assert.equal(canConnect(g, { node: "a", port: "image" }, { node: "p", port: "images" }).ok, false, "same wire twice");
  // one look fans out to two nodes
  g = ok(g, "look", "look", "l1", "look", "w4");
  assert.equal(g.wires.length, 4);
});

test("loops are refused", () => {
  let g = base();
  g = ok(g, "l1", "look", "s1", "look", "w1");
  assert.equal(wouldLoop(g, "s1", "l1"), true);
  const r = canConnect(g, { node: "s1", port: "look" }, { node: "l1", port: "look" });
  assert.equal(r.ok, false);
  assert.match((r as { reason: string }).reason, /loop/);
});

test("topological order puts feeders first and finds loops", () => {
  let g = base();
  g = ok(g, "look", "look", "l1", "look", "w1");
  g = ok(g, "l1", "look", "s1", "look", "w2");
  g = ok(g, "s1", "look", "p", "look", "w3");
  g = ok(g, "a", "image", "p", "images", "w4");
  const order = topoSort(g)!;
  const at = (id: string) => order.indexOf(id);
  assert.ok(at("look") < at("l1") && at("l1") < at("s1") && at("s1") < at("p") && at("a") < at("p"));
  assert.equal(order.length, g.nodes.length);
  // a loop forced in by hand (the checks above never allow one)
  const bad = { ...g, wires: [...g.wires, { id: "x", from: { node: "s1", port: "look" }, to: { node: "l1", port: "look" } }] };
  assert.equal(topoSort(bad), null);
});

test("connect never changes the graph it was given", () => {
  const g = base();
  connect(g, { node: "a", port: "image" }, { node: "p", port: "images" }, "w1");
  assert.equal(g.wires.length, 0);
});
