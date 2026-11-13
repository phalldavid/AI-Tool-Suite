// Phones: the action button (and the Edit tab's tool dock) sit in one bar fixed to the bottom
// of the screen, above the iPhone home bar, whatever the scroll position. Desktop: unchanged,
// the button stays in the side panel's footer.
//
// Fixed elements can't live inside the side panel (it is a CSS container, which traps
// `position: fixed`), so on phones the bar is portalled into one shared holder at the end of the app shell.
// Its height is published as --pb-h so the page can leave room for it.

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useViewport } from "../layout";

let holder: HTMLDivElement | null = null;

function bottomHolder(): HTMLDivElement {
  if (holder && document.body.contains(holder)) return holder;
  holder = document.createElement("div");
  holder.className = "phone-bottom";
  // Inside the app's own layer, so the tour, toasts and pop-ups stay above the bar.
  (document.querySelector(".shell") ?? document.body).appendChild(holder);
  const ro = new ResizeObserver(() => {
    const h = holder && holder.childElementCount ? Math.ceil(holder.getBoundingClientRect().height) : 0;
    document.documentElement.style.setProperty("--pb-h", `${h}px`);
  });
  ro.observe(holder);
  return holder;
}

/**
 * The footer of a side panel. `inline` keeps the old look on desktop (no footer box), for
 * panels whose button sits at the end of their scrolling list.
 */
export function Foot({ children, inline, phoneOnly, className }: { children: ReactNode; inline?: boolean; phoneOnly?: boolean; className?: string }) {
  const vp = useViewport();
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (vp.phone) setRoot(bottomHolder());
  }, [vp.phone]);
  if (!vp.phone && phoneOnly) return null;
  if (!vp.phone) return inline ? <>{children}</> : <div className={`side-foot${className ? ` ${className}` : ""}`}>{children}</div>;
  if (!root) return null;
  return createPortal(<div className={`phonebar${className ? ` ${className}` : ""}`}>{children}</div>, root);
}

/** Something else for the phone's bottom holder, under the action bar (the Edit dock). */
export function PhoneDock({ children }: { children: ReactNode }) {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  useEffect(() => setRoot(bottomHolder()), []);
  if (!root) return null;
  return createPortal(<div className="phonedock">{children}</div>, root);
}
