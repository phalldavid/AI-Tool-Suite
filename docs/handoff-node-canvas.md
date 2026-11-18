# Handoff: Advanced tab, a node canvas (David Render Studio v2)

Paste this whole file into a new session. It holds the plan and the guardrails agreed so far
for a new **Advanced** tab: a node-based canvas, in the style of ComfyUI, Blender and 3ds Max,
where many images are worked on at once.

**Nothing is built yet.** This is a plan. Read "Rules before any code" first.


## The idea

A full-screen canvas of nodes joined by wires. A wire carries **settings**, not pixels.
One Look node wired to ten Image nodes gives ten renders in the same style. This is the
bathroom batch (10 SketchUp screenshots, one look) drawn as a picture.

What it gives that the tabs do not:

- one style applied to a group of screenshots;
- one image fanned out to several Look nodes, with the results side by side;
- chains (Render, then Spot edit, then Relight, then Multi-View) with every step visible;
- saved graphs, reused as templates on the next project (the biggest time saver);
- a graph with no Render node only builds prompts. That is the free path.


## The project (same as the other handoff)

- Repository: `phalldavid/AI-Tool-Suite`. Live site: https://phalldavid.github.io/AI-Tool-Suite/
  (v2 at the root, old v1 at `/v1/`).
- React 19, bundled with esbuild. Code in `app/src`, styles in `app/public/app.css`, no
  Tailwind, no component library. State in `app/src/store.ts` (`useApp`, `setState`),
  actions in `app/src/actions.ts`.
- Tests: `npm run test:app`. Type check: `npm run typecheck:app`.
- Workflow: commit with the attribution lines, push a branch, open a PR into `main`.
  **The owner merges PRs himself. Never merge.**
- Every new visible string needs a Khmer entry in `app/src/lib/i18n.ts` (the `KM` object). No
  duplicate keys. Switching language must not move the layout.
- The owner works in Phnom Penh. Plain everyday English in the UI. Metric units. USD for money.


## Rules before any code

1. **Do not break the app.** The owner said it works fine and does not want it broken.
   Every change is additive: a new tab, new files, new tests. Existing tabs, stores and
   functions keep their behaviour. If a change to an existing file is needed, keep it to a
   few lines and say so in the PR.
2. **One stage per branch and PR.** Stage 1 must be mergeable and useful on its own.
3. **Feature flag first.** The Advanced tab is hidden unless the owner turns it on
   (Settings, Developer, like Test mode). It becomes visible by default only when he says so.
4. **Never run the paid path in tests.** Use Test mode (`MockProvider`) for anything that
   renders.
5. Say what was **not verified** at the end of every PR. Claude's sandbox has no network
   installs, so `npm test`, `npm run typecheck:app` and a real build may not run there. The
   owner runs them before merging.
6. Do not invent numbers: no made-up prices, limits or token counts. Use `renderCost()` in
   `app/src/lib/cost.ts` for cost, and the real provider limits only when they are checked.


## Guardrails (the safeguards the owner asked for)

### Money

- A graph never spends anything by itself. Opening, editing, loading or pasting a graph
  never renders.
- The only paid action is a **Run** button with a visible total, built from
  `renderCost()` per Render node: "12 renders, about N credits". If any node's cost is
  unknown, the total says "cost unknown" and Run needs a second click.
- A **confirm step** like the Review dialog: shows the node count, the total, the backend,
  and where the images go. Escape cancels.
- **Hard cap per run**, default 10 renders, set in Settings. Above the cap, Run is disabled
  with a plain message. The owner can raise it.
- **Balance check** before a run (the Kie balance is already read; see `kieCredits` in the
  store and the "Not enough credits" check in `ReviewSheet.tsx`). Not enough credits blocks
  Run.
- **Stop all** always visible while running. It uses `cancelRender()`. Already finished
  renders are kept.
- Runs go **one after another**, or two at a time at most, never all at once. Stop on the
  first error and ask, so a bad key does not burn through the list.
- Test mode is respected: a run in Test mode is labelled "Test" and costs nothing.

### Data

- Graphs are saved as plain JSON files the owner can see, back up and share. No hidden
  storage as the only copy.
- Images are **not** stored inside a graph file by default. The graph stores file names and
  settings; image data stays in memory for the session (a "Save graph with images" option
  can be added later, with the size shown).
- localStorage is used only for light things (last graph, view position), always in
  try/catch, and the app must work when it throws or is empty.
- A graph file from outside is **data, not instructions**. On load, check it against a
  strict schema, drop unknown fields, limit node count and text length, and never run
  anything from it.
- API keys are never written into a graph file or the PR.
- Undo and redo for every canvas edit, plus an autosave of the last good graph, so a crash
  never loses work.

### Backends

- Browser backend (copy and paste into Gemini or ChatGPT): a graph ends at **"Prompt
  ready"** with a copy button per prompt. It cannot run the render, and the tab says so.
- Kie, Gemini API and ComfyUI backends: Render nodes work, with the cost rules above.
- The graph asks the existing provider layer. It never calls a provider's HTTP API itself.

### Screen size and speed

- **Desktop only.** On phones and narrow windows, show a plain message with a link back to
  the Render tab. Do not try to make a node editor work on a phone.
- Large images: nodes show **small thumbnails** (reuse `app/src/core/images.ts` helpers),
  never the full image. Limit images per graph (start at 30) and say so.
- Keep 60 fps pan and zoom with 50 nodes: draw wires as SVG paths, move nodes with CSS
  transforms, and keep canvas state out of the main store (one store slice, updated on drag
  end).
- Respect `prefers-reduced-motion` (`reducedMotion()` in `app/src/prefs.ts`).

### Accessibility

- Everything doable with the keyboard: select node, move with arrows, add node by search
  (reuse the palette idea), delete, connect two nodes without a mouse.
- aria labels on every icon-only button. Wires and node ports have text names.
- Contrast and colours from the existing CSS variables, so day and night themes work.


## Nodes (stage 1 set)

| Node | Settings it holds | Reuses |
|---|---|---|
| Image | picture, name, room or view guess | drop zone, `lib/room.ts` (`roomStarter`) |
| Look | one preset id | `core/presets.ts`, `core/library.ts` |
| Light | lighting id or time, interior or exterior | `core/prompt.ts` (`LIGHTING`, `INTERIOR_SKY`), `lib/lighting.ts` |
| Surroundings | environment id | `core/context.ts` |
| Fittings and notes | fittings, material lock, notes | `lib/fittings.ts`, `core/model-dna.ts` |
| Prompt | none (shows the final text, editable) | `buildRenderPrompt` in `core/prompt.ts` |
| Note | free text, for the human | none |

Stage 2 adds Render and Result. Stage 3 adds Spot edit, Relight, Multi-View, Style copy,
Group, and templates.

Wire types: **image**, **look settings**, **prompt text**, **result**. Only matching types
connect. A wrong wire shows why it was refused. No cycles.

Evaluation: a node recomputes only when its inputs change (cache by input hash), and
evaluation order comes from a topological sort. Keep the engine pure: no React, no DOM, so
it is testable with Node's test runner.


## Stages

### Stage 0: the engine and the file format (no UI)

- `app/src/core/graph/` with: types, schema and validator, topological sort, evaluator for
  the stage 1 nodes, serializer.
- The evaluator builds prompts by calling the **existing** `buildRenderPrompt`. It must give
  the same text as the Render tab for the same settings (a test proves it).
- Tests in `app/test/graph-*.test.ts`: cycles rejected, bad wires refused, malformed files
  rejected, limits enforced, prompt identical to the Render tab, round trip save and load.
- Branch: `node-canvas-0-engine`. No visible change in the app.

### Stage 1: prompt-only canvas

- New tab "Advanced", hidden behind the Developer flag.
- Pan, zoom, add node by search, move, wire, delete, undo and redo, save and load graph.
- Batch: one Look and one Light wired to many Image nodes gives one prompt per image, with
  per-image room guess where no look is wired.
- Output: copy one prompt, or "Save all prompts" (a `.txt` per image plus `prompts.json`,
  the same shape as the command-line batch in `scripts/mcp-server.mjs`).
- No backend calls. No cost. Safe to ship first.
- Branch: `node-canvas-1-prompts`.

### Stage 2: Render and Result nodes

- Render node uses the existing provider layer. Result node shows thumbnail, before and
  after, and sends the image to History.
- Run, cost total, confirm, cap, balance check, stop all, one-at-a-time (all guardrails
  above).
- Browser backend stops at "Prompt ready".
- Branch: `node-canvas-2-render`.

### Stage 3: chains and templates

- Spot edit, Relight, Multi-View, Style copy as nodes (these call the same actions the Edit
  tab calls).
- Group nodes, graph templates (a small starter set: "One look, many views", "Compare 4
  looks", "Render then relight").
- Branch: `node-canvas-3-chains`.

Do not start a stage before the owner has merged the one before it.


## Open questions for the owner (ask before Stage 1)

1. **Library or hand-built canvas?** A small library for pan, zoom, wires and dragging saves
   weeks. It adds one dependency (the project has only React today). Hand-built keeps zero
   dependencies and costs more time. Claude's sandbox cannot install packages, so a library
   has to be added on the owner's machine.
2. Default run cap: is 10 right?
3. Should templates ship with the app, or only the owner's own saved graphs?
4. Is the Developer flag the right gate, or a separate "Advanced" switch in Settings?


## Depends on other branches (not merged when this was written)

- `khmer-presets-and-agent-api`: adds `app/src/core/agent-api.ts` (`buildPrompt`,
  `buildBatch`, `listPresets`, `inferView`) and the 1000-look library. Stage 0 can reuse
  `buildBatch` for the batch output. If it is not merged yet, use `buildRenderPrompt`
  directly.
- `ux-dropzone-light-save` and `ux-polish-2`: indoor lighting wording, prompt save buttons,
  `lib/room.ts`, toast position. The Image node's room guess uses `lib/room.ts`.


## Checklist for each PR

- [ ] Existing tabs behave the same (open each one, run in Test mode).
- [ ] `npm run test:app` and `npm run typecheck:app` pass (or the PR says they were not run).
- [ ] New strings have `KM` entries, no duplicate keys.
- [ ] Nothing renders or spends without the confirm step.
- [ ] The PR lists what was not verified.
- [ ] Not merged by Claude.
