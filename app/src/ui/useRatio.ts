// Width / height of a picture. Uses the stored size when there is one, else reads it from the
// picture itself, so portrait results are never framed (and cropped) as 4:3.

import { useEffect, useState } from "react";
import type { ImageData64 } from "../core/types";
import { toDataUrl } from "../core/images";

const cache = new WeakMap<ImageData64, number>();

export function useRatio(img: ImageData64 | null | undefined, fallback = 4 / 3): number {
  const known = img?.width && img.height ? img.width / img.height : img ? cache.get(img) ?? 0 : 0;
  const [r, setR] = useState(known);
  useEffect(() => {
    if (!img) return;
    if (img.width && img.height) return setR(img.width / img.height);
    const c = cache.get(img);
    if (c) return setR(c);
    let live = true;
    const el = new Image();
    el.onload = () => {
      if (!el.naturalWidth || !el.naturalHeight) return;
      const v = el.naturalWidth / el.naturalHeight;
      cache.set(img, v);
      img.width = el.naturalWidth;
      img.height = el.naturalHeight;
      if (live) setR(v);
    };
    el.src = toDataUrl(img);
    return () => {
      live = false;
    };
  }, [img]);
  return r || known || fallback;
}
