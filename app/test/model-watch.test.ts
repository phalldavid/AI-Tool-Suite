import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error plain JS helper
import { knownModels, newModels, pageText } from "../../scripts/model-watch.mjs";

const SRC = `label: "Nano Banana 2.1", id: "nano-banana-pro", label: "GPT Image 2.5 Flare", label: "Seedream 5.5"`;

test("finds models Kie lists that the app doesn't", () => {
  const known = knownModels(SRC);
  const text = pageText("<h2>Seedream 6 Pro</h2><p>Nano Banana 2.1 is cheap</p><li>GPT Image 2.5 Flare</li><li>Flux 3 Klein</li><script>Seedream 9</script>");
  const got = newModels(text, known);
  assert.ok(got.includes("Seedream 6 Pro"));
  assert.ok(got.includes("Flux 3 Klein"));
  assert.ok(!got.some((n: string) => /Nano Banana 2\.1|Flare/.test(n)));
  assert.ok(!got.includes("Seedream 9"), "script text is ignored");
});

test("a bare family name is not a model", () => {
  assert.deepEqual(newModels("Try Seedream and Flux today", knownModels(SRC)), []);
});
