// Panel sizes the user dragged, remembered between visits.

import { useEffect, useState, useSyncExternalStore } from "react";

export interface LayoutSizes {
  sideW: number;
  sideH: number;
  stripH: number;
}

const KEY = "drs2.layout";
const DEFAULTS: LayoutSizes = { sideW: 460, sideH: 360, stripH: 150 };
let sizes: LayoutSizes = load();
const listeners = new Set<() => void>();

function load(): LayoutSizes {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return { ...DEFAULTS };
  }
}

export function setSizes(patch: Partial<LayoutSizes>, save = true): void {
  sizes = { ...sizes, ...patch };
  if (save) {
    try {
      localStorage.setItem(KEY, JSON.stringify(sizes));
    } catch {
      /* not saved */
    }
  }
  for (const l of listeners) l();
}

export function resetSize(which: "side" | "strip"): void {
  setSizes(which === "side" ? { sideW: DEFAULTS.sideW, sideH: DEFAULTS.sideH } : { stripH: DEFAULTS.stripH });
}

export function useSizes(): LayoutSizes {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => sizes,
    () => sizes,
  );
}

/** Window size, updated once per frame while resizing. */
export function useViewport(): { w: number; h: number; wide: boolean; phone: boolean } {
  const [v, setV] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setV({ w: window.innerWidth, h: window.innerHeight }));
    };
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("resize", on);
      cancelAnimationFrame(raf);
    };
  }, []);
  return { ...v, wide: v.w >= 900 && v.w > v.h * 1.05, phone: v.w < 700 };
}
