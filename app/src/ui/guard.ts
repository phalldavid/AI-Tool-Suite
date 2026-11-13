// Turns off the browser's right-click menu and the usual DevTools shortcuts on the app.
// Text boxes keep their right-click menu (paste, spelling). Developer mode turns this off.
// This only discourages casual poking; anything sent to a browser can still be read.

import { isDev } from "../lib/dev";

function editable(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  return Boolean(el && (el.closest("input, textarea, select, [contenteditable='true']")));
}

export function initGuard(): void {
  document.addEventListener("contextmenu", (e) => {
    if (isDev() || editable(e.target)) return;
    e.preventDefault();
  });
  document.addEventListener(
    "keydown",
    (e) => {
      if (isDev()) return;
      const k = e.key.toLowerCase();
      const devtools = k === "f12" || ((e.ctrlKey || e.metaKey) && e.shiftKey && (k === "i" || k === "j" || k === "c")) || ((e.ctrlKey || e.metaKey) && e.altKey && (k === "i" || k === "j")) || ((e.ctrlKey || e.metaKey) && k === "u");
      if (devtools) e.preventDefault();
    },
    true,
  );
  // Pictures can't be dragged out to the desktop by accident; Download is the way out.
  document.addEventListener("dragstart", (e) => {
    if ((e.target as HTMLElement | null)?.tagName === "IMG" && !isDev()) e.preventDefault();
  });
}
