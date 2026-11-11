// Locked window layout: work area + settings panel with a drag handle.
// Wide windows: panel on the right. Tall or narrow ones: panel underneath.
// Phones: no lock, the page scrolls.

import type { ReactNode } from "react";
import { resetSize, setSizes, useSizes, useViewport } from "../layout";
import { Splitter } from "./Splitter";

export function Panels({ work, side, label }: { work: ReactNode; side: ReactNode; label: string }) {
  const { sideW, sideH } = useSizes();
  const vp = useViewport();
  const w = Math.max(320, Math.min(sideW, Math.round(vp.w * 0.55)));
  const h = Math.max(220, Math.min(sideH, Math.round(vp.h * 0.7)));
  if (vp.phone) {
    // Phones: normal scrolling page. Image at full width in its real shape,
    // settings below, Render bar pinned to the bottom.
    return (
      <div className="body flow">
        <main className="work">{work}</main>
        <aside className="side cq" aria-label={`${label} settings`}>
          {side}
        </aside>
      </div>
    );
  }
  return (
    <div className="body" style={{ flexDirection: vp.wide ? "row" : "column" }}>
      <main className="work">{work}</main>
      <Splitter
        dir={vp.wide ? "v" : "h"}
        label={`Resize the ${label} panel`}
        value={vp.wide ? w : h}
        onSize={(p, box) =>
          vp.wide
            ? setSizes({ sideW: Math.round(Math.max(320, Math.min(box.right - p.x, box.width * 0.55))) }, false)
            : setSizes({ sideH: Math.round(Math.max(220, Math.min(box.bottom - p.y, box.height * 0.7))) }, false)
        }
        onDone={() => setSizes({}, true)}
        onReset={() => resetSize("side")}
      />
      <aside className="side glass cq" aria-label={`${label} settings`} style={vp.wide ? { width: w, boxShadow: "-1px 0 0 var(--line)" } : { height: h, boxShadow: "0 -1px 0 var(--line)" }}>
        {side}
      </aside>
    </div>
  );
}
