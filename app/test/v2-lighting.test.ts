import { test } from "node:test";
import assert from "node:assert/strict";
import { lightingGuidance, overrideBlock, styleCopyPrompt, withOverride } from "../src/lib/lighting";

test("interior and exterior get different lighting instructions", () => {
  assert.match(lightingGuidance("interior"), /windows, doors and openings/);
  assert.match(lightingGuidance("interior"), /pendant/);
  assert.match(lightingGuidance("exterior"), /sky light/);
  assert.doesNotMatch(lightingGuidance("exterior"), /pendant/);
});

test("notes go on top as the highest priority, and only when there are any", () => {
  assert.equal(overrideBlock([], "  "), "");
  assert.equal(withOverride("BODY", [], ""), "BODY");
  const p = withOverride("BODY", ["Turn the blue solid-colour surfaces into water."], "two motorbikes by the gate");
  assert.ok(p.startsWith("CRITICAL OVERRIDE"));
  assert.match(p, /- two motorbikes by the gate\./);
  assert.ok(p.indexOf("BODY") > p.indexOf("take precedence"));
  assert.match(withOverride("B", [], "ឡានពីរ"), /written in Khmer/);
});

test("style copy keeps image 1 and takes only the look of image 2", () => {
  const ext = styleCopyPrompt({ scene: "exterior", dialLight: null });
  assert.match(ext, /Image 1 \(the SketchUp 3D model\) strictly as the structural and geometric base/);
  assert.match(ext, /Do not copy the building shape, layout or architecture of Image 2/);
  assert.match(ext, /replicate the lighting of Image 2/);
  assert.match(ext, /botanical style/);
  const int = styleCopyPrompt({ scene: "interior", dialLight: "afternoon sun at 16:30" });
  assert.match(int, /interior photograph/);
  assert.match(int, /use this light instead of the light in Image 2: afternoon sun at 16:30/);
  assert.doesNotMatch(int, /botanical style/);
});
