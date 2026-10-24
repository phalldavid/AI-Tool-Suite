import { test } from "node:test";
import assert from "node:assert/strict";
import { EXT_STYLES, EXT_TYPES, filterLibrary, INT_STYLES, libraryItems, ROOMS } from "../src/library";
import { BUILT_IN_PRESETS } from "../src/presets";

test("library ids are unique and every room has every style", () => {
  const all = libraryItems();
  assert.equal(new Set(all.map((x) => x.id)).size, all.length);
  assert.equal(filterLibrary("interior", "all", "kitchen").length, INT_STYLES.length);
  assert.equal(filterLibrary("exterior", "modern", "all").length, EXT_TYPES.length);
  assert.ok(ROOMS.length >= 40);
  assert.ok(all.length > BUILT_IN_PRESETS.length + EXT_STYLES.length * EXT_TYPES.length);
});

test("featured keeps the hand-written presets; search crosses tabs", () => {
  assert.ok(filterLibrary("exterior", "featured", "all").every((x) => x.styleId === "featured"));
  const found = filterLibrary("exterior", "all", "all", "japandi kitchen".split(" ")[1]);
  assert.ok(found.some((x) => x.projectType === "interior"));
  const p = libraryItems().find((x) => x.id === "int-bathroom-japandi")!;
  assert.match(p.style, /walk-in shower/);
  assert.match(p.style, /Japandi/);
});
