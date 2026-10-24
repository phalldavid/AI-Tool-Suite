import { test } from "node:test";
import assert from "node:assert/strict";
import { bugReport } from "../src/contact";

test("bug report lists setup and log, and never includes saved keys", () => {
  const text = bugReport({
    host: "sketchup",
    backend: "kie",
    model: "nano-banana-2-1",
    userAgent: "SketchUp",
    secrets: ["kie-secret-123456", ""],
    log: [{ at: 0, kind: "error", text: "Render failed", detail: "401 for key kie-secret-123456 and AIzaSyA1234567890abcdefghij" }],
  });
  assert.match(text, /Version: 0\.1\.0 \(sketchup\)/);
  assert.match(text, /AI service: kie, nano-banana-2-1/);
  assert.match(text, /\[error\] Render failed/);
  assert.doesNotMatch(text, /kie-secret-123456/);
  assert.doesNotMatch(text, /AIzaSy/);
});
