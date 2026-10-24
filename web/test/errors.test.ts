import { test } from "node:test";
import assert from "node:assert/strict";
import { friendlyError } from "../src/errors";

test("common errors get a plain message and a fix", () => {
  assert.equal(friendlyError("Kie.ai said: internal error, please try again later. (500)")?.action, "retry");
  assert.equal(friendlyError("Credits insufficient (402)")?.action, "topup");
  assert.equal(friendlyError("HTTP 401 invalid key")?.action, "settings");
  assert.equal(friendlyError("429 Too Many Requests")?.text.startsWith("Too many"), true);
  assert.equal(friendlyError("Failed to fetch")?.action, "retry");
  assert.equal(friendlyError("Image blocked by safety filter")?.action, null);
  assert.equal(friendlyError("Pick a capture first"), null);
});
