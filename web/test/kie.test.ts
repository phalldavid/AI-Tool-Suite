import { test } from "node:test";
import assert from "node:assert/strict";
import { KieProvider, resultUrl, type KieTransport } from "../src/providers/kie";
import { findKieModel, priceText, ratioFor, resolutionFor } from "../src/providers/kie-models";

function fakeTransport(states: string[]) {
  const calls: { method: string; url: string; body?: unknown }[] = [];
  let polls = 0;
  const t: KieTransport = {
    async json(method, url, _key, body) {
      calls.push({ method, url, body });
      if (url.includes("file-base64-upload")) return { status: 200, body: { code: 200, data: { downloadUrl: "https://tempfile.example/a.png" } } };
      if (url.endsWith("/jobs/createTask")) return { status: 200, body: { code: 200, data: { taskId: "t1" } } };
      if (url.includes("/jobs/recordInfo")) {
        const state = states[Math.min(polls++, states.length - 1)];
        return { status: 200, body: { code: 200, data: { state, resultJson: JSON.stringify({ resultUrls: ["https://cdn.example/out.png"] }), failMsg: "bad prompt" } } };
      }
      if (url.endsWith("/chat/credit")) return { status: 200, body: { code: 200, data: 100 } };
      return { status: 404, body: null };
    },
    async image(url) {
      calls.push({ method: "IMG", url });
      return { mimeType: "image/png", data: "QUJD" };
    },
  };
  return { t, calls };
}

const img = { mimeType: "image/png", data: "AAAA" };

test("kie render uploads, starts a job with the link, polls, downloads", async () => {
  const { t, calls } = fakeTransport(["waiting", "generating", "success"]);
  const p = new KieProvider("k", "nano-banana-2-1", "2K", t);
  p.pollMs = 1;
  const out = await p.render({ prompt: "make it real", images: [img], aspectRatio: "16:9" });
  assert.equal(out.image.data, "QUJD");
  const job = calls.find((c) => c.url.endsWith("/jobs/createTask"))!.body as { model: string; input: Record<string, unknown> };
  assert.equal(job.model, "nano-banana-2-1");
  assert.deepEqual(job.input.image_input, ["https://tempfile.example/a.png"]);
  assert.equal(job.input.resolution, "2K");
  assert.equal(job.input.aspect_ratio, "16:9");
  assert.equal(calls.filter((c) => c.url.includes("recordInfo")).length, 3);
  assert.equal(calls.at(-1)!.url, "https://cdn.example/out.png");
});

test("kie passes each model's own field names", async () => {
  const { t, calls } = fakeTransport(["success"]);
  const p = new KieProvider("k", "seedream/5-pro-image-to-image", "1K", t);
  p.pollMs = 1;
  await p.render({ prompt: "x", images: [img], aspectRatio: "5:4" });
  const job = calls.find((c) => c.url.endsWith("/jobs/createTask"))!.body as { input: Record<string, unknown> };
  assert.deepEqual(job.input.image_urls, ["https://tempfile.example/a.png"]);
  assert.equal(job.input.quality, "basic");
  assert.equal(job.input.aspect_ratio, "4:3"); // 5:4 is not offered, nearest is 4:3
});

test("kie failures and bad keys read as plain messages", async () => {
  const { t } = fakeTransport(["fail"]);
  const p = new KieProvider("k", "gpt-image-2-image-to-image", "2K", t);
  p.pollMs = 1;
  await assert.rejects(p.render({ prompt: "x", images: [img] }), /could not make this image: bad prompt/);
  const bad: KieTransport = { json: async () => ({ status: 200, body: { code: 401, msg: "Unauthorized" } }), image: async () => img };
  await assert.rejects(new KieProvider("k", "nano-banana-2-1", "1K", bad).test(), /rejected the API key/);
  await assert.rejects(new KieProvider("", "nano-banana-2-1", "1K", bad).render({ prompt: "x", images: [img] }), /Add your Kie.ai API key/);
});

test("kie test reports the balance in credits and dollars", async () => {
  const { t } = fakeTransport([]);
  assert.match(await new KieProvider("k", "nano-banana-2-1", "1K", t).test(), /\$0\.50 left \(100 credits\)/);
});

test("kie model helpers: prices, resolutions, ratios, results", () => {
  const nb = findKieModel("nano-banana-2-1");
  assert.equal(priceText(nb, "1K"), "~$0.02");
  assert.equal(priceText(nb, "4K"), "~$0.045");
  assert.equal(priceText(findKieModel("nano-banana-pro"), "4K"), "~$0.12");
  assert.equal(priceText(findKieModel("seedream/5-flash-image-to-image"), "2K"), "price on kie.ai");
  assert.equal(resolutionFor(findKieModel("seedream/5-pro-image-to-image"), "4K"), "2K");
  assert.equal(ratioFor(nb, "21:9"), "21:9");
  assert.equal(ratioFor(findKieModel("seedream/5-pro-image-to-image"), "4:5"), "3:4");
  assert.equal(findKieModel("unknown").id, "nano-banana-2-1");
  assert.equal(resultUrl('{"resultUrls":["u"]}'), "u");
  assert.equal(resultUrl("oops"), null);
});
