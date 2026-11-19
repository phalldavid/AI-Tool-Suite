import { test } from "node:test";
import assert from "node:assert/strict";
import { addImages, addNode, allJobs, clampCap, defaultsFromSettings, evaluateGraph, parseGraph, planRun, resultKey, runBlocker, runCost, serializeGraph, starterGraph, wire } from "../src/core/graph";
import type { Graph, RunCheck } from "../src/core/graph";
import { DEFAULT_SETTINGS } from "../src/core/settings";
import { renderCost } from "../src/lib/cost";

const D = defaultsFromSettings(DEFAULT_SETTINGS);

function must(r: { graph: Graph } | { reason: string }): Graph {
  if ("reason" in r) throw new Error(r.reason);
  return r.graph;
}

/** Starter graph (it has Prompt -> Render -> Result) with 3 images. */
function withRender(): Graph {
  return addImages(starterGraph(), ["a.png", "b.png", "c.png"], 0, 0).graph;
}

test("a Render node makes one job per prompt; Result shows them; files round trip", () => {
  const g = withRender();
  const ev = evaluateGraph(g, D);
  assert.ok(ev.ok);
  const jobs = allJobs(g, ev.outputs);
  assert.equal(jobs.length, 3);
  assert.ok(jobs.every((j) => j.renderNodeId === "render1" && j.prompt.length > 100 && j.promptHash.length === 16));
  assert.equal((ev.outputs.get("result1")!.ports.shown as unknown[]).length, 3);
  const back = parseGraph(serializeGraph(g));
  assert.ok(back.ok);
  assert.deepEqual(back.graph, g);
  // wrong wires are refused: an image cannot go into a Render node
  const bad = wire(g, { node: "image1", port: "image" }, { node: "render1", port: "prompts" });
  assert.ok("reason" in bad);
});

test("planning skips finished renders with the same prompt, and images with no picture", () => {
  const g = withRender();
  const ev = evaluateGraph(g, D);
  assert.ok(ev.ok);
  const jobs = allJobs(g, ev.outputs);
  const done = { [resultKey(jobs[0])]: { promptHash: jobs[0].promptHash }, [resultKey(jobs[1])]: { promptHash: "old" } };
  const plan = planRun(jobs, (id) => id !== jobs[2].imageNodeId, done);
  assert.deepEqual(plan.done.map((j) => j.imageNodeId), [jobs[0].imageNodeId], "same prompt: not paid twice");
  assert.deepEqual(plan.jobs.map((j) => j.imageNodeId), [jobs[1].imageNodeId], "prompt changed: render again");
  assert.deepEqual(plan.noPicture.map((j) => j.imageNodeId), [jobs[2].imageNodeId]);
  const again = planRun(jobs, () => true, done, true);
  assert.equal(again.jobs.length, 3, "Render again includes finished ones");
});

test("cost: totals from renderCost, test mode free, unknown price flagged", () => {
  const kie = { ...DEFAULT_SETTINGS, backend: "kie" as const, imageCount: 1 };
  const one = renderCost(kie);
  const c = runCost([one, one, one, one], false);
  if (one.credits !== null) assert.equal(c.credits, Math.round(one.credits * 4 * 100) / 100);
  assert.equal(runCost([one, one, one, one], true).paid, false);
  assert.equal(runCost([renderCost({ ...DEFAULT_SETTINGS, testMode: true })], true).label, "Test, nothing is spent");
  const gem = runCost([renderCost({ ...DEFAULT_SETTINGS, backend: "gemini" })], false);
  assert.equal(gem.unknown, true);
  assert.equal(gem.label, "Cost unknown");
  assert.equal(runCost([renderCost({ ...DEFAULT_SETTINGS, backend: "comfyui" })], false).paid, false);
});

function check(over: Partial<RunCheck>): RunCheck {
  const job = { kind: "render" as const, scene: "exterior" as const, renderNodeId: "r", promptNodeId: "p", imageNodeId: "i", name: "a", lookName: "L", prompt: "p", promptHash: "h" };
  return {
    backend: "kie",
    testMode: false,
    renderNodes: 1,
    plan: { jobs: [job, { ...job, imageNodeId: "j" }], done: [], noPicture: [], noSource: [] },
    cost: { credits: 12, unknown: false, paid: true, label: "about 12 credits" },
    cap: 10,
    balance: 100,
    ...over,
  };
}

test("run is blocked with a plain reason: Prompt Copy, no Render node, cap, balance", () => {
  assert.equal(runBlocker(check({})), null);
  assert.match(runBlocker(check({ backend: "browser" }))!, /Prompt Copy can't render/);
  assert.equal(runBlocker(check({ backend: "browser", testMode: true })), null, "Test mode always works");
  assert.match(runBlocker(check({ renderNodes: 0 }))!, /Add a Render node/);
  assert.match(runBlocker(check({ cap: 1 }))!, /2 renders; the limit is 1/);
  assert.match(runBlocker(check({ balance: 5 }))!, /Not enough credits/);
  assert.equal(runBlocker(check({ balance: 5, testMode: true })), null);
  assert.equal(runBlocker(check({ balance: null })), null, "unknown balance: the confirm step says so");
  const empty = { jobs: [], done: [], noPicture: [], noSource: [] };
  assert.match(runBlocker(check({ plan: { ...empty, done: [check({}).plan.jobs[0]] } }))!, /already rendered/);
  assert.match(runBlocker(check({ plan: { ...empty, noPicture: [check({}).plan.jobs[0]] } }))!, /no picture/);
  assert.match(runBlocker(check({ plan: empty }))!, /Nothing to render yet/);
});

test("the run cap stays between 1 and 100", () => {
  assert.equal(clampCap(0), 1);
  assert.equal(clampCap(500), 100);
  assert.equal(clampCap("abc"), 10);
  assert.equal(clampCap("25"), 25);
});

test("one Render node takes several Prompt nodes: Compare 4 looks renders 4 x images", async () => {
  const { TEMPLATES, applyTemplate } = await import("../src/core/graph");
  const g = applyTemplate(addImages(starterGraph(), ["a.png", "b.png"], 0, 0).graph, TEMPLATES.find((t) => t.id === "compare-4")!.build());
  assert.equal(g.nodes.filter((n) => n.kind === "render").length, 1, "the template brings one Render node for all four prompts");
  const ev = evaluateGraph(g, D);
  assert.ok(ev.ok);
  const jobs = allJobs(g, ev.outputs);
  assert.equal(jobs.length, 8);
  assert.equal(new Set(jobs.map((j) => resultKey(j))).size, 8, "each look and image has its own result");
  assert.equal(planRun(jobs, () => true, {}).jobs.length, 8);
});
