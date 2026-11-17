#!/usr/bin/env node
// MCP server and command line for the prompt builder, so an AI assistant (or
// a script) can pick presets and build prompts without clicking the panel.
// No dependencies. Build the API first:  npm run build:mcp
//
//   MCP over stdio:   node scripts/mcp-server.mjs
//   Command line:     node scripts/mcp-server.mjs --cli list "bathroom khmer"
//                     node scripts/mcp-server.mjs --cli build --preset int-bathroom-khmer --view vanity
//                     node scripts/mcp-server.mjs --cli batch --folder <dir> --preset "bathroom stone" [--force]
//
// Batch writes one .txt per image (and prompts.json) next to the images. It
// never overwrites an existing file unless you pass --force.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const here = fileURLToPath(new URL(".", import.meta.url));
const apiPath = process.env.AI_TOOL_SUITE_API ? resolve(process.env.AI_TOOL_SUITE_API) : resolve(here, "../dist/mcp/agent-api.mjs");

if (!existsSync(apiPath)) {
  console.error(`Missing ${apiPath}. Run "npm run build:mcp" first.`);
  process.exit(1);
}
const api = await import(pathToFileURL(apiPath).href);

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);

// ---------- Tools ----------

const SETTINGS_PROPS = {
  lighting: { type: "string", description: 'Lighting id from get_options, or "time:HH:MM".' },
  environment: { type: "string", description: "Comma-separated surroundings ids from get_options." },
  notes: { type: "string", description: "Your own words. They win over the preset when they disagree." },
  styleExtra: { type: "string", description: "Extra materials or details added to the preset's style." },
  view: { type: "string", description: "Framing: wide, entry, corridor, detail, vanity, shower, tub, street, aerial-high." },
  focalLengthMm: { type: "number", description: "35 mm-equivalent lens override." },
  fixtures: {
    type: "object",
    description: "Interior lights on: led, strip, cabinet (booleans) and kelvin (2700 to 6500).",
    properties: { led: { type: "boolean" }, strip: { type: "boolean" }, cabinet: { type: "boolean" }, kelvin: { type: "number" } },
  },
  look: { type: "string", enum: ["photo", "cgi"] },
  avoid: { type: "string", description: "Things to avoid, comma separated." },
};

const TOOLS = [
  {
    name: "list_presets",
    description: "Search the render preset library by words (every word must match). Returns id, name, scene type, lighting and surroundings.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: 'For example "bathroom khmer".' },
        scene: { type: "string", enum: ["exterior", "interior", "aerial", "sketch"] },
        limit: { type: "number", description: "Default 25, at most 200." },
      },
    },
    run: (a) => api.listPresets(a),
  },
  {
    name: "get_options",
    description: "List the lighting ids, surroundings ids, view framings, fixture settings and preset count.",
    inputSchema: { type: "object", properties: {} },
    run: () => api.listOptions(),
  },
  {
    name: "build_prompt",
    description: "Build the render prompt for one view from a preset plus optional overrides. Same builder as the panel's Prompt Copy.",
    inputSchema: {
      type: "object",
      properties: { preset: { type: "string", description: "Preset id, exact name, or search words." }, ...SETTINGS_PROPS },
      required: ["preset"],
    },
    run: (a) => api.buildPrompt(a),
  },
  {
    name: "build_batch",
    description: "Build one prompt per image. The view (wide, vanity, shower...) is guessed from each file name unless you set it.",
    inputSchema: {
      type: "object",
      properties: {
        preset: { type: "string" },
        ...SETTINGS_PROPS,
        images: { type: "array", items: { type: "string" }, description: "Image file names." },
      },
      required: ["preset", "images"],
    },
    run: (a) => {
      const { images, ...common } = a;
      return api.buildBatch(common, images.map((image) => ({ image })));
    },
  },
];

function callTool(name, args) {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) return { content: [{ type: "text", text: `Unknown tool ${name}` }], isError: true };
  try {
    const out = tool.run(args ?? {});
    const isError = out && out.ok === false;
    return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }], isError: Boolean(isError) };
  } catch (e) {
    return { content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
  }
}

// ---------- MCP over stdio (newline-delimited JSON-RPC) ----------

function serveMcp() {
  const send = (msg) => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", ...msg }) + "\n");
  const rl = createInterface({ input: process.stdin });
  rl.on("line", (line) => {
    if (!line.trim()) return;
    let req;
    try {
      req = JSON.parse(line);
    } catch {
      send({ id: null, error: { code: -32700, message: "Parse error" } });
      return;
    }
    const { id, method, params } = req;
    if (id === undefined) return; // notifications need no reply
    switch (method) {
      case "initialize":
        send({
          id,
          result: {
            protocolVersion: params?.protocolVersion ?? "2024-11-05",
            capabilities: { tools: {} },
            serverInfo: { name: "ai-tool-suite", version: "1.0.0" },
          },
        });
        break;
      case "ping":
        send({ id, result: {} });
        break;
      case "tools/list":
        send({ id, result: { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) } });
        break;
      case "tools/call":
        send({ id, result: callTool(params?.name, params?.arguments) });
        break;
      default:
        send({ id, error: { code: -32601, message: `Method not found: ${method}` } });
    }
  });
}

// ---------- Command line ----------

function parseFlags(argv) {
  const flags = {};
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) flags[key] = true;
      else {
        flags[key] = next;
        i++;
      }
    } else rest.push(a);
  }
  return { flags, rest };
}

function settingsFromFlags(flags) {
  const s = {};
  for (const k of ["lighting", "environment", "notes", "styleExtra", "view", "look", "avoid"]) if (typeof flags[k] === "string") s[k] = flags[k];
  if (typeof flags.focalLengthMm === "string") s.focalLengthMm = Number(flags.focalLengthMm);
  const fx = {};
  if (flags.led) fx.led = true;
  if (flags.strip) fx.strip = true;
  if (flags.cabinet) fx.cabinet = true;
  if (typeof flags.kelvin === "string") fx.kelvin = Number(flags.kelvin);
  if (Object.keys(fx).length) s.fixtures = fx;
  return s;
}

function runCli(argv) {
  const [cmd, ...more] = argv;
  const { flags, rest } = parseFlags(more);
  if (cmd === "list") {
    const out = api.listPresets({ query: rest.join(" "), scene: typeof flags.scene === "string" ? flags.scene : undefined, limit: Number(flags.limit) || 25 });
    console.log(`${out.total} match(es)`);
    for (const p of out.items) console.log(`${p.id}\t${p.name}\t${p.scene}`);
    return 0;
  }
  if (cmd === "options") {
    console.log(JSON.stringify(api.listOptions(), null, 2));
    return 0;
  }
  if (cmd === "build") {
    if (typeof flags.preset !== "string") return fail("build needs --preset");
    const r = api.buildPrompt({ preset: flags.preset, ...settingsFromFlags(flags) });
    if (!r.ok) return fail(r.error);
    console.log(r.prompt);
    return 0;
  }
  if (cmd === "batch") {
    if (typeof flags.folder !== "string" || typeof flags.preset !== "string") return fail("batch needs --folder and --preset");
    const folder = resolve(flags.folder);
    const images = readdirSync(folder).filter((f) => IMAGE_EXT.has(extname(f).toLowerCase())).sort();
    if (!images.length) return fail(`No images in ${folder}`);
    const results = api.buildBatch({ preset: flags.preset, ...settingsFromFlags(flags) }, images.map((image) => ({ image })));
    const outDir = typeof flags.out === "string" ? resolve(flags.out) : folder;
    let wrote = 0;
    const skipped = [];
    for (const r of results) {
      if (!r.result.ok) {
        console.error(`${r.image}: ${r.result.error}`);
        continue;
      }
      const target = join(outDir, `${basename(r.image, extname(r.image))}.txt`);
      if (existsSync(target) && !flags.force) {
        skipped.push(target);
        continue;
      }
      writeFileSync(target, r.result.prompt + "\n", "utf8");
      wrote++;
    }
    const jsonTarget = join(outDir, "prompts.json");
    if (!existsSync(jsonTarget) || flags.force) {
      writeFileSync(jsonTarget, JSON.stringify(results, null, 2) + "\n", "utf8");
    } else skipped.push(jsonTarget);
    console.log(`Wrote ${wrote} prompt file(s) to ${outDir}.`);
    if (skipped.length) console.log(`Skipped ${skipped.length} existing file(s); use --force to overwrite.`);
    return 0;
  }
  return fail('Usage: --cli list|options|build|batch ...  (see the header of this file)');
}

function fail(msg) {
  console.error(msg);
  return 1;
}

const argv = process.argv.slice(2);
if (argv[0] === "--cli") process.exit(runCli(argv.slice(1)));
else serveMcp();
