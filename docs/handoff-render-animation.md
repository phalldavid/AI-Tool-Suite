# Handoff: render loading animation (David Render Studio v2)

Paste this whole file into a new session. It holds everything decided so far about the
animation that plays while a render is running.

## The project

- Repository: `phalldavid/AI-Tool-Suite`. Work on the branch `v2/beta`. The live site is
  https://phalldavid.github.io/AI-Tool-Suite/ (v2 at the root, the old v1 kept at `/v1/`).
- The app is React 19, bundled with esbuild. The code is in `app/src`, and the styles are in
  `app/public/app.css`. There is no Tailwind and no component library; everything is
  hand-written CSS with variables (`--accent` is the orange, `#f0a24a`).
- State lives in one store: `app/src/store.ts`, read with `useApp(selector)` and changed with
  `setState`. The actions are in `app/src/actions.ts`.
- Build the site locally: `node scripts/build-site.mjs --reuse-v1`. The output goes to
  `dist/web`. Serve it with `python3 -m http.server 8765` from `dist/web`.
- Tests: `npm run test:app` (Node's test runner; 116 pass at the time of writing).
- Workflow:
  - Commit with the attribution lines.
  - Push `v2/beta` and open a PR into `main`.
  - **The owner merges PRs himself.** Never merge.
- UI copy is plain, everyday English, translated to Khmer in `app/src/lib/i18n.ts`.
  - The translation works on the page itself (DOM level): every new visible string needs a
    `KM` entry.
  - Don't add a key that already exists, because TypeScript rejects duplicate keys.
  - Switching language must not move the layout.

## Where the animation goes today

- `busy` in the store is `{ label, since, typical }`.
  - `runProvider()` in `actions.ts` sets it before a render and clears it after.
  - `typical` is the usual duration in ms, learned from past renders (`core/progress.ts`:
    `typicalMs` and `rememberDuration`). Treat it as a guess: renders can be much faster or
    slower.
- `Progress` in `screens/Render.tsx` is the current loader: a small chip with a spinning icon,
  the label, a seconds counter and a cancel ×. It is used on the Render stage and on the Edit
  stage (`screens/Edit.tsx`).
- `FitFrame` in `Render.tsx` adds a `.scan` sweep over the picture while busy.
- Cancel: `cancelRender()` in `actions.ts`.
- When a Render-tab render finishes, `confirmReview()` puts the result into `versions` and
  switches to the Edit tab (`tab: "edit"`, `editMode: "compare"`).
  - That means the "result arrives" reveal must play either just before the tab switch, or on
    the Edit tab's compare stage.
  - Pick one and keep it smooth. The result should never just pop in.
- Edit tab tools (Spot edit, Relight, Multi-View, Style copy) also call `runProvider`. They stay
  on the Edit tab, and the new version is added to `versions`.
- Test mode (developer mode only; unlock it with the keyword `DAVID` in Settings → Developer)
  takes about 12 s and returns the input image with a TEST band.
  - Use it to try the animation without spending credits.
  - `MockProvider` delay is in `core/providers/mock.ts`.
- The provider gives **no real progress**. We only know when it starts, the typical time, and
  when the result arrives (or fails, or is cancelled).

## What the owner wants

The references are ChatGPT's image generation, Gemini's, and Apple's Siri and liquid-glass look.
It should feel expensive, calm and smooth.

1. **No percentage, no progress ring, no seconds counter.** Like ChatGPT, show:
   - a status line above or on the card, such as "Creating your image", with a small loader
     icon;
   - the image area as a big empty dark rounded card at the output aspect ratio;
   - the Render button changing to a **Stop (■)** button while running, which calls
     `cancelRender()`.
2. **Loader icon (exact spec):**
   - It is not a spinning circle. It is **3 small dots**.
   - They fly and orbit around each other, then line up into a straight horizontal row of 3
     dots, then loop back into orbiting, over and over.
   - It is the small "thinking" mark that Claude and Gemini use.
   - Make it in CSS or SVG, about 16–20 px, and smooth.
3. **Waiting effect, while the AI works:**
   - **Tiny, colourful, glassy particles** over the whole card: lots of small specks, not big
     balls.
   - They drift slowly in 3D, flying in and out of the frame edges, with depth (near ones a
     little bigger and sharper, far ones smaller, softer and dimmer).
   - Colourful like Siri: cyan, blue, violet, pink, a touch of amber.
   - Still glassy: each speck has a bright core or highlight and a soft halo, maybe additive
     glow.
   - Optionally start from the user's SketchUp view, very faint underneath.
   - Respect `prefers-reduced-motion`: show a still card, then just show the result.
4. **Gemini-style shimmer and aurora:** soft colour light moving slowly behind the particles.
   - It must **ease in at the start and keep moving smoothly the whole time**. In an earlier
     preview it popped in mid-way, and the owner disliked that.
   - Use continuous motion (sine-based), never a gradient that jumps back to the start.
5. **Result reveal, when the image arrives:**
   - **No dot grid and no squares.** The owner disliked both.
   - The particles should flow into the image and **blend together smoothly**. Something like:
     particles take the colours of the result, their halos grow and overlap into a soft blurred
     version of the picture, which then sharpens (ChatGPT's soft top-to-bottom sharpening is a
     good reference).
   - Calm, about 1.5–2 s, ending on the crisp image exactly as it will be shown in Compare.

## Already tried and rejected

These were all inline previews in the chat:

- Option A "developing photo": dim view, film grain, a light band sweep, then a Polaroid-style
  fade. Not chosen.
- Option B: stage steps with a percentage ring. The owner doesn't want a percentage.
- Option C: line drawing to photo with a left-to-right colour wipe. Not chosen.
- Option D: button squish, start/finish sound, shine burst. Not discussed again; ask before
  adding sound.
- A dot loader based on ui.wensity.com's "AI Image Generator". The owner asked why the dots
  formed an oval: the cloud was placed inside an ellipse. Don't do that; the particles should
  use the whole frame.
- 3D flowing dots with a **liquid-glass lens** and a **percentage ring top right**. The owner
  disliked both the lens and the ring.
- **Big glass balls** (Siri-coloured spheres with highlights). "Too big", and the bubbles were
  disliked.
- A **ChatGPT-style dot grid** that turns into the photo. Disliked.

## Suggested approach

- Draw on one `<canvas>` over the stage, sized to the frame (watch `devicePixelRatio`).
  - Pre-render a few glow sprites per colour, so a few thousand tiny particles stay fast.
  - Use additive (`lighter`) blending for the halos.
  - Pause the loop when the tab is hidden or the stage is off screen.
- Drive everything from time, not a fixed duration:
  - A waiting state that loops forever.
  - When the result arrives, a reveal from the particles' current state to the result.
  - If the user stops, fade out back to the empty card.
- Sample the result image's colours from a small down-scaled copy, for speed.
- Keep the new component self-contained, e.g. `app/src/ui/RenderLoader.tsx` plus a small canvas
  module, and replace `Progress` and `.scan` with it.
  - Keep a visible "Stop" and the status line, for accessibility (`role="status"`).
- Before building it into the app, show the owner an inline preview to approve. He likes to
  see it first.

## Owner's other standing preferences

- Plain, everyday wording. No jargon.
- The UI is orange-accented and warm, in dark and light themes. Check both.
- Khmer fonts: titles use Kh Jrung Thom, bold text uses KD Jayavarman I.
