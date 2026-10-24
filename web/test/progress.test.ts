import { test } from "node:test";
import assert from "node:assert/strict";
import { progressAt, runningLong } from "../src/progress";

test("progress: fast start, slows, never past 90% on its own", () => {
  const typical = 20_000;
  assert.ok(progressAt(2000, typical) >= 0.3, "about 30% after 2 s");
  assert.ok(progressAt(typical, typical) > 0.75 && progressAt(typical, typical) < 0.9);
  assert.ok(progressAt(10 * typical, typical) <= 0.9 && progressAt(10 * typical, typical) > 0.89);
  let last = 0;
  for (let t = 0; t <= 3 * typical; t += 500) {
    const p = progressAt(t, typical);
    assert.ok(p >= last, "never goes backwards");
    last = p;
  }
  assert.equal(runningLong(39_000, typical), false);
  assert.equal(runningLong(41_000, typical), true);
});
