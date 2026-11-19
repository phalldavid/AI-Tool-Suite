// Ready-made graphs. A template can keep the images already on the canvas:
// they are wired into every Prompt node of the template.

import { IMAGE_GRID, addNode, emptyGraph, wire } from "./edit";
import type { Graph, NodeKind, SettingsByKind } from "./types";

export interface Template {
  id: string;
  name: string;
  /** One line under the name. */
  note: string;
  build: () => Graph;
}

/** Small builder: add nodes by key, then wire them by key. */
function make(name: string, nodes: [string, NodeKind, number, number, Partial<SettingsByKind[NodeKind]>?][], wires: [string, string, string, string][]): Graph {
  let g = emptyGraph(name);
  const id = new Map<string, string>();
  for (const [key, kind, x, y, s] of nodes) {
    const r = addNode(g, kind, x, y, s as never);
    if ("graph" in r) {
      g = r.graph;
      id.set(key, r.id!);
    }
  }
  for (const [f, fp, t, tp] of wires) {
    const r = wire(g, { node: id.get(f)!, port: fp }, { node: id.get(t)!, port: tp });
    if ("graph" in r) g = r.graph;
  }
  return g;
}

/** Prompt nodes grow with the images wired in (up to about 600 px), so rows are 620 px apart. */
/** Adds one Render node fed by every Prompt node, and a Result node after it. */
function withRender(g: Graph): Graph {
  const prompts = g.nodes.filter((n) => n.kind === "prompt");
  if (!prompts.length) return g;
  const x = Math.max(...prompts.map((n) => n.x)) + 440;
  const y = Math.min(...prompts.map((n) => n.y));
  let out = g;
  const r = addNode(out, "render", x, y);
  if (!("graph" in r)) return g;
  out = r.graph;
  const s = addNode(out, "result", x + 320, y);
  if (!("graph" in s)) return g;
  out = s.graph;
  for (const p of prompts) {
    const w = wire(out, { node: p.id, port: "prompts" }, { node: r.id!, port: "prompts" });
    if ("graph" in w) out = w.graph;
  }
  const w = wire(out, { node: r.id!, port: "results" }, { node: s.id!, port: "results" });
  return "graph" in w ? w.graph : out;
}

const L = (a: string, b: string): [string, string, string, string] => [a, "look", b, "look"];

export const TEMPLATES: Template[] = [
  {
    id: "empty",
    name: "Empty canvas",
    note: "Start from nothing.",
    build: () => emptyGraph("Untitled graph"),
  },
  {
    id: "one-look",
    name: "One look, many images",
    note: "Every screenshot gets the same look and light.",
    build: () =>
      withRender(make(
        "One look, many images",
        [
          ["note", "note", 40, 40, { text: "Drop screenshots on the canvas. Each image gets its own prompt with this look and light." }],
          ["look", "look", 340, 40],
          ["light", "light", 640, 40],
          ["prompt", "prompt", 940, 40],
        ],
        [L("look", "light"), L("light", "prompt")],
      )),
  },
  {
    id: "compare-4",
    name: "Compare 4 looks",
    note: "One image, four styles side by side.",
    build: () =>
      withRender(make(
        "Compare 4 looks",
        [
          ["l1", "look", 340, 40, { presetId: "ext-villa-modern" }],
          ["l2", "look", 340, 660, { presetId: "ext-villa-tropical" }],
          ["l3", "look", 340, 1280, { presetId: "ext-villa-new-khmer" }],
          ["l4", "look", 340, 1900, { presetId: "ext-villa-indochine" }],
          ["p1", "prompt", 660, 40],
          ["p2", "prompt", 660, 660],
          ["p3", "prompt", 660, 1280],
          ["p4", "prompt", 660, 1900],
        ],
        [L("l1", "p1"), L("l2", "p2"), L("l3", "p3"), L("l4", "p4")],
      )),
  },
  {
    id: "day-night",
    name: "Day and night",
    note: "Same look in afternoon sun and at blue hour.",
    build: () =>
      withRender(make(
        "Day and night",
        [
          ["look", "look", 340, 40],
          ["day", "light", 640, 40, { lighting: "afternoon", scene: "auto" }],
          ["night", "light", 640, 660, { lighting: "blue-hour", scene: "auto" }],
          ["pd", "prompt", 940, 40],
          ["pn", "prompt", 940, 660],
        ],
        [L("look", "day"), L("look", "night"), L("day", "pd"), L("night", "pn")],
      )),
  },
  {
    id: "interior-lights",
    name: "Interior with lights on",
    note: "Room guess from the file name, daylight and warm fittings.",
    build: () =>
      withRender(make(
        "Interior with lights on",
        [
          ["look", "look", 340, 40],
          ["light", "light", 640, 40, { lighting: "interior-day", scene: "interior" }],
          ["fit", "fittings", 940, 40, { fittings: { on: true, types: ["ceiling", "cove", "cabinet"], other: "", kelvin: 3000, level: 1 }, materialLock: null, notes: "" }],
          ["prompt", "prompt", 1270, 40],
        ],
        [L("look", "light"), L("light", "fit"), L("fit", "prompt")],
      )),
  },
  {
    id: "exterior-setting",
    name: "Exterior in a setting",
    note: "Afternoon sun with a Phnom Penh street around it.",
    build: () =>
      withRender(make(
        "Exterior in a setting",
        [
          ["look", "look", 340, 40],
          ["light", "light", 640, 40, { lighting: "afternoon", scene: "exterior" }],
          ["sur", "surroundings", 940, 40, { contexts: ["pp-street"] }],
          ["prompt", "prompt", 1240, 40],
        ],
        [L("look", "light"), L("light", "sur"), L("sur", "prompt")],
      )),
  },
];

/** Adds steps after the template's Render node, each with its own Result node. */
function thenSteps(g: Graph, steps: [NodeKind, Partial<SettingsByKind[NodeKind]>][]): Graph {
  const render = g.nodes.find((n) => n.kind === "render");
  if (!render) return g;
  let out = g;
  steps.forEach(([kind, s], i) => {
    const y = render.y + 420 + i * 420;
    const a = addNode(out, kind, render.x, y, s as never);
    if (!("graph" in a)) return;
    out = a.graph;
    const b = addNode(out, "result", render.x + 340, y);
    if (!("graph" in b)) return;
    out = b.graph;
    for (const [f, fp, t, tp] of [
      [render.id, "results", a.id!, "results"],
      [a.id!, "results", b.id!, "results"],
    ]) {
      const w = wire(out, { node: f, port: fp }, { node: t, port: tp });
      if ("graph" in w) out = w.graph;
    }
  });
  return out;
}

TEMPLATES.push(
  {
    id: "render-relight",
    name: "Render, then relight",
    note: "Each render again at blue hour and at night.",
    build: () => ({ ...thenSteps(findTemplate("one-look")!.build(), [["relight", { lighting: "blue-hour", scene: "auto" }], ["relight", { lighting: "night", scene: "auto" }]]), name: "Render, then relight" }),
  },
  {
    id: "render-views",
    name: "Render, then new views",
    note: "The same building from 40° left and 40° right.",
    build: () => ({
      ...thenSteps(findTemplate("one-look")!.build(), [
        ["view", { orbit: -40, tilt: 12, lensMm: 35, distanceM: 35 }],
        ["view", { orbit: 40, tilt: 12, lensMm: 35, distanceM: 35 }],
      ]),
      name: "Render, then new views",
    }),
  },
  {
    id: "style-copy",
    name: "Style copy from a photo",
    note: "Your screenshots in the look and light of one photo.",
    build: () =>
      make(
        "Style copy from a photo",
        [
          ["note", "note", 40, 40, { text: "Drop your SketchUp screenshots, wire them into Images in. Drop the photo to copy, wire it into Reference photo in." }],
          ["style", "style", 340, 40],
          ["result", "result", 680, 40],
        ],
        [["style", "results", "result", "results"]],
      ),
  },
);

export function findTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

/** The starter graph for a new canvas. */
export function starterGraph(): Graph {
  return findTemplate("one-look")!.build();
}

/**
 * The template, with the Image nodes from `current` kept (same ids, so their
 * pictures stay) and wired into every Prompt node of the template.
 */
export function applyTemplate(current: Graph, template: Graph): Graph {
  const images = current.nodes.filter((n) => n.kind === "image");
  if (!images.length) return template;
  const taken = new Set(template.nodes.map((n) => n.id));
  // Template ids never clash with kept images: rename template nodes if they would.
  let g = template;
  for (const img of images) {
    if (!taken.has(img.id)) continue;
    const clash = g.nodes.find((n) => n.id === img.id)!;
    let k = 1;
    while (taken.has(`${clash.kind}${k}`) || images.some((i) => i.id === `${clash.kind}${k}`)) k++;
    const id = `${clash.kind}${k}`;
    taken.add(id);
    g = {
      ...g,
      nodes: g.nodes.map((n) => (n.id === clash.id ? { ...n, id } : n)),
      wires: g.wires.map((w) => ({ ...w, from: w.from.node === clash.id ? { ...w.from, node: id } : w.from, to: w.to.node === clash.id ? { ...w.to, node: id } : w.to })),
    };
  }
  const left = Math.min(...g.nodes.map((n) => n.x), 340) - IMAGE_GRID.dx;
  const placed = images.map((n, i) => ({
    ...n,
    x: left - Math.floor(i / IMAGE_GRID.rows) * IMAGE_GRID.dx,
    y: 40 + (i % IMAGE_GRID.rows) * IMAGE_GRID.dy,
  }));
  g = { ...g, nodes: [...placed, ...g.nodes] };
  for (const p of g.nodes.filter((n) => n.kind === "prompt")) {
    for (const img of placed) {
      const r = wire(g, { node: img.id, port: "image" }, { node: p.id, port: "images" });
      if ("graph" in r) g = r.graph;
    }
  }
  return { ...g, name: template.name, view: current.view };
}
