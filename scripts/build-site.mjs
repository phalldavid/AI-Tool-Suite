// Builds the whole site for GitHub Pages:
//   /            David Render Studio v2 (app/)
//   /v1/         the old app (web/), kept as a backup
//   /next/       forwards old beta links to /
//   /previews/   card pictures, shared by v2 (v1 keeps its own copy under /v1/)
// Run after `npm run rbz` (which builds v1 into dist/web for the SketchUp package).
import { cpSync, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const run = (args, env = {}) => execFileSync(process.execPath, args, { stdio: "inherit", env: { ...process.env, ...env } });

// 1. v1 into dist/web (or reuse it: `npm run rbz` has just built it), then set aside as the backup.
if (!(process.argv.includes("--reuse-v1") && existsSync("dist/web/index.html"))) run(["scripts/build.mjs"]);
rmSync("dist/v1-site", { recursive: true, force: true });
renameSync("dist/web", "dist/v1-site");

// 2. v2 at the root.
run(["scripts/build-app.mjs"], { DRS_BASE: "" });
cpSync("web/public/previews", "dist/web/previews", { recursive: true });

// 3. v1 under /v1/.
renameSync("dist/v1-site", "dist/web/v1");

// 4. Old beta links keep working.
mkdirSync("dist/web/next", { recursive: true });
writeFileSync(
  "dist/web/next/index.html",
  `<!doctype html><meta charset="utf-8"><title>David Render Studio</title><meta http-equiv="refresh" content="0; url=../"><link rel="canonical" href="../"><p>David Render Studio has moved to <a href="../">the main page</a>.</p>`,
);
if (!existsSync("dist/web/index.html") || !existsSync("dist/web/v1/index.html")) throw new Error("Site build is missing a page");
console.log("Site: v2 at /, v1 backup at /v1/, /next/ forwards to /");
