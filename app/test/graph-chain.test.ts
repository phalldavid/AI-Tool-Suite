import { test } from "node:test";
import assert from "node:assert/strict";
import { addImages, addNode, allJobs, defaultsFromSettings, evaluateGraph, parseGraph, planRun, resultKey, runBlocker, serializeGraph, starterGraph, updateSettings, wire } from "../src/core/graph";
import type { Graph, SettingsByKind } from "../src/core/graph";
import { DEFAULT_SETTINGS } from "../src/core/settings";
import { relightPrompt, newViewPrompt, wordsEditPrompt, VIEW_SUN } from "../src/core/edit-prompts";
import { lightingText, relightText, buildZoneEditPrompt } from "../src/core/prompt";
import { lightingGuidance } from "../src/lib/lighting";
import { cameraViewPrompt } from "../src/lib/views";
import { cameraPromptLine } from "../src/lib/camera";

const D = defaultsFromSettings(DEFAULT_SETTINGS);
const must = (r: { graph: Graph } | { reason: string }): Graph => {
  if ("reason" in r) throw new Error(r.reason);
  return r.graph;
};

test("Edit tab prompts moved without changing a word", () => {
  for (const id of ["blue-hour", "int-night-moody", "urb-rain-night", "time:16:30"]) {
    for (const scene of ["interior", "exterior"] as const) {
      const light = relightText(id) ?? lightingText(id) ?? id;
      const old = `Change only the lighting and sky of this image to: ${light}. ${lightingGuidance(scene)} Shadows and reflections must match the new light. Keep every building, material, object and the camera exactly as they are. The result must look like a real photograph.`;
      assert.equal(relightPrompt(id, scene), old);
    }
  }
  const cam = { orbit: -40, tilt: 20, lensMm: 24, distanceM: 50 };
  assert.equal(newViewPrompt(cam, false), cameraViewPrompt(cameraPromptLine(cam), VIEW_SUN, [], false));
  assert.equal(wordsEditPrompt("add rain on the glass"), buildZoneEditPrompt([], { general: "add rain on the glass" }));
});

/** Starter (Prompt -> Render -> Result) with 2 images, then Render -> Relight -> New view. */
function chain(): Graph {
  let g = addImages(starterGraph(), ["Bathroom 1.png", "villa.png"], 0, 0).graph;
  g = must(addNode(g, "relight", 1800, 40));
  g = must(addNode(g, "view", 2100, 40));
  g = must(wire(g, { node: "render1", port: "results" }, { node: "relight1", port: "results" }));
  g = must(wire(g, { node: "relight1", port: "results" }, { node: "view1", port: "results" }));
  return g;
}

test("a chain makes one step per render, in wire order, each working on the one before", () => {
  const g = chain();
  const ev = evaluateGraph(g, D);
  assert.ok(ev.ok);
  const jobs = allJobs(g, ev.outputs);
  assert.deepEqual(jobs.map((j) => j.kind), ["render", "render", "relight", "relight", "view", "view"]);
  const [r1, , l1, , v1] = jobs;
  assert.equal(l1.sourceKey, resultKey(r1));
  assert.equal(v1.sourceKey, resultKey(l1));
  assert.match(l1.prompt, /^Change only the lighting and sky/);
  assert.equal(l1.scene, "interior", "the bathroom render is interior, so the relight is too");
  assert.match(l1.lookName, /Relight, Blue hour/);
  assert.match(v1.prompt, /^SAME BUILDING, NEW CAMERA/);
  // all six can run in one go: each step comes after its source
  const plan = planRun(jobs, () => true, {});
  assert.equal(plan.jobs.length, 6);
});

test("steps wait for their source; a source made again makes the step run again", () => {
  const g = chain();
  const ev = evaluateGraph(g, D);
  assert.ok(ev.ok);
  const jobs = allJobs(g, ev.outputs);
  const [r1, r2, l1, l2] = jobs;
  // r2 has no picture: its relight and view can't run
  const plan = planRun(jobs, (id) => id !== r2.imageNodeId, {});
  assert.deepEqual(plan.noPicture.map((j) => j.kind), ["render"]);
  assert.deepEqual(plan.noSource.map((j) => j.kind), ["relight", "view"]);
  // everything already done: nothing to do
  const done = Object.fromEntries(jobs.map((j) => [resultKey(j), { promptHash: j.promptHash }]));
  assert.equal(planRun(jobs, () => true, done).jobs.length, 0);
  // the relight changes: it and the view after it run, the renders do not
  const g2 = updateSettings(g, "relight1", { lighting: "night" });
  const ev2 = evaluateGraph(g2, D);
  assert.ok(ev2.ok);
  const p2 = planRun(allJobs(g2, ev2.outputs), () => true, done);
  assert.deepEqual(p2.jobs.map((j) => j.kind), ["relight", "relight", "view", "view"]);
  // "Render again" on the renders only would also make their steps run again
  const done2 = { ...done };
  delete done2[resultKey(r1)];
  const p3 = planRun(jobs, () => true, done2);
  assert.deepEqual(p3.jobs.map((j) => j.kind), ["render", "relight", "view"]);
  assert.equal(p3.jobs[1].sourceKey, resultKey(r1));
  assert.ok(l1 && l2);
  assert.match(runBlocker({ backend: "kie", testMode: false, renderNodes: 3, plan: { jobs: [], done: [], noPicture: [], noSource: [l1] }, cost: { credits: 0, unknown: false, paid: true, label: "" }, cap: 10, balance: null })!, /isn't made yet/);
});

test("an Edit step with no words does nothing; with words it uses the Edit tab text", () => {
  let g = addImages(starterGraph(), ["a.png"], 0, 0).graph;
  g = must(addNode(g, "edit", 1800, 40));
  g = must(wire(g, { node: "render1", port: "results" }, { node: "edit1", port: "results" }));
  let ev = evaluateGraph(g, D);
  assert.ok(ev.ok);
  assert.equal(allJobs(g, ev.outputs).filter((j) => j.kind === "edit").length, 0);
  g = updateSettings(g, "edit1", { change: "add light rain on the glass" });
  ev = evaluateGraph(g, D);
  assert.ok(ev.ok);
  const e = allJobs(g, ev.outputs).find((j) => j.kind === "edit")!;
  assert.equal(e.prompt, wordsEditPrompt("add light rain on the glass"));
});

test("Style copy: one job per image, only with a reference photo wired", () => {
  let g = addImages(starterGraph(), ["model.png", "model 2.png", "ref photo.jpg"], 0, 0).graph;
  g = must(addNode(g, "style", 1800, 40));
  const [a, b, ref] = g.nodes.filter((n) => n.kind === "image").map((n) => n.id);
  g = must(wire(g, { node: a, port: "image" }, { node: "style1", port: "images" }));
  g = must(wire(g, { node: b, port: "image" }, { node: "style1", port: "images" }));
  let ev = evaluateGraph(g, D);
  assert.ok(ev.ok);
  assert.equal(allJobs(g, ev.outputs).filter((j) => j.kind === "style").length, 0, "no reference yet");
  g = must(wire(g, { node: ref, port: "image" }, { node: "style1", port: "reference" }));
  ev = evaluateGraph(g, D);
  assert.ok(ev.ok);
  const jobs = allJobs(g, ev.outputs).filter((j) => j.kind === "style");
  assert.equal(jobs.length, 2);
  assert.ok(jobs.every((j) => j.refImageNodeId === ref && /^REFERENCE STYLE COPY/.test(j.prompt)));
  // the reference photo needs its picture too
  const plan = planRun(jobs, (id) => id !== ref, {});
  assert.equal(plan.noPicture.length, 2);
  // a light from the dial goes in lower case, as on the Edit tab
  g = updateSettings(g, "style1", { light: "time:17:30" } as Partial<SettingsByKind["style"]>);
  ev = evaluateGraph(g, D);
  assert.ok(ev.ok);
  assert.match(allJobs(g, ev.outputs).find((j) => j.kind === "style")!.prompt, /use this light instead of the light in Image 2: golden hour at 17:30/);
});

test("chain nodes save and load; bad values are made safe", () => {
  const g = chain();
  const back = parseGraph(serializeGraph(g));
  assert.ok(back.ok);
  assert.deepEqual(back.graph, g);
  const r = parseGraph({
    format: "drs-graph",
    version: 1,
    nodes: [
      { id: "v", kind: "view", settings: { orbit: 999, tilt: -5, lensMm: "wide", distanceM: 0 } },
      { id: "l", kind: "relight", settings: { lighting: "disco", scene: "attic" } },
      { id: "s", kind: "style", settings: { scene: "space", light: "laser" } },
    ],
  });
  assert.ok(r.ok);
  assert.deepEqual(r.graph.nodes.map((n) => n.settings), [
    { orbit: 180, tilt: 0, lensMm: 35, distanceM: 1 },
    { lighting: "blue-hour", scene: "auto" },
    { scene: "exterior", light: "reference" },
  ]);
});
