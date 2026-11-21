# How the app feels (feedback system)

Every action answers the person in three ways at once: **motion** (what they see), **haptics**
(a light tick on phones that support it) and **sound** (off until switched on in Settings, Feel).
They are driven from one place, `app/src/lib/feel.ts`, so they always agree.

## What you get without doing anything

- **Press**: every button, tab, option and link squishes to 97% on press and springs back
  (base styles in `app.css`, tokens `--spring` and `--glide`). A light haptic tick, no sound.
- **Switch or toggle** (`aria-pressed`, `aria-checked`, `.switch`, checkboxes in settings rows):
  a pop, a tick, and with sound on a soft two-note click.
- **Every toast**: `toast()` calls `notify()`. The button that was just pressed ticks (green ring
  pulse) on `ok`, shakes on `error`, pops on `warn`; haptic and sound match. Do not add `feel()`
  next to a toast.
- **Render start and finish**: `feel("start")` and `feel("done")` in `runProvider` and the
  Advanced runner.

## When you add something

- A short action that ends in a toast: nothing to add.
- An action that takes a moment and has no toast (a save, a copy, a download):
  `await withFeel(buttonElement, thePromise)`. The button breathes while it runs, then ticks or shakes.
- A new kind of moment: add it to `Feel`, `HAPTIC` and `SOUND` in `feel.ts`, and the test in
  `app/test/feel.test.ts` checks it stays soft.
- A disabled button should say why in its `title` (and in words near it when it matters).

## Rules that keep it feeling expensive

- Sound is rare: switches, success, warning, error, render start and finish. Never every press.
- Tones are quiet sine waves under half a second, with no clicks at either end.
- Motion is one family: spring for things you touch, glide for things that appear.
- Reduced motion (the OS setting or the app's own): no movement, but success and error still show
  as a still coloured ring.
- Feedback must never fail an action. `feel.ts` catches everything.

## Not done yet (next passes)

- Convert the long actions that have no toast to `withFeel` (download, copy image, save, paste).
- Disabled buttons: a tap on one should say why it is off.
- Sheets, menus and tab changes: one shared enter and exit motion.

## Long actions, disabled buttons and shared motion

- `feelPressed(promise)` (in `lib/feel.ts`): the button just pressed breathes while the work runs, then ticks or shakes. Used by `download`, `copyImageToClipboard` and the paste actions.
- Disabled buttons: give a `button` the `data-why="..."` attribute. Pressing it while it is disabled shakes it and shows that text as a toast. Add a Khmer entry for each new string in `lib/i18n.ts`.
- Motion: `--enter-ms`, `--leave-ms` and the `enter` / `leave` keyframes in `app.css`. Sheets now play the motion in reverse when they close (`data-leaving` in `ui/Sheet.tsx`); screens play `enter` when the tab changes. All are off under reduced motion.
