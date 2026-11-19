// A History item's picture as a small thumbnail (History grid, Recent renders strip).
// Full renders are several MB each; thumbnails are made once and kept (lib/thumbs.ts).

import { useEffect, useRef, useState } from "react";
import type { HistoryItem } from "../core/types";
import { toDataUrl } from "../core/images";
import { readyThumb, thumbFor } from "../lib/thumbs";

/**
 * A small thumbnail made in the background when the card comes near the screen.
 * The full image is only used if a thumbnail can't be made.
 */
export function Thumb({ item }: { item: HistoryItem }) {
  const [url, setUrl] = useState<string | null>(() => readyThumb(item.id) ?? null);
  const [failed, setFailed] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (url) return;
    const el = box.current;
    let live = true;
    const start = () => {
      void thumbFor(item.id, item.after).then((u) => {
        if (!live) return;
        if (u) setUrl(u);
        else setFailed(true);
      });
    };
    if (!el || typeof IntersectionObserver === "undefined") {
      start();
      return () => {
        live = false;
      };
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          start();
        }
      },
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => {
      live = false;
      io.disconnect();
    };
  }, [item.id, item.after, url]);
  if (url) return <img src={url} alt="" decoding="async" />;
  if (failed) return <img src={toDataUrl(item.after)} alt="" loading="lazy" decoding="async" />;
  return <span ref={box} className="hthumb-wait" aria-hidden="true" />;
}
