import { test } from "node:test";
import assert from "node:assert/strict";
import { HAPTIC, SOUND, feel, getFeel, installFeel, notify, setFeel, withFeel } from "../src/lib/feel";
import type { Feel } from "../src/lib/feel";
import { KM } from "../src/lib/i18n";

const KINDS: Feel[] = ["tap", "toggle", "success", "warn", "error", "start", "done"];

test("every kind of moment has a haptic and a sound entry", () => {
  for (const k of KINDS) {
    assert.ok(k in HAPTIC, `haptic for ${k}`);
    assert.ok(k in SOUND, `sound for ${k}`);
  }
});

test("sounds stay soft, short and never click: low gain, sensible pitch, under half a second", () => {
  assert.deepEqual(SOUND.tap, [], "a plain press is silent, so sound never gets tiring");
  for (const k of KINDS) {
    for (const t of SOUND[k]) {
      assert.ok(t.gain > 0 && t.gain <= 0.05, `${k} gain ${t.gain}`);
      assert.ok(t.from >= 120 && t.from <= 2000 && (t.to === undefined || (t.to >= 120 && t.to <= 2000)), `${k} pitch`);
      assert.ok(t.at + t.len <= 0.5, `${k} length`);
    }
  }
  assert.ok(SOUND.error[0].from < SOUND.success[0].from, "an error sounds lower than a success");
});

test("haptics are light: a tick for a press, longer only for errors", () => {
  assert.ok((HAPTIC.tap as number) <= 10);
  const total = (v: number | number[]) => (Array.isArray(v) ? v.reduce((a, b) => a + b, 0) : v);
  assert.ok(total(HAPTIC.error) > total(HAPTIC.success));
  for (const k of KINDS) assert.ok(total(HAPTIC[k]) < 250, k);
});

test("sound is off until asked for, vibration is on", () => {
  assert.equal(getFeel().sound, false);
  assert.equal(getFeel().haptics, true);
});

test("feel never throws, with no browser, no storage and no audio", async () => {
  for (const k of KINDS) feel(k);
  for (const k of ["info", "ok", "error", "warn"] as const) notify(k);
  installFeel();
  setFeel({ haptics: false });
  assert.equal(getFeel().haptics, false);
  setFeel({ haptics: true });
  assert.equal(await withFeel(null, Promise.resolve(7)), 7);
  await assert.rejects(withFeel(null, Promise.reject(new Error("no"))), /no/);
});

test("the Feel settings text is translated", () => {
  const km = KM as Record<string, string>;
  for (const x of ["Feel", "Vibration on phones: a light tick for presses, successes and errors", "Soft sounds for switches, successes, errors and finished renders"]) assert.ok(km[x], x);
});
