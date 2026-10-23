import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanPeople, dnaConflicts, dnaGroup, kieAnalyser, parseDna, PEOPLE_CLOSER } from "../src/analysis";
import { buildRenderPrompt } from "../src/prompt";
import { BUILT_IN_PRESETS } from "../src/presets";
import { dynamicLines } from "../src/dynamic";
import type { KieTransport } from "../src/providers/kie";

test("material DNA parses tag lines and skips chatter", () => {
  const tags = parseDna("Here are the tags:\n- Floor: light grey porcelain tiles, matt\n2. **Countertop**: black marble\nTAG: Window frames: dark grey aluminium\n\nNotes follow");
  assert.deepEqual(tags.map((t) => t.text), ["Floor: light grey porcelain tiles, matt", "Countertop: black marble", "Window frames: dark grey aluminium"]);
  assert.ok(tags.every((t) => t.on));
});

test("material DNA groups by the object name", () => {
  assert.equal(dnaGroup("Wall sconce: brass"), "lighting");
  assert.equal(dnaGroup("Toilet: white ceramic"), "metals");
  assert.equal(dnaGroup("Shower enclosure glass: green tint"), "openings");
  assert.equal(dnaGroup("Floor: terrazzo"), "floors");
  assert.equal(dnaGroup("Vanity cabinet: walnut"), "joinery");
});

test("notes that touch a tag are flagged", () => {
  const tags = ["Shower enclosure: green-tinted tempered glass panels", "Floor: charcoal porcelain"];
  assert.deepEqual(dnaConflicts("turn green transparency colour to realistic glass", tags), [tags[0]]);
  assert.deepEqual(dnaConflicts("", tags), []);
});

test("prompt carries locks, DNA, people, reference and avoid in order, notes win", () => {
  const p = buildRenderPrompt({
    preset: BUILT_IN_PRESETS[0],
    notes: "clear glass",
    hasLinePass: false,
    materialLock: true,
    boundaryLock: true,
    dna: ["Floor: terrazzo"],
    people: "A woman reads by the window.",
    referenceIndex: 2,
    avoid: "plastic",
  });
  const order = ["Material lock", "Boundary lock", "Material list", "- Floor: terrazzo", "Image 2 is a style reference", "People: A woman", "Additional notes", "follow the additional notes first", "Avoid: plastic."];
  let at = -1;
  for (const o of order) {
    const i = p.indexOf(o);
    assert.ok(i > at, `${o} out of order`);
    at = i;
  }
});

test("3D render look changes the opening and closing lines", () => {
  const p = buildRenderPrompt({ preset: BUILT_IN_PRESETS[0], hasLinePass: false, look: "cgi", avoid: "CGI look, plastic" });
  assert.match(p, /3D visualisation \(V-Ray or Corona quality\) of this building/);
  assert.doesNotMatch(p, /real photograph by a professional/);
  assert.match(p, /Avoid: plastic\./);
});

test("new dynamic generators: camera replaces the default lens line, plates and foreground", () => {
  const lines = dynamicLines({
    camera: { view: "drone", fx: ["motion"] },
    foreground: { items: ["paddy"] },
    vehicles: { model: "lexusrx", extras: ["plate"] },
    plants: { features: ["koi"] },
    time: { wind: "breeze" },
  });
  assert.ok(lines.some((l) => /^Camera and effects: drone view/.test(l)));
  assert.ok(lines.some((l) => /^Foreground: a green rice paddy/.test(l)));
  assert.ok(lines.some((l) => /Lexus RX SUV as the main vehicle; with realistic Cambodian licence plates/.test(l)));
  assert.ok(lines.some((l) => /^Plants: add a koi pond/.test(l)));
  assert.ok(lines.some((l) => /light breeze/.test(l)));
  const p = buildRenderPrompt({ preset: BUILT_IN_PRESETS[0], hasLinePass: false, extras: lines });
  assert.doesNotMatch(p, /\nCamera: /);
});

test("people answer is tidied and closed with the matching sentence", () => {
  const out = cleanPeople("1. A man sits on the sofa.\n- **A child** plays on the rug.");
  assert.equal(out, `A man sits on the sofa. A child plays on the rug. ${PEOPLE_CLOSER}`);
});

test("kie analyser uploads then asks the vision model", async () => {
  const calls: string[] = [];
  const t: KieTransport = {
    async json(_m, url, _k, body) {
      calls.push(url);
      if (url.includes("upload")) return { status: 200, body: { code: 200, data: { downloadUrl: "https://f/x.jpg" } } };
      const msg = (body as { messages: { content: { type: string; image_url?: { url: string } }[] }[] }).messages[0].content;
      assert.equal(msg[1].image_url?.url, "https://f/x.jpg");
      return { status: 200, body: { choices: [{ message: { content: "Floor: tiles" } }] } };
    },
    image: async () => ({ mimeType: "image/png", data: "" }),
  };
  assert.equal(await kieAnalyser("k", t)("p", { mimeType: "image/jpeg", data: "AA" }), "Floor: tiles");
  assert.match(calls[1], /gemini-3-6-flash-openai\/v1\/chat\/completions/);
});

test("each topic has one source: lock beats preset materials, Time beats preset lighting", () => {
  const preset = { ...BUILT_IN_PRESETS[0], style: "white render, teak" };
  const locked = buildRenderPrompt({ preset, hasLinePass: false, materialLock: true, extras: ["Materials: Floor in terrazzo."] });
  assert.ok(locked.includes("Finish quality and mood (materials stay as modelled): white render, teak."));
  assert.ok(!locked.includes("Materials: Floor in terrazzo."));
  assert.ok(!locked.includes("Materials and style:"));
  const withDna = buildRenderPrompt({ preset, hasLinePass: false, dna: ["Floor: terrazzo"] });
  assert.ok(withDna.includes("Overall style: white render, teak."));
  const timed = buildRenderPrompt({ preset, hasLinePass: false, lightingFromDynamic: true, extras: ["Time and weather: night."] });
  assert.ok(!timed.includes("Lighting:"));
  assert.ok(timed.includes("Time and weather: night."));
  const people = buildRenderPrompt({ preset, hasLinePass: false, people: "Two kids play.", extras: ["People: add tourists."] });
  assert.ok(!people.includes("add tourists"));
});

test("a locked earlier render is sent as a same-project reference", () => {
  const p = buildRenderPrompt({ preset: BUILT_IN_PRESETS[0], hasLinePass: true, referenceIndex: 3, referenceIsRender: true });
  assert.ok(p.includes("Image 3 is an earlier render of this same project"));
  assert.ok(!p.includes("style reference only"));
});
