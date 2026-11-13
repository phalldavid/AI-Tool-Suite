import { test } from "node:test";
import assert from "node:assert/strict";
import { registerLoader, revealResult } from "../src/ui/loader/bus";
import { LOADER_STYLES, STATUS_WORDS } from "../src/ui/loader/engine";
import { KM, translate } from "../src/lib/i18n";

const img = { mimeType: "image/png", data: "" };

test("loader bus: no loader showing means no wait", async () => {
  const t = Date.now();
  await revealResult(img);
  assert.ok(Date.now() - t < 50);
});

test("loader bus: waits for the newest loader's reveal, then the older one takes over", async () => {
  const seen: string[] = [];
  const offA = registerLoader(async () => void seen.push("a"));
  const offB = registerLoader(() => new Promise<void>((r) => setTimeout(() => (seen.push("b"), r()), 30)));
  await revealResult(img);
  assert.deepEqual(seen, ["b"]);
  offB();
  await revealResult(img);
  assert.deepEqual(seen, ["b", "a"]);
  offA();
});

test("loader bus: a stuck reveal never blocks the render for long", async () => {
  const off = registerLoader(() => new Promise<void>(() => undefined));
  const t = Date.now();
  await revealResult(img, 40);
  assert.ok(Date.now() - t < 500);
  off();
});

test("loader: every label, hint, status word and busy line has Khmer", () => {
  for (const s of LOADER_STYLES) {
    assert.ok(KM[s.label], s.label);
    assert.ok(KM[s.hint], s.hint);
  }
  for (const w of STATUS_WORDS) assert.ok(KM[w], w);
  for (const w of ["Creating your image", "Creating the new view", "Copying the style", "Finishing up", "Stop", "Loading animation", "Orb gather time"]) assert.ok(KM[w], w);
  assert.equal(translate("Creating 3 images"), "កំពុងបង្កើតរូបភាព 3");
  assert.equal(translate("Creating view 2 of 4"), "កំពុងបង្កើតទិដ្ឋភាព 2 នៃ 4");
});

test("loader: the default style is the orb, and it is listed first", () => {
  assert.equal(LOADER_STYLES[0].id, "orb");
  assert.equal(new Set(LOADER_STYLES.map((s) => s.id)).size, LOADER_STYLES.length);
});
