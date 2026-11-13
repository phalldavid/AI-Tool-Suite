// Lets the render code wait for the loader's reveal before it moves on (for example
// before switching to the Edit tab), without knowing anything about the animation.

import type { ImageData64 } from "../../core/types";

type Reveal = (image: ImageData64) => Promise<void>;

const stack: Reveal[] = [];

/** A mounted loader offers to play reveals. Returns the function that withdraws it. */
export function registerLoader(fn: Reveal): () => void {
  stack.push(fn);
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
