// Phone layout check: run against a local build (python3 -m http.server 8765 in dist/web).
// Checks the tour panel buttons are on screen, the title fits on one line, nothing overflows
// sideways, and the bottom button stays visible at the top and bottom of the page.
// Usage: node scripts/qa-phone.mjs   (needs Playwright installed)
import { chromium, devices } from "playwright";
const b = await chromium.launch(); const log = [];
const S = (p, n) => p.screenshot({ path: `qa-shots/${n}.png` });
for (const [name, vp] of [["i", { width: 390, height: 664 }], ["s", { width: 360, height: 640 }]]) {
  const ctx = await b.newContext({ ...devices["iPhone 13"], viewport: vp });
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://localhost:8765/"); await p.waitForTimeout(1200);
  await p.click('.langcard:has-text("English")'); await p.waitForTimeout(500);
  for (let i = 1; i <= 9; i++) {
    const info = await p.evaluate(() => { const c = document.querySelector(".tour-card"); if (!c) return null; const r = c.getBoundingClientRect(); const bt = [...c.querySelectorAll(".tour-foot button")].map((x) => { const q = x.getBoundingClientRect(); return q.left >= 0 && q.right <= innerWidth && q.bottom <= innerHeight; }); return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom), ok: bt.every(Boolean) }; });
    log.push(`${name} tour ${i} ${JSON.stringify(info)}`);
    if (i === 1 || i === 4) await S(p, `${name}-t${i}`);
    const nx = p.locator('.tour-foot .btn.primary'); if (!(await nx.count())) { const ch = p.locator(".tour-choice .btn.primary").first(); if (await ch.count()) { await ch.click(); await p.waitForTimeout(400); continue; } break; }
    await nx.click(); await p.waitForTimeout(450);
  }
  await p.evaluate(() => { localStorage.setItem("drs2.tour", "done"); localStorage.setItem("drs2.dev", "1"); localStorage.setItem("drs2.settings", JSON.stringify({ testMode: true, onboarded: true, backend: "kie", kieKey: "" })); });
  await p.reload(); await p.waitForTimeout(1000); await S(p, `${name}-a-empty`);
  const hdr = await p.evaluate(() => { const t = document.querySelector(".m-title"); const r = t.getBoundingClientRect(); return { h: Math.round(r.height), w: Math.round(r.width), sw: t.scrollWidth, cw: t.clientWidth }; });
  log.push(`${name} title ${JSON.stringify(hdr)} overflowX ${await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)}`);
  await p.setInputFiles('input[type=file] >> nth=0', "app/test/fixtures/portrait.png"); await p.waitForTimeout(800);
  await p.evaluate(() => scrollTo(0, 0)); await S(p, `${name}-b-top`);
  const ctaVis = async () => p.evaluate(() => { const c = document.querySelector(".phonebar .cta"); if (!c) return "none"; const r = c.getBoundingClientRect(); return r.bottom <= innerHeight && r.top >= 0; });
  log.push(`${name} cta visible top ${await ctaVis()}`);
  await p.evaluate(() => scrollTo(0, 99999)); await p.waitForTimeout(200); log.push(`${name} cta visible bottom ${await ctaVis()}`); await S(p, `${name}-c-bottom`);
  // settings
  await p.click(".m-ic.gear"); await p.waitForTimeout(800); await S(p, `${name}-d-settings`);
  await p.click('.set-tabs button:has-text("Customize")'); await p.waitForTimeout(400); await S(p, `${name}-e-custom`);
  await p.keyboard.press("Escape"); await p.waitForTimeout(400);
  // render
  await p.evaluate(() => scrollTo(0, 0));
  await p.click(".phonebar .cta"); await p.waitForTimeout(700);
  await S(p, `${name}-f-review`);
  await p.click('dialog[open] .btn.primary'); await p.waitForTimeout(2500); await S(p, `${name}-g-busy`);
  await p.waitForTimeout(13000); await S(p, `${name}-h-edit`);
  for (const t of ["Spot edit", "Relight", "Style copy"]) { await p.click(`.m-dock button[aria-label="${t}"]`); await p.waitForTimeout(600); await S(p, `${name}-i-${t.replace(/\W/g, "")}`); }
  log.push(`${name} errors ${errs.join(" | ")}`);
  await ctx.close();
}
console.log(log.join("\n")); await b.close();
