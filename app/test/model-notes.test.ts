import { test } from "node:test";
import assert from "node:assert/strict";
import { MODEL_NOTES, modelGuard, withModelGuard } from "../src/core/model-notes";
import { KIE_MODELS } from "../src/core/providers/kie-models";

test("every tested note belongs to a model the app offers", () => {
  const ids = new Set(KIE_MODELS.map((m) => m.id));
  for (const id of Object.keys(MODEL_NOTES)) assert.ok(ids.has(id), `${id} is not in KIE_MODELS`);
});

test("guard lines go in only when an input image is sent", () => {
  const id = "gpt-image-2-6/sunburst-image-to-image";
  const withImg = withModelGuard("Render this cafe.", id, true);
  assert.match(withImg, /^Render this cafe\.\n\nModel check:\n- /);
  assert.match(withImg, /do not blow the windows out to white/);
  assert.equal(withModelGuard("Render this cafe.", id, false), "Render this cafe.");
});

test("models without a test get no guard", () => {
  assert.equal(modelGuard("seedream/5-flash-image-to-image"), "");
  assert.equal(withModelGuard("p", "seedream/5-flash-image-to-image", true), "p");
});
