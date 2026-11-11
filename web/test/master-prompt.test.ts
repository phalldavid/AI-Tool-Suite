import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanMaster, localMaster, masterWriterPrompt, replyPrompt, STYLE_IDEAS } from "../src/master-prompt";

test("the writer prompt carries the brief and ends on architectural accuracy", () => {
  const p = masterWriterPrompt('modern style at night, "warm" glow');
  assert.match(p, /modern style at night, 'warm' glow/);
  assert.match(p, /architectural accuracy first/);
  assert.match(p, /Do not remove any existing element/);
});

test("the writer never sends the glass rule by itself", () => {
  assert.doesNotMatch(masterWriterPrompt("night"), /green/i);
  assert.doesNotMatch(localMaster("night"), /green/i);
});

test("the local master prompt uses the brief and has all 8 sections", () => {
  const p = localMaster("tropical villa at golden hour");
  assert.match(p, /^MASTER PROMPT: tropical villa at golden hour/);
  for (let i = 1; i <= 8; i++) assert.match(p, new RegExp(`\\n${i}\\. `));
});

test("cleanMaster strips fences, bold and headings", () => {
  assert.equal(cleanMaster("```\n## MASTER PROMPT: **x**\n```"), "MASTER PROMPT: x");
});

test("a reply keeps the master prompt and names only the change", () => {
  const r = replyPrompt("BASE PROMPT", "lighter floor.");
  assert.match(r, /lighter floor/);
  assert.match(r, /BASE PROMPT/);
  assert.match(r, /Image 1 is the current render/);
});

test("style ideas have labels and text", () => {
  assert.ok(STYLE_IDEAS.length >= 4);
  for (const s of STYLE_IDEAS) assert.ok(s.label && s.text);
});
