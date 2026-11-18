import { test } from "node:test";
import assert from "node:assert/strict";
import { baseName, roomStarter } from "../src/lib/room";
import { KM } from "../src/lib/i18n";

test("room guess from file names", () => {
  assert.equal(roomStarter("EXP_M01-2 Shower-Tub.jpg"), "int-bathroom-minimal");
  assert.equal(roomStarter("Bathroom_demo.png"), "int-bathroom-minimal");
  assert.equal(roomStarter("master bedroom 3.png"), "int-bedroom-tropical");
  assert.equal(roomStarter("Kitchen view.jpg"), "int-kitchen-japandi");
  assert.equal(roomStarter("Living Room.jpg"), "int-living-modern");
  assert.equal(roomStarter("scene 12.png"), null);
  assert.equal(roomStarter("Pasted image"), null);
  // words that only contain a room word inside another word must not match
  assert.equal(roomStarter("Embedded.png"), null);
});

test("base name drops the extension", () => {
  assert.equal(baseName("EXP_M01.jpg"), "EXP_M01");
  assert.equal(baseName("Pasted image"), "Pasted image");
});

test("new Khmer entry exists", () => {
  assert.ok((KM as Record<string, string>)["Copy prompt"]);
});
