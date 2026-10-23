# AI Tool Suite Plugin for SketchUp

AI renders straight from the SketchUp view, using **your own Gemini API key** or **ComfyUI on your own PC**. No credits, no account with us, no server in between. The same interface also runs as a web app for photos, CAD exports and iPad sketches.

Plan and roadmap: see the project plan doc (architecture, tools, phases).

## What's in Phase 1

| Tool | What it does |
| --- | --- |
| Render | Turns the view into a photoreal exterior, interior, aerial or sketch-based image. Sends a hidden-line pass too, so massing, openings and roof lines stay put. |
| Lighting | Re-lights a render: Phnom Penh morning (07:00 east sun), midday, late afternoon (16:30 west sun), blue hour, overcast monsoon, night, interior day and evening. |
| Spot edit | Paint over part of a render and describe the change. Only the painted area is replaced; everything else stays pixel-exact. |
| Presets | 10 built-in presets (borey villa, shophouse row, New Khmer civic, condo tower, resort pavilion, masterplan aerial, living room, condo lobby, cafe, iPad sketch). Save your own and share them as a JSON file. |
| History | Every result with a before and after slider and the exact prompt used. Kept on your computer only. |

The prompt is built from the preset (project type, lighting, environment, materials), your notes, and facts read from SketchUp: lens (35 mm equivalent from the camera's field of view), scene name and shadow time.

## Install the SketchUp plugin

1. Download `ai_render_suite.rbz` from the latest CI run (Actions tab, artifact `ai_render_suite-rbz`), or build it yourself (below).
2. In SketchUp 2021 or newer: **Extensions > Extension Manager > Install Extension**, pick the .rbz.
3. If SketchUp refuses it as unsigned, open **Extension Manager > settings (gear)** and set the loading policy to allow unsigned extensions, then install again.
4. Open **Extensions > AI Render Suite > Open panel**, go to **Settings**, paste your Gemini key and press **Test key and load models**.

Renders are saved into an `AI Renders` folder next to the .skp file.

## Get a Gemini API key

Create one at [Google AI Studio](https://aistudio.google.com/apikey). A Gemini app subscription does not include API access; image generation is billed to the key's Google account. The key is stored on your computer in plain text (browser storage for the web app, `%APPDATA%\AIRenderSuite\settings.json` for the plugin), so don't save it on a shared office PC.

## ComfyUI (experimental)

1. Start ComfyUI with `--enable-cors-header`.
2. Build a workflow. Put `{{PROMPT}}` in the positive prompt text, `{{IMAGE_1}}` as the Load Image file name for the view, and `{{IMAGE_2}}` for the line pass (for example into a lineart ControlNet).
3. **Export (API)** and paste the JSON into Settings > ComfyUI.

## Develop

Requires Node 22.

```sh
npm install
npm run dev        # web app at http://localhost:5173 (browser mode, upload images)
npm test           # prompt, preset and backend logic tests
npm run typecheck
npm run rbz        # builds dist/ai_render_suite.rbz
```

Layout:

- `web/src` shared interface in TypeScript, bundled into one plain script so it loads from `file://` inside SketchUp
  - `host.ts` the only place that differs between SketchUp and the browser
  - `prompt.ts` prompt templates, lighting and environment options
  - `presets.ts` built-in presets
  - `providers/` Gemini and ComfyUI backends behind one interface
- `plugin/` SketchUp extension in Ruby
  - `capture.rb` exports the view, the hidden-line pass and camera facts
  - `bridge.rb` answers requests from the panel (capture, save, settings)

The web app deploys to GitHub Pages from `main` once Pages is set to **GitHub Actions** in the repo settings.
