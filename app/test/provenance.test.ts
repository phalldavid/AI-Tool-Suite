import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { b64ToBytes, buildProvenance, bytesToB64, embedProvenance, fingerprint, MAX_CHAIN, provenanceOf, readProvenance, rememberProvenance, stepOf } from "../src/core/provenance";
import type { ProvSource } from "../src/core/provenance";

const src = (id: string, prompt = "A bright villa living room, Phnom Penh"): ProvSource => ({ id, createdAt: 1_700_000_000_000, tool: "render", presetName: "Living room", prompt, provider: "Kie.ai", model: "nano-banana-2-1", credits: 6, project: "Eh Len Villa" });
const png = (): { mimeType: string; data: string } => ({ mimeType: "image/png", data: bytesToB64(new Uint8Array(readFileSync("app/test/fixtures/portrait.png"))) });

function chunkTypes(b: Uint8Array): string[] {
  const out: string[] = [];
  let o = 8;
  while (o + 12 <= b.length) {
    const len = ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
    out.push(String.fromCharCode(b[o + 4], b[o + 5], b[o + 6], b[o + 7]));
    o += 12 + len;
  }
  return out;
}

test("PNG: record survives, Khmer text and thumbnail included, pixel chunks untouched", () => {
  const p = buildProvenance(src("r-1", "បន្ទប់ទទួលភ្ញៀវ, night, no sun rays"), undefined, { data: "QUJD", width: 512, height: 341 });
  const before = png();
  const out = embedProvenance(before, p);
  const bytes = b64ToBytes(out.data);
  const back = readProvenance(bytes);
  assert.equal(back?.prompt, "បន្ទប់ទទួលភ្ញៀវ, night, no sun rays");
  assert.equal(back?.inputs[0].thumb, "QUJD");
  const was = chunkTypes(b64ToBytes(before.data));
  const now = chunkTypes(bytes);
  assert.deepEqual(now.filter((t) => t !== "iTXt"), was.filter((t) => t !== "iTXt"));
  assert.equal(now.filter((t) => t === "iTXt").length, was.filter((t) => t === "iTXt").length + 2);
  assert.equal(now.indexOf("iTXt"), 1, "placed right after IHDR");
});

test("PNG: embedding again replaces the old record, it does not stack", () => {
  const a = embedProvenance(png(), buildProvenance(src("r-1")));
  const b = embedProvenance(a, buildProvenance(src("r-2", "second prompt")));
  const bytes = b64ToBytes(b.data);
  assert.equal(readProvenance(bytes)?.id, "r-2");
  assert.equal(chunkTypes(bytes).filter((t) => t === "iTXt").length, chunkTypes(b64ToBytes(png().data)).filter((t) => t === "iTXt").length + 2);
});

test("chain: each step carries the earlier ones, capped", () => {
  let p = buildProvenance(src("r-0"));
  for (let i = 1; i <= MAX_CHAIN + 5; i++) p = buildProvenance(src(`r-${i}`, `prompt ${i}`), p);
  assert.equal(p.chain.length, MAX_CHAIN);
  assert.equal(p.chain.at(-1)?.id, `r-${MAX_CHAIN + 4}`);
  assert.equal(p.parent, `r-${MAX_CHAIN + 4}`);
  assert.deepEqual(stepOf(p).id, `r-${MAX_CHAIN + 5}`);
});

test("JPEG: compact record round-trips and replaces the old one", () => {
  // SOI, APP0 (JFIF), a tiny scan, EOI
  const app0 = [0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0];
  const jpg = new Uint8Array([0xff, 0xd8, ...app0, 0xff, 0xda, 0x00, 0x02, 1, 2, 3, 0xff, 0xd9]);
  const one = embedProvenance({ mimeType: "image/jpeg", data: bytesToB64(jpg) }, buildProvenance(src("j-1"), undefined, { data: "QUJD" }));
  const b1 = b64ToBytes(one.data);
  assert.equal(readProvenance(b1)?.id, "j-1");
  assert.equal(readProvenance(b1)?.inputs.length, 0, "thumbnails are left out of JPEG");
  assert.deepEqual([...b1.subarray(0, 2)], [0xff, 0xd8]);
  assert.deepEqual([...b1.subarray(2, 2 + app0.length)], app0, "JFIF header stays first");
  assert.deepEqual([...b1.subarray(b1.length - 9)], [0xff, 0xda, 0x00, 0x02, 1, 2, 3, 0xff, 0xd9]);
  const two = embedProvenance(one, buildProvenance(src("j-2")));
  const b2 = b64ToBytes(two.data);
  assert.equal(readProvenance(b2)?.id, "j-2");
  assert.equal(b2.length < b1.length + 40, true, "old comment removed");
});

test("JPEG: a very long chain is trimmed to fit one segment", () => {
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0x00, 0x02, 1, 0xff, 0xd9]);
  let p = buildProvenance(src("a-0", "x".repeat(3000)));
  for (let i = 1; i <= 25; i++) p = buildProvenance(src(`a-${i}`, "y".repeat(3000)), p);
  const out = b64ToBytes(embedProvenance({ mimeType: "image/jpeg", data: bytesToB64(jpg) }, p).data);
  const back = readProvenance(out);
  assert.equal(back?.id, "a-25");
  assert.equal(back!.chain.length < 25, true);
});

test("pictures without a record, other formats and damaged data are safe", () => {
  assert.equal(readProvenance(b64ToBytes(png().data)), null);
  assert.equal(readProvenance(new Uint8Array([1, 2, 3])), null);
  const webp = { mimeType: "image/webp", data: "UklGRg==" };
  assert.equal(embedProvenance(webp, buildProvenance(src("w"))), webp);
  const bad = b64ToBytes(embedProvenance(png(), buildProvenance(src("r-1"))).data);
  bad[bad.length - 40] ^= 0xff; // damage near the end must not throw
  assert.doesNotThrow(() => readProvenance(bad.subarray(0, bad.length - 20)));
});

test("registry finds a picture again by its data", () => {
  const p = buildProvenance(src("r-9"));
  const img = png();
  rememberProvenance(img.data, p);
  assert.equal(provenanceOf(img.data)?.id, "r-9");
  assert.equal(provenanceOf(img.data + "A"), undefined);
  assert.equal(fingerprint(img.data), fingerprint(img.data));
});
