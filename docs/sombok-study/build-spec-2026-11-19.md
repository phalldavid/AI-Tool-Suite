# AI Render App – Build Spec (from Sombok AI reverse-engineering)

Nov 19, 2026 · @David K.

## Summary

Sombok AI is a thin web page around one image-to-image call. The browser builds the whole prompt, a small server passes it to Kie.ai, and Seedream draws the image. Everything that feels clever is prompt text plus controls that add or remove text, so it can be rebuilt on ComfyUI. This spec comes from three paid test renders and from reading their page code; what we did not test is listed in section 11.

- **One Render = one call** with one input image (your base image) and one text prompt. There is no separate negative prompt: the "Avoid" list is a sentence inside the prompt.
- **Presets are hidden text blocks.** Sketchup to Real adds about 2,700 characters and also flips some controls (Time of Day, Interior Lights, Site Context, Render Style).
- **Analyze DNA** is a vision model that writes a material list. You edit it, then paste it into the Special Instructions box.
- **Gallery buttons** (angles, boards) are fixed prompt templates. **Custom Viewpoint** sends your own text with a short camera tag in front, and nothing else.
- **Their cost:** 15 credits per render (Seedream 5 Flash, 2K), 5 for Analyze DNA. Their provider charged 3.24 provider credits per image.

## How Sombok AI works

The browser does the work and holds the logic. Their server only passes requests to Kie.ai, which runs the model. Sign-in uses Firebase.

&#91;embedded content: request flow · 4 parts\]

Only the browser knows how the prompt is built. The server and Kie.ai receive finished text and one image.

## The Render button: what is sent

Pressing Render makes two calls to their server (Google Cloud Run, Singapore region) and then fetches the picture. The server is a pass-through to Kie.ai; it does not change the prompt. We captured this on all three paid renders.

1. **Upload.** The browser sends the base image as base64 JPEG to `/api/uploadImageViaKie` and gets back a file address on Kie's storage (about 1.4 s).
2. **Generate.** The browser sends one request to `/api/generateImageViaKie` and waits. It takes 20 to 30 seconds. There is no polling.
3. **Result.** The answer is Kie's task record. It contains the result address, and the browser downloads that JPEG.

The credits (15) are taken up front in the browser. A `/api/credits/refund` route exists, which suggests failed jobs are refunded.

| Field | Value we saw |
| --- | --- |
| modelName | kie-seedream-5-flash |
| resolution | 2K |
| prompt | the full text, sent at the top level |
| input.prompt | the same text again |
| input.image\_urls | exactly one address: the base image |
| input.aspect\_ratio | always "1:1", even when the screen says Auto |
| input.size | 2K |
| input.output\_format | jpeg |
| input.nsfw\_checker | false |

Other routes in their code: `/api/generateImageViaGpt`, `/api/generateImageViaFal`, `/api/generateContentViaApiyi`. Sign-in is Firebase.

### How the prompt is assembled

The main Render button builds the prompt in the browser. It pushes parts into a list and joins them with spaces: atmosphere, lighting direction, weather, lights, location, "Setting: ...", "Site Context: ...", added objects, then "User Request Modifiers: \<Special Instructions>" and character text. The "Avoid" list sits inside the same string. A part is simply left out when its control is empty.

## Sketchup to Real: the prompt, block by block

With the Sketchup to Real preset the first render sent a 4,541-character prompt. These are its blocks in order, described in our own words (we did not save their text word for word).

| # | Block | What it tells the model |
| --- | --- | --- |
| 1 | Opening sentence | Turn this SketchUp view into a DSLR photo. Keep the geometry and textures. |
| 2 | Camera lock | Same camera position, angle and framing as the input. |
| 3 | Geometry lock | Do not move, add or remove any building element. |
| 4 | Material lock | Keep each material one-to-one with the input, in the same place. |
| 5 | Boundary-locked realism | Add realism inside the existing shapes only, not outside them. |
| 6 | Hardscape analysis | Read paving and ground surfaces and make them realistic. |
| 7 | Garden look | Plants, lawn and soil (useless for an interior, but it is still sent). |
| 8 | Pro-photo look | Lens, exposure and colour like a professional photograph. |
| 9 | "Time: Dawn." | Comes from the Time of Day control. |
| 10 | Lighting block | Neutral-warm 4200 K LED, CRI 90+, glass with real reflections, glass not flat or invisible. |
| 11 | "Setting: Borey Gated Community." | Comes from the Location setting. |
| 12 | "User Request Modifiers:" | Your Special Instructions, including the DNA block. |
| 13 | "Avoid:" list | The negative prompt, written as a sentence at the end. |

### With no preset

Test A used preset None and the prompt shrank to 1,814 characters. It kept only the opening sentence, "Time: Dawn.", the User Request Modifiers (with the DNA block) and the Avoid list. So the preset is about 2,700 characters of hidden text (blocks 2 to 8, 10 and 11).

One point for our own build: blocks 6 and 7 are sent for interiors too. We should drop them there.

## Which controls change the prompt

Choosing a preset does two things: it adds hidden text, and it moves other controls for you. Choosing "None" resets those controls but keeps whatever you typed in Special Instructions.

| Control | What it does to the request |
| --- | --- |
| Preset (Sketchup to Real) | Adds the hidden blocks from section 4. Also sets Time of Day = Dawn, Interior Lights = Warm, Site Context = 1 item, Render Style = Exterior. |
| Preset type (Sketchup / Realistic) | Switches between two hidden texts: `sketchup_to_real` and `realistic_material_refinement`. Realistic sets Time of Day to "Day". |
| Time of Day | One short sentence, e.g. "Time: Dawn." The sun dial has no Dawn button; Dawn is the far-left end of the arc. |
| Interior Lights | Part of the lighting block. Warm was set by the preset. |
| Site Context | A "Site Context: ..." sentence. Reset by preset None. |
| Location / Setting | A "Setting: ..." sentence, e.g. Borey Gated Community. |
| Special Instructions | Appended as "User Request Modifiers: ...". This is the only free-text channel on the main Render button. |
| Render Style (Interior) | Added no visible text in test A. Unknown what it changes. It resets to Exterior when a preset changes, so re-select Interior. |
| Model | Sets modelName in the request. |
| Resolution | Sets resolution and size (we only tested 2K). |
| Aspect ratio | Not sent. The request always says 1:1. |
| Number of images | Not tested. |

Other presets exist (interior real estate, interior photography, mountain, coastal, lake, town house, master plan, floorplan to 3D and more). Several have a TYPE dropdown like Sketchup to Real. We did not capture those.

## Analyze DNA and the Material Library

**Analyze DNA costs 5 credits.** A vision model looks at the base image and returns a plain-text list. The format is the part worth copying:

```
--- ARCHITECTURAL DNA ---
TAG: <places, comma separated>: <material, finish>
TAG: ...
TAG: Environment: <one-line description of the space>
TAG: Camera: <view and lens type>
```

For our bathroom test it returned 14 lines, for example `TAG: Vanity Cabinetry: Dark Walnut Wood Veneer, Satin Finish` and `TAG: Shower Enclosure: Clear Transparent Glass`. Each line names where a material is and what it is.

**The Material DNA Editor** shows this list as rows you can edit.

- **Visual Editor / Raw DNA tabs.** Raw DNA keeps the original extraction, even after you change rows.
- **Find & Replace.** Free and local. It only rewrites text in the rows.
- **Group by Zone / Group by Material Type, Collapse / Expand All, Split.** Display tools only.
- **Material Library ("Sombok Material").** Fixed swatch pictures on their site, in categories. **Apply Material** is free and replaces the row's material text with the swatch's name tags. The swatch picture itself is never sent. Only the base image goes to the model.
- **Apply to Instructions.** Appends a block headed "Modify the image based on following Json Data" to the Special Instructions box. That is how DNA reaches the prompt: as ordinary text under "User Request Modifiers".

**What this means for our build.** DNA is not a separate input to the image model. It is a text list that the user can edit and that gets pasted into the prompt. Swatches work only as words. If we want real swatch images to guide the render, that is something we would add, and it is not in Sombok.

### Reference screenshots: Material DNA Editor

The four screens below are the editor on our bathroom test, from top to bottom of the list. The fourth shows the Sombok Material panel open beside it.

&#91;image: Visual Editor, Stone, Marble & Tile and Panels, Lacquer & Paint groups\]

&#91;image: Visual Editor, Wood & Timber and Metals & Alloys groups\]

&#91;image: Visual Editor, Fabric & Textiles, Glass & Mirror and Scene & Lighting Context groups\]

&#91;image: Sombok Material panel open beside the editor, Glossy Gold selected, Apply Material button\]

## Perspective Gallery, Multi-Angles, Custom Viewpoint and the boards

The Perspective Gallery appears after a render. Its source is the selected version in the history ("Active Workspace: Version N"). Each button is a data entry in their code: an id, a category, a prompt text, a label and an icon. Gallery buttons use a **separate, simpler prompt builder** from the main Render button.

| Button type | What is sent (from their code, plus one capture) |
| --- | --- |
| Normal gallery entry (Architecture, Interior, etc.) | "NEURAL PERSPECTIVE SHIFT: \<entry text>." then a fixed closing sentence: keep the structure and materials from the render history, "professional 8k photography", then optional character text. |
| Entries whose id starts with cons\_, masterplan\_, storyboard\_ or ren\_ | The entry text alone, without the wrapper or the closing sentence. |
| Custom Viewpoint (free text) | "\[CAMERA SHIFT ENABLED: Re-orient the camera to the requested angle while preserving building DNA\]" + your text + a full stop. **Captured.** Nothing else was added. |
| Multi-Angles | Rotate, Tilt and Scale sliders turn into View / Angle / Frame words (below). Not rendered by us. |

Special Instructions, the DNA block, Time of Day, lights and the Avoid list are **not** part of any gallery prompt. We confirmed that for Custom Viewpoint by capture.

### Multi-Angles

A Subject | Camera toggle, Rotate (-180 to 180), Tilt (-60 to 60) and Scale (60 to 140 %). The "Live Prompt Override" shows the words each setting becomes:

- **View:** Front view; Right or Left 3/4 perspective (at 45); profile (at 90); Rear 3/4 (at 135); Rear (at 180).
- **Angle:** Eye-level; High angle (bird's eye); Low angle (worm's eye).
- **Frame:** Ultra wide (60); Wide perspective (80); Default view (100); Medium framing (120); Close-up framing (140).

There is also a Geometry Guide drop zone (a SketchUp snapshot) and a "Lock Landscape & Trees" switch, on by default. From their code, extra images are uploaded as labelled references ("Image N is the structural reference, use this for strict geometry" and "Image M is the SOURCE image"). That means a gallery call can carry more than one image. We did not render it.

### Product Presentation Board (Interior tab)

Their stock board is for **one piece of furniture**: a single sheet with orthographic views (top, side, front) on the left and a material swatch grid on the right. It forbids arrows and guide lines, forbids invented materials, and asks for geometry to stay locked. It is not dimensionally accurate. We did not render the stock button.

### Our own board prompt through Custom Viewpoint (tested, 15 credits)

We wrote our own board prompt and sent it through Custom Viewpoint. This is the exact text we typed:

```
Based on the uploaded image, create ONE presentation board of the bathroom vanity area, on a single landscape 3:2 sheet with a clean off-white background and soft even studio lighting.

LEFT SIDE, "VANITY VIEWS": three clean views of the vanity unit exactly as it appears in the uploaded image, with the mirror and the wall niches next to it. Show a front view, a side view and a top view, drawn flat with no perspective. Keep the shape, proportions, cabinet layout, countertop, basin, tap position and niche positions exactly as in the image.

RIGHT SIDE, "MATERIAL PALETTE": a tidy grid of square swatches, one for each material visible on the vanity and the wall around it (for example the vanity cabinet wood, the countertop stone, the wall tile, the floor tile, the metal on the taps and mirror frame). Write a short English name under each swatch.

CALLOUTS: number the items 1, 2, 3 and so on in small circles placed right next to the part they describe. Under the board, add one short caption line for each number: 1 Vanity cabinet, 2 Countertop, 3 Wall niche, 4 Mirror, 5 Tap. Do not draw arrows or leader lines.

RULES: Do not redesign anything. Do not invent materials or objects that are not in the image. Keep the board uncluttered, with sharp, readable text and no logos or watermarks.
```

**Result:** a usable board. It had the heading "VANITY VIEWS" with front, side and top views, a "MATERIAL PALETTE" with 8 named swatches, numbered circles on the image and the caption row printed as written. Flaws:

- The top view is not a true plan.
- Some numbers repeat near the basin and the circles are tiny.
- One swatch label was wrong (the gold swatch was labelled "Floor Tile").
- The vanity was slightly redrawn.
- The 3:2 request was ignored, because the request always says 1:1.

## Credits and costs

Prices are in Sombok credits. The only dollar-like figure we have is the provider's own charge: 3.24 Kie provider credits per 2K Seedream 5 Flash image. We could not convert either number to USD.

| Action | Sombok credits |
| --- | --- |
| Render, Seedream 5 Flash, 2K | 15 |
| Analyze DNA | 5 |
| Apply Material, Find & Replace, grouping, Apply to Instructions | 0 |
| Gallery: Architecture, Interior, Multi-Angles, Custom Viewpoint, Matched-Int | 15 |
| Gallery: Story Board, Lifestyle, Cinematic, Studio, Blueprint, Construction | 30 |

The 15-credit prices for Render and Custom Viewpoint were confirmed on the button and by the balance dropping from 80 to 65. The 30-credit tabs and Matched-Int are read from the labels on the tabs; we did not spend on them.

The credits are checked and taken by the browser before the request. Anything that fails is meant to go through the refund route.

## Build spec for our ComfyUI app

The rule for the whole app: **the prompt is built from small text blocks that the user can see and edit before sending.** Sombok hides this. We show it.

### Modules

| Module | Job | Sombok equivalent |
| --- | --- | --- |
| Prompt builder | Joins enabled blocks into one string and shows the final text | The browser array joined with spaces |
| Block library | Stores presets as data files (JSON), not code | Hidden preset text |
| Controls | Time of Day, Lights, Setting, Site Context, Special Instructions. Each one turns a block on or off | The right-hand panel |
| Render job | Sends base image + final prompt to ComfyUI and returns the picture | generateImageViaKie |
| DNA reader | Sends the base image to a vision model and returns TAG lines | Analyze DNA |
| DNA editor | Edits TAG lines, applies a library swatch as words, pastes the result into the prompt | Material DNA Editor |
| Template runner | Fixed templates (angles, boards) with named blanks the user fills | Perspective Gallery |
| Free-text run | Sends the user's own text with a short camera tag in front | Custom Viewpoint |
| History | Stores each result with its exact final prompt and settings | Rendering History |

### Preset file (example shape)

```json
{
  "id": "sketchup_to_real",
  "label": "Sketchup to Real",
  "blocks": [
    { "id": "opening", "text": "...", "when": "always" },
    { "id": "camera_lock", "text": "...", "when": "always" },
    { "id": "garden", "text": "...", "when": "render_style == exterior" },
    { "id": "avoid", "text": "...", "when": "always" }
  ],
  "sets": { "time_of_day": "dawn", "interior_lights": "warm" }
}
```

### Render job

1. User picks the base image, a preset and the controls.
2. The builder joins the enabled blocks in a fixed order: opening, locks, look, time, lighting, setting, user text, avoid.
3. The app shows the final text. The user can edit it, then presses Render.
4. The app sends image + text + size + seed to ComfyUI and waits for the result.
5. The result is saved with the exact prompt and seed.

### DNA format

Keep Sombok's line format. It is easy for a vision model to produce and easy to parse: one `TAG:` per line, then `Environment` and `Camera` lines last. Parse each line into zone names and a material text so the editor can group them.

### Template runner and free-text run

- A template is one text with named blanks, for example the vanity board with {subject}, {views}, {callouts}. The user fills the blanks, and the app shows the final text.
- Free-text run: put a short camera line in front only when the user wants a new angle. For boards and infographics send the user's text alone, because the camera line asks the model to move the camera.

## Where we can do better than Sombok

Each point comes from something we saw in the captures.

| Sombok's weakness | What we saw | Our fix |
| --- | --- | --- |
| Aspect ratio is always 1:1 | "Auto" on screen, 1:1 in the request; our 3:2 board came back square | Send the real ratio of the base image or the user's choice |
| The prompt is hidden | The user cannot see or edit the 4,541 characters | Show the final text and let the user edit it |
| Interior renders get garden text | The garden block is sent for a bathroom | Blocks switch on by Render Style |
| Geometry is held by words only | Only one image goes in, and the prompt says "do not move anything" | Add depth or line control in ComfyUI so shapes stay fixed |
| No negative prompt field | The Avoid list is one sentence at the end of the prompt | Use a real negative prompt input |
| No seed or variation control | Not visible in the request | Save and expose the seed |
| Special Instructions and DNA do not reach gallery buttons | Custom Viewpoint sent only our text | Let every template take the same user text and DNA blocks |
| Controls reset when a preset changes | Render Style jumped back to Exterior | Presets set only what they declare, and never reset the rest |
| Boards come back with small errors | Wrong swatch label, repeated numbers, a perspective "top view" | Draw the label text and numbers ourselves on top of the image instead of asking the model to draw them |
| One long wait with no progress | 20 to 30 seconds, one request | Show progress from the ComfyUI queue |

## Not verified and open questions

- **Prompts are paraphrased.** We stored outlines of Sombok's prompts, not their exact words. Our own board prompt is exact.
- **Only three renders were captured**, all on Seedream 5 Flash at 2K: two Sketchup to Real tests (with and without the preset) and one Custom Viewpoint board. Other models, resolutions and presets are unknown.
- **Render Style = Interior** added no visible text in test A. We do not know whether it changes anything else.
- **Normal gallery buttons** (Architecture, Interior and so on): the missing Special Instructions is read from their code. We confirmed it by capture only for Custom Viewpoint.
- **Multi-Angles with a Geometry Guide** was not rendered. Whether the guide image goes out as a second image comes from code, not from a capture.
- **The stock Product Presentation Board** was not rendered, so we have not seen its output or the exact request.
- **Block 11 ("Setting")** disappeared with preset None, but we did not test whether it comes from the preset text or from the Location control.
- **Number of images** above 1 was not tested.
- **Credits in USD:** unknown. Only Sombok credits and the provider's 3.24 are known.
- **Which local model replaces Seedream** is not decided here. Prompts written for Seedream may need changes on another model.

## Build order

Each phase gives something you can use before the next one starts.

1. **Phase 1: one render with a visible prompt.** Upload a base image, pick a Sketchup to Real style preset, set Time of Day and Special Instructions, see the final text, render on ComfyUI. Done when a SketchUp view becomes a photo with the same camera and geometry.
2. **Phase 2: presets as data and history.** Move all blocks into JSON files. Save every result with its prompt and seed. Add Interior and Exterior block switching.
3. **Phase 3: DNA.** Vision model reads the base image into TAG lines. Editor with Find & Replace, grouping and Apply to Instructions.
4. **Phase 4: templates and free text.** Angle templates, the Custom Viewpoint-style free text run, and the vanity board template with fill-in blanks.
5. **Phase 5: geometry and board quality.** Add depth or line control. Draw board labels and numbers ourselves over the image.
6. **Phase 6: material library.** Swatch pictures that can go to the model as images, not only as words.
