// Bundles the interface into one plain script (no ES modules), so it loads
// from file:// inside SketchUp's HtmlDialog as well as from a web server.
import * as esbuild from "esbuild";
import { cpSync, mkdirSync, rmSync } from "node:fs";

const serve = process.argv.includes("--serve");
const outdir = "dist/web";
const pluginUi = "plugin/ai_render_suite/ui";

rmSync(outdir, { recursive: true, force: true });
mkdirSync(outdir, { recursive: true });
cpSync("web/public", outdir, { recursive: true });

const options = {
  entryPoints: ["web/src/main.ts"],
  bundle: true,
  format: "iife",
  target: ["chrome64", "safari13"],
  outfile: `${outdir}/app.js`,
  sourcemap: serve,
  minify: !serve,
  logLevel: "info",
};

if (serve) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: outdir, port: 5173 });
  console.log(`Open http://localhost:${port}`);
} else {
  await esbuild.build(options);
  rmSync(pluginUi, { recursive: true, force: true });
  cpSync(outdir, pluginUi, { recursive: true });
  console.log(`Copied the interface into ${pluginUi}`);
}
