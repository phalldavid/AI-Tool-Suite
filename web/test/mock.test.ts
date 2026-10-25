import { test } from "node:test";
import assert from "node:assert/strict";
import { mockAnalysis, MockProvider } from "../src/providers/mock";
import { BORROW_LOOK_PROMPT, cleanBorrowedLook, cleanPeople, dnaPrompt, parseDna, peoplePrompt } from "../src/analysis";
import { parseScene, scenePrompt } from "../src/scene-scan";
import { makeProvider, DEFAULT_SETTINGS } from "../src/settings";

test("test mode: every analysis gets a reply its reader understands", () => {
  assert.ok(parseScene(mockAnalysis(scenePrompt())));
  assert.ok(parseDna(mockAnalysis(dnaPrompt("exterior"))).length >= 3);
  assert.match(cleanPeople(mockAnalysis(peoplePrompt({ scene: "auto", count: "few", who: "mixed" } as never))), /people/i);
  assert.match(cleanBorrowedLook(mockAnalysis(BORROW_LOOK_PROMPT)), /^Style: /);
});

test("test mode: no key needed, renders return an image", async () => {
  const p = makeProvider({ ...DEFAULT_SETTINGS, testMode: true, kieKey: "" });
  assert.equal(p.id, "mock");
  const img = { mimeType: "image/png", data: "AAAA" };
  const out = await new MockProvider(5).render({ prompt: "x", images: [img] });
  assert.equal(out.image.data, "AAAA");
});
