import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRenderPrompt } from "../src/core/prompt";
import { composeRenderPrompt } from "../src/core/render-prompt";
import type { RenderTabInput } from "../src/core/render-prompt";
import { countSet, dynamicLines } from "../src/core/dynamic";
import { DEFAULT_SETTINGS } from "../src/core/settings";
import { findLibraryItem } from "../src/core/library";
import { splitTypology } from "../src/lib/typology";
import { lightingGuidance, withOverride } from "../src/lib/lighting";
import { DEFAULT_FITTINGS, fittingsLine } from "../src/lib/fittings";
import type { Preset } from "../src/core/types";
import { connect, defaultsFromSettings, evaluateGraph, allPrompts, makeNode, GRAPH_DEFAULT_LOOK } from "../src/core/graph";
import type { Graph, GraphNode } from "../src/core/graph";

/** The Render tab's buildPrompt steps exactly as they were in actions.ts before the move. */
function oldRenderTab(i: RenderTabInput): { prompt: string; removed: string[] } {
  const split = splitTypology(i.preset.style);
  const preset: Preset = { ...i.preset, style: split.style };
  const scene = i.lightScene ?? (i.preset.projectType === "interior" ? "interior" : "exterior");
  const fit = fittingsLine(scene, i.fittings[scene]);
  const extras: string[] = [...dynamicLines(i.dynamic), lightingGuidance(scene), ...(fit ? [fit] : [])];
  let fromSun = countSet(i.dynamic.time) > 0;
  if (i.sunLine) {
    extras.push(i.sunLine);
    fromSun = true;
  }
  const prompt = buildRenderPrompt({
    preset,
    notes: "",
    facts: i.facts,
    hasLinePass: i.hasLinePass,
    extras,
    lineStrength: i.lineStrength,
    look: i.look,
    materialLock: i.materialLock,
    boundaryLock: i.boundaryLock,
    lightingFromDynamic: fromSun,
    avoid: i.avoid,
  });
  return { prompt: withOverride(prompt, i.noteLines, i.notes), removed: split.removed };
}

function lib(id: string): Preset {
  const it = findLibraryItem(id)!;
  return { id: it.id, name: it.name, projectType: it.projectType, lighting: it.lighting, environment: it.environment, style: it.style };
}

const S = DEFAULT_SETTINGS;

function tabInput(over: Partial<RenderTabInput>): RenderTabInput {
  return {
    preset: lib(GRAPH_DEFAULT_LOOK),
    lightScene: null,
    fittings: { interior: DEFAULT_FITTINGS.interior, exterior: DEFAULT_FITTINGS.exterior },
    dynamic: S.dynamic,
    sunLine: null,
    hasLinePass: false,
    lineStrength: S.lineStrength,
    look: S.look,
    materialLock: S.materialLock,
    boundaryLock: S.boundaryLock,
    avoid: S.avoid,
    noteLines: [],
    notes: "",
    ...over,
  };
}

test("the moved Render tab prompt is unchanged", () => {
  const cases: Partial<RenderTabInput>[] = [
    {},
    { preset: { ...lib("int-bathroom-minimal"), lighting: "time:16:30" } },
    { lightScene: "exterior", materialLock: true, notes: "ផ្ទះពណ៌ស", noteLines: ["Add trees."] },
    { sunLine: "Sun: low from the west.", look: "cgi", boundaryLock: true, hasLinePass: true, lineStrength: 0.4 },
    { fittings: { interior: { on: true, types: ["ceiling", "strip"], other: "", kelvin: 2700, level: 2 }, exterior: { ...DEFAULT_FITTINGS.exterior, on: false } } },
  ];
  for (const c of cases) assert.deepEqual(composeRenderPrompt(tabInput(c)), oldRenderTab(tabInput(c)));
});

let n = 0;
function add(g: Graph, node: GraphNode): GraphNode {
  g.nodes.push(node);
  return node;
}
function wire(g: Graph, from: string, fp: string, to: string, tp: string): Graph {
  const r = connect(g, { node: from, port: fp }, { node: to, port: tp }, `w${++n}`);
  if ("reason" in r) throw new Error(r.reason);
  return r.graph;
}

test("graph prompt is identical to the Render tab for the same settings", () => {
  let g: Graph = { name: "t", nodes: [], wires: [], view: { x: 0, y: 0, zoom: 1 } };
  add(g, { ...makeNode("image", "img1"), settings: { name: "Bathroom 01.png" } });
  add(g, { ...makeNode("look", "look"), settings: { presetId: "int-bathroom-minimal" } });
  add(g, { ...makeNode("light", "light"), settings: { lighting: "interior-evening", scene: "auto" } });
  add(g, { ...makeNode("surroundings", "sur"), settings: { contexts: ["view-garden", "custom:a quiet lane"] } });
  const fit = { on: true, types: ["cove", "pendant"], other: "", kelvin: 3000, level: 1 };
  add(g, { ...makeNode("fittings", "fit"), settings: { fittings: fit, materialLock: true, notes: "Keep the grey tiles." } });
  add(g, makeNode("prompt", "p"));
  g = wire(g, "look", "look", "light", "look");
  g = wire(g, "light", "look", "sur", "look");
  g = wire(g, "sur", "look", "fit", "look");
  g = wire(g, "fit", "look", "p", "look");
  g = wire(g, "img1", "image", "p", "images");

  const r = evaluateGraph(g, defaultsFromSettings(S));
  assert.ok(r.ok);
  const [item] = allPrompts(g, r.outputs);
  const expected = composeRenderPrompt(
    tabInput({
      preset: { ...lib("int-bathroom-minimal"), lighting: "interior-evening", environment: "view-garden,custom:a quiet lane" },
      fittings: { interior: fit, exterior: fit },
      materialLock: true,
      notes: "Keep the grey tiles.",
    }),
  );
  assert.equal(item.text, expected.prompt);
  assert.equal(item.text, oldRenderTab(tabInput({
    preset: { ...lib("int-bathroom-minimal"), lighting: "interior-evening", environment: "view-garden,custom:a quiet lane" },
    fittings: { interior: fit, exterior: fit },
    materialLock: true,
    notes: "Keep the grey tiles.",
  })).prompt);
  assert.match(item.text, /a quiet lane/);
  assert.equal(item.guessed, false);
});
