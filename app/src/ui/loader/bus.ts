// Lets the render code wait for the loader's reveal before it moves on (for example
// before switching to the Edit tab), without knowing anything about the animation.

import type { ImageData64 } from "../../core/types";
import { getState, subscribe } from "../../store";
import type { Tab } from "../../store";
import { reducedMotion } from "../../prefs";

type Reveal = (image: ImageData64) => Promise<void>;

const stack: Reveal[] = [];
/** Called when a loader mounts, so a render that is holding its result can check again. */
const watchers = new Set<() => void>();

/** Only these tabs show a loader; a render started elsewhere reveals straight away. */
const LOADER_TABS: ReadonlySet<string> = new Set(["render", "edit"]);

/** A mounted loader offers to play reveals. Returns the function that withdraws it. */
export function registerLoader(fn: Reveal): () => void {
  stack.push(fn);
  for (const w of [...watchers]) w();
  return () => {
    const i = stack.lastIndexOf(fn);
    if (i >= 0) stack.splice(i, 1);
  };
}

/** Longest the app will wait for a reveal, in case the page is hidden or something stalls. */
export const REVEAL_TIMEOUT_MS = 15000;

/**
 * Plays the reveal on the loader that is showing (the most recent one) and resolves when
 * the crisp image is on screen. Resolves straight away when no loader is showing.
 */
export async function revealResult(image: ImageData64, timeoutMs = REVEAL_TIMEOUT_MS): Promise<void> {
  const fn = stack[stack.length - 1];
  if (!fn) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([fn(image).catch(() => undefined), new Promise<void>((res) => (timer = setTimeout(res, timeoutMs)))]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** True when the user is looking at the tab the render started on, with its loader on screen. */
export function isPresent(tab: Tab): boolean {
  if (!LOADER_TABS.has(tab)) return true;
  const visible = typeof document === "undefined" || document.visibilityState === "visible";
  return visible && getState().tab === tab && stack.length > 0;
}

function whenPresent(tab: Tab): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const off: Array<() => void> = [];
    const check = () => {
      if (done || !isPresent(tab)) return;
      done = true;
      off.forEach((f) => f());
      resolve();
    };
    off.push(subscribe(check));
    watchers.add(check);
    off.push(() => watchers.delete(check));
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", check);
      off.push(() => document.removeEventListener("visibilitychange", check));
    }
  });
}

/**
 * Holds a finished render until the user is back on the tab it started on, so the orb
 * animation and the reveal play for them and not into an empty page. Resolves true when it had
 * to wait. After they return it pauses a moment so they see the orb form before the burst.
 */
export async function holdUntilPresent(tab: Tab): Promise<boolean> {
  let waited = false;
  while (!isPresent(tab)) {
    waited = true;
    await whenPresent(tab);
    await new Promise<void>((res) => setTimeout(res, reducedMotion() ? 300 : 1100));
  }
  return waited;
}
