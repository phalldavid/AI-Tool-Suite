import { test } from "node:test";
import assert from "node:assert/strict";
import { KM, translate } from "../src/lib/i18n";
import { S } from "../src/screens/advanced/strings";
import { NODE_DEFS, makeNode, starterGraph } from "../src/core/graph";
import { LIGHTING } from "../src/core/prompt";
import { fitView, nodeWidth, portPoint, screenToWorld, wirePath, zoomAt } from "../src/screens/advanced/geometry";
import { loadLastGraph, saveLastGraph } from "../src/lib/advanced";

test("every Advanced tab string has a Khmer entry", () => {
  const km = KM as Record<string, string>;
  const missing = Object.values(S).filter((s) => !km[s]);
  assert.deepEqual(missing, []);
  for (const d of Object.values(NODE_DEFS)) for (const p of [...d.inputs, ...d.outputs]) assert.ok(km[p.label], p.label);
  for (const o of LIGHTING) assert.ok(km[o.label], o.label);
});

test("Advanced tab text with numbers is translated", () => {
  assert.equal(translate("12 prompts ready"), "Prompt 12 រួចរាល់");
  assert.equal(translate("3 of 30 images"), "រូបភាព 3 នៃ 30");
  assert.ok(translate("A graph can have at most 30 images."));
  assert.ok(translate('"Look settings in" already has a wire. Remove it first.'));
  assert.ok(translate("Image sends an image, but this Prompt input takes look settings."));
});

test("ports sit at fixed places on the node", () => {
  const n = { ...makeNode("prompt", "p"), x: 100, y: 50 };
  const a = portPoint(n, "images", "in");
  const b = portPoint(n, "look", "in");
  const c = portPoint(n, "prompts", "out");
  assert.equal(a.x, 100);
  assert.equal(c.x, 100 + nodeWidth("prompt"));
  assert.ok(b.y > a.y);
  assert.match(wirePath({ x: 0, y: 0 }, { x: 200, y: 40 }), /^M 0 0 C /);
});

test("zoom keeps the point under the cursor still, and fit shows every node", () => {
  const v = { x: 30, y: -20, zoom: 1 };
  const before = screenToWorld(v, 400, 300);
  const after = screenToWorld(zoomAt(v, 400, 300, 1.7), 400, 300);
  assert.ok(Math.abs(before.x - after.x) < 1e-9 && Math.abs(before.y - after.y) < 1e-9);
  assert.equal(zoomAt(v, 0, 0, 100).zoom, 2.5);
  const g = starterGraph();
  const f = fitView(g.nodes, 1200, 700);
  for (const n of g.nodes) {
    const left = n.x * f.zoom + f.x;
    const right = (n.x + nodeWidth(n.kind)) * f.zoom + f.x;
    assert.ok(left >= 0 && right <= 1200, `${n.id} inside`);
  }
});

test("the tab works when browser storage is missing", () => {
  // Node has no localStorage: both calls must fail quietly.
  assert.equal(loadLastGraph(), null);
  assert.equal(saveLastGraph(starterGraph()), false);
});
