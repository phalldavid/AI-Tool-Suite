// One sliding highlight for every pill group (tabs, segmented switches, the Edit tool bar):
// the selected pill's background becomes a thumb that springs to the new choice,
// the same motion as the Interior / Exterior switch.

const GROUPS = [".tabs2", ".tabs3", ".seg-mini", ".nav", ".refine", ".seg-img", ".tools4"].join(",");
const ON = ':scope > [aria-checked="true"], :scope > [aria-selected="true"], :scope > [aria-pressed="true"]:not(.swap), :scope > [aria-current="page"]';

const seen = new WeakSet<Element>();
let ro: ResizeObserver | null = null;

function place(g: HTMLElement): void {
  const on = g.querySelector<HTMLElement>(ON);
  if (!on || on.offsetWidth === 0) {
    g.style.setProperty("--sl-o", "0");
    return;
  }
  g.style.setProperty("--sl-x", `${on.offsetLeft}px`);
  g.style.setProperty("--sl-y", `${on.offsetTop}px`);
  g.style.setProperty("--sl-w", `${on.offsetWidth}px`);
  g.style.setProperty("--sl-h", `${on.offsetHeight}px`);
  g.style.setProperty("--sl-o", "1");
}

function adopt(g: HTMLElement): void {
  if (seen.has(g)) return place(g);
  seen.add(g);
  g.classList.add("slide");
  place(g);
  ro?.observe(g);
  // Appear in place first; animate only later changes.
  requestAnimationFrame(() => requestAnimationFrame(() => g.classList.add("slide-ready")));
}

function scan(root: ParentNode): void {
  if (root instanceof HTMLElement && root.matches(GROUPS)) adopt(root);
  root.querySelectorAll<HTMLElement>(GROUPS).forEach(adopt);
}

export function initSlidingPills(): void {
  if (typeof MutationObserver === "undefined") return;
  ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver((es) => es.forEach((e) => place(e.target as HTMLElement)));
  scan(document.body);
  new MutationObserver((list) => {
    const touched = new Set<HTMLElement>();
    for (const m of list) {
      if (m.type === "childList") {
        m.addedNodes.forEach((n) => n instanceof HTMLElement && scan(n));
        const g = (m.target as HTMLElement).closest?.(GROUPS) as HTMLElement | null;
        if (g) touched.add(g);
      } else {
        const g = (m.target as HTMLElement).parentElement;
        if (g && g.matches(GROUPS)) touched.add(g);
      }
    }
    touched.forEach(adopt);
  }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-checked", "aria-selected", "aria-pressed", "aria-current"] });
  window.addEventListener("resize", () => document.querySelectorAll<HTMLElement>(".slide").forEach(place));
  document.fonts?.ready.then(() => document.querySelectorAll<HTMLElement>(".slide").forEach(place)).catch(() => undefined);
}
