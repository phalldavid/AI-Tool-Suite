// The animation that plays over the stage while a render runs, its status line with the
// three-dot mark, the Stop button, and a small looping preview for Customise.

import { useEffect, useRef } from "react";
import { getState, useApp } from "../store";
import type { ImageData64 } from "../core/types";
import { toDataUrl } from "../core/images";
import { isLight, reducedMotion, usePrefs } from "../prefs";
import { t } from "../lib/i18n";
import { LoaderEngine, STATUS_WORDS, loadImage } from "./loader/engine";
import type { LoaderStyle } from "./loader/engine";
import { registerLoader } from "./loader/bus";
import { makeDemo } from "./loader/demo";
import { Icon } from "./Icon";

function useEngineOptions(style?: LoaderStyle) {
  const p = usePrefs();
  return {
    style: style ?? p.loader,
    light: isLight(p),
    reduced: reducedMotion(),
    gatherSec: p.loaderGather,
    words: STATUS_WORDS.map((w) => t(w)),
    lang: p.lang,
  };
}

/**
 * The loader layer. Sits over the picture and fills it exactly, so it always has the
 * output's shape. `holdResult` keeps the finished image showing (the Render tab, which
 * switches to Edit straight after); otherwise it fades away once the render is done.
 */
export function RenderLoader({ under, holdResult }: { under?: ImageData64 | null; holdResult?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const eng = useRef<LoaderEngine | null>(null);
  const busy = useApp((s) => s.busy);
  const was = useRef(false);
  const opts = useEngineOptions();

  useEffect(() => {
    const e = new LoaderEngine(box.current!, { ...opts, typicalMs: getState().busy?.typical ?? 30000 });
    eng.current = e;
    const off = registerLoader(async (img) => {
      const im = await loadImage(toDataUrl(img));
      await e.arrive(im);
    });
    return () => {
      off();
      e.destroy();
      eng.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    eng.current?.setOptions({ style: opts.style, light: opts.light, reduced: opts.reduced, gatherSec: opts.gatherSec, words: opts.words });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.style, opts.light, opts.reduced, opts.gatherSec, opts.lang]);

  useEffect(() => {
    let live = true;
    if (!under) eng.current?.setUnder(null);
    else
      void loadImage(toDataUrl(under))
        .then((im) => live && eng.current?.setUnder(im))
        .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [under]);

  useEffect(() => {
    const e = eng.current;
    if (!e) return;
    const on = Boolean(busy);
    if (on && !was.current) {
      e.setOptions({ typicalMs: busy!.typical });
      e.start();
    } else if (!on && was.current) {
      if (e.state === "wait" || e.state === "gather") e.stop();
      else if (e.state === "done" && !holdResult) e.clear();
    }
    was.current = on;
  }, [busy, holdResult]);

  return <div ref={box} className="rl" aria-hidden="true" />;
}

/**
 * The three-dot thinking mark: the dots orbit each other, line up in a row (without
 * crossing over), then loop back into orbit.
 */
export function ThinkingDots({ size = 20 }: { size?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = ref.current!;
    const dots = [...svg.querySelectorAll("circle")];
    const slots = [0, 1, 2];
    let sorted = false;
    let raf = 0;
    const sm = (a: number, b: number, x: number) => {
      const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
      return k * k * (3 - 2 * k);
    };
    const draw = (now: number) => {
      const t = now / 1000;
      const ph = (t % 2.6) / 2.6;
      const a = (t * 2 * Math.PI) / 1.3;
      if (ph < 0.45) sorted = false;
      const orbit = [0, 1, 2].map((i) => [Math.cos(a + i * 2.094) * 5, Math.sin(a + i * 2.094) * 5]);
      if (ph >= 0.45 && !sorted) {
        [0, 1, 2].sort((i, j) => orbit[i][0] - orbit[j][0]).forEach((d, s) => (slots[d] = s));
        sorted = true;
      }
      const w = reducedMotion() ? 1 : sm(0.45, 0.62, ph) * (1 - sm(0.84, 1, ph));
      dots.forEach((c, i) => {
        const lx = (slots[i] - 1) * 6;
        c.setAttribute("cx", (orbit[i][0] * (1 - w) + lx * w).toFixed(2));
        c.setAttribute("cy", (orbit[i][1] * (1 - w)).toFixed(2));
      });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <svg ref={ref} width={size} height={size} viewBox="-10 -10 20 20" aria-hidden="true" className="dots3">
      <circle r="2" cx="-6" />
      <circle r="2" />
      <circle r="2" cx="6" />
    </svg>
  );
}

/** The status line on the stage: three dots, what is happening, and Stop. */
export function LoaderStatus() {
  const busy = useApp((s) => s.busy);
  if (!busy) return null;
  const text = busy.revealing ? "Finishing up" : busy.label;
  return (
    <div className="busy-chip" role="status" aria-live="polite">
      <ThinkingDots />
      <span className="shimmer">{text}</span>
      {busy.revealing ? null : (
        <button type="button" aria-label="Stop the render" title="Stop" onClick={() => void import("../actions").then((a) => a.cancelRender())}>
          <Icon name="stop" size={12} />
        </button>
      )}
    </div>
  );
}

/** Takes the place of a Render or Apply button while a render runs. */
export function StopButton() {
  const revealing = useApp((s) => Boolean(s.busy?.revealing));
  return (
    <button type="button" className="cta stop" disabled={revealing} onClick={() => void import("../actions").then((a) => a.cancelRender())}>
      {revealing ? <ThinkingDots size={18} /> : <span className="stop-sq" aria-hidden="true" />}
      {revealing ? "Finishing up" : "Stop"}
    </button>
  );
}

/** A small looping demo of one loader style, on a stand-in picture. For Customise. */
export function LoaderPreview({ style }: { style: LoaderStyle }) {
  const box = useRef<HTMLDivElement>(null);
  const eng = useRef<LoaderEngine | null>(null);
  const opts = useEngineOptions(style);
  useEffect(() => {
    const e = new LoaderEngine(box.current!, { ...opts, typicalMs: 12000, count: 700 });
    eng.current = e;
    const demo = makeDemo();
    e.setUnder(demo.view);
    let live = true;
    let timer = 0;
    const wait = (ms: number) => new Promise<void>((r) => (timer = window.setTimeout(r, ms)));
    const loop = async () => {
      while (live) {
        e.start();
        await wait(3500);
        if (!live) return;
        await e.arrive(demo.result);
        if (!live) return;
        await wait(1600);
        if (!live) return;
        e.clear();
        await wait(700);
      }
    };
    void loop();
    return () => {
      live = false;
      window.clearTimeout(timer);
      e.destroy();
      eng.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    eng.current?.setOptions({ style: opts.style, light: opts.light, reduced: opts.reduced, gatherSec: opts.gatherSec, words: opts.words });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.style, opts.light, opts.reduced, opts.gatherSec, opts.lang]);
  return <div ref={box} className="rl rl-preview" aria-hidden="true" />;
}
