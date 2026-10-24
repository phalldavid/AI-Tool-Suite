import { test } from "node:test";
import assert from "node:assert/strict";
import { findGenerator, plateText } from "../src/dynamic";

test("plates default to D4VID and take custom text", () => {
  const veh = findGenerator("vehicles")!;
  assert.match(veh.build({ extras: ["plate"] }) ?? "", /read "D4VID"/);
  assert.match(veh.build({ extras: ["plate"], plate: "kh 2026!" }) ?? "", /read "KH 2026"/);
  assert.match(veh.build({ plate: "BORA" }) ?? "", /read "BORA"/, "typing a plate turns plates on");
  assert.equal(plateText("abcdefghijklmnop"), "ABCDEFGHIJKL");
});
