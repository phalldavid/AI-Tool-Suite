import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSceneLockPrompt, parseSlots, slotReadPrompt, sunLine } from "../src/core/scene-lock";

test("scene lock reads slots and drops 'none'", () => {
  const slots = parseSlots('sure: {"facade":"board-formed concrete.","roof":"none","sky":"clear"}', "exterior");
  assert.deepEqual(slots, { facade: "board-formed concrete", sky: "clear" });
  assert.equal(parseSlots("no json", "exterior"), null);
  assert.match(slotReadPrompt("bathroom"), /"glass":/);
});

test("sun line follows the camera", () => {
  assert.match(sunLine({ sunToCameraDeg: 170, sunElevationDeg: 40 })!, /behind the camera/);
  assert.match(sunLine({ sunToCameraDeg: 90, sunElevationDeg: 10 })!, /from the right.*very low/);
  assert.match(sunLine({ sunToCameraDeg: -60, sunElevationDeg: 70 })!, /ahead and to the left.*high overhead/);
  assert.match(sunLine({ sunToCameraDeg: 0, sunElevationDeg: -5 })!, /below the horizon/);
  assert.equal(sunLine({}), null);
});

test("scene lock prompt has the slots, sun, lens and placeholder rules", () => {
  const p = buildSceneLockPrompt(
    { master: null, kind: "bathroom", slots: { floor: "grey terrazzo", glass: "clear glass, brass frame" } },
    { focalLengthMm: 24, perspective: true },
    "no towels",
  );
  assert.match(p, /- Floor: grey terrazzo/);
  assert.match(p, /- Glass screen: clear glass, brass frame/);
  assert.match(p, /24 mm lens/);
  assert.doesNotMatch(p, /glass placeholder|green surfaces/);
  assert.match(p, /section cut/);
  assert.match(p, /light fitting/);
  assert.match(p, /Also: no towels\./);
  assert.match(p, /geometry of Image 1 > camera of Image 1 > look of Image 2/);
});
