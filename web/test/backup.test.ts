import { test } from "node:test";
import assert from "node:assert/strict";
import { applyBackup, makeBackup } from "../src/backup";
import { DEFAULT_SETTINGS } from "../src/settings";

test("backup leaves keys out unless asked, and import merges", () => {
  const a = { ...DEFAULT_SETTINGS, kieKey: "secret-kie", favorites: ["ext-villa-modern"], projects: ["Borey Phase 2"] };
  const plain = makeBackup(a, false);
  assert.equal(JSON.stringify(plain).includes("secret-kie"), false);
  assert.equal(makeBackup(a, true).settings.kieKey, "secret-kie");
  const b = { ...DEFAULT_SETTINGS, kieKey: "mine", favorites: ["int-kitchen-japandi"], projects: [] };
  const { settings, summary } = applyBackup(b, JSON.parse(JSON.stringify(plain)));
  assert.equal(settings.kieKey, "mine");
  assert.deepEqual(settings.favorites.sort(), ["ext-villa-modern", "int-kitchen-japandi"]);
  assert.deepEqual(settings.projects, ["Borey Phase 2"]);
  assert.match(summary, /2 favourites/);
  assert.throws(() => applyBackup(b, { hello: 1 }), /isn't a David Render Studio/);
});
