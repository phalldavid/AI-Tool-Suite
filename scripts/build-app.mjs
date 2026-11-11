// Builds David Render Studio v2 (app/) into dist/web/next/, next to v1.
// v1 (web/) is built by build.mjs and stays at the site root until the swap.
// Run after build.mjs: that script clears dist/web first.
import * as esbuild from "esbuild";
import { cpSync, mkdirSync, rmSync } from "node:fs";

const serve = process.argv.includes("--serve");
// Where the app is served from, relative to the site root. "next" during the beta.
const base = process.env.DRS_BASE ?? "next";
const outdir = base ? `dist/web/${base}` : "dist/web";
// Template previews live once, in v1's folder at the site root.
const previewBase = base ? "../previews/" : "previews/";

rmSync(outdir, { recursive: true, force: true });
mkdirSync(outdir, { recursive: true });
cpSync("app/public", outdir, { recursive: true });

const options = {
  entryPoints: ["app/src/main.tsx"],
  bundle: true,
  format: "iife",
  target: ["chrome90", "safari15"],
  outfile: `${outdir}/app.js`,
  jsx: "automatic",
  define: {
    __PREVIEW_BASE__: JSON.stringify(previewBase),
    "process.env.NODE_ENV": JSON.stringify(serve ? "development" : "production"),
  },
  sourcemap: serve,
  minify: !serve,
  logLevel: "info",
};

if (serve) {
  cpSync("web/public/previews", "dist/web/previews", { recursive: true });
  const ctx = await esbuild.context(options);
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: "dist/web", port: 5174 });
  console.log(`Open http://localhost:${port}/${base}/`);
} else {
  await esbuild.build(options);
  console.log(`Built v2 into ${outdir}`);
}
