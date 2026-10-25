import { test } from "node:test";
import assert from "node:assert/strict";
import { progressAt, runningLong } from "../src/progress";

test("progress: slow start, faster middle, never past 95% on its own", () => {
  const typical = 20_000;
  const step = (a: number, b: number) => progressAt(b * typical, typical) - progressAt(a * typical, typical);
  assert.ok(progressAt(1000, typical) < 0.1, "starts slow");
  assert.ok(step(0.4, 0.6) > step(0, 0.2), "faster in the middle than at the start");
  assert.ok(step(0.4, 0.6) > step(0.8, 1), "eases near the end");
  assert.ok(progressAt(typical, typical) > 0.85 && progressAt(typical, typical) < 0.9);
  assert.ok(progressAt(10 * typical, typical) <= 0.95 && progressAt(10 * typical, typical) > 0.94);
  let last = 0;
  for (let t = 0; t <= 3 * typical; t += 500) {
    const p = progressAt(t, typical);
    assert.ok(p >= last, "never goes backwards");
    last = p;
  }
  assert.equal(runningLong(39_000, typical), false);
  assert.equal(runningLong(41_000, typical), true);
});
