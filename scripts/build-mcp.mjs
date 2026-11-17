// Bundles the prompt API for the MCP server and command line:
//   npm run build:mcp   ->   dist/mcp/agent-api.mjs
// Separate from the app build, so it cannot affect the panel or the plugin.
import * as esbuild from "esbuild";
import { mkdirSync } from "node:fs";

mkdirSync("dist/mcp", { recursive: true });
await esbuild.build({
  entryPoints: ["app/src/core/agent-api.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  target: ["node18"],
  outfile: "dist/mcp/agent-api.mjs",
  logLevel: "info",
});
