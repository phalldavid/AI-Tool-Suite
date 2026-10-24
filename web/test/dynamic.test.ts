import { test } from "node:test";
import assert from "node:assert/strict";
import { findGenerator, plateText } from "../src/dynamic";

test("plates default to D4VID and take custom text", () => {
  const veh = findGenerator("vehicles")!;
  assert.match(veh.build({ extras: ["plate"] }) ?? "", /read "D4VID"/);
  assert.match(veh.build({ extras: ["plate"], plate: "kh 2026!" }) ?? "", /read "KH 2026"/);
  assert.equal(veh.build({ plate: "BORA" }), null, "plate text alone (e.g. from the Notes box) adds no Vehicles line");
  assert.equal(plateText("abcdefghijklmnop"), "ABCDEFGHIJKL");
});
