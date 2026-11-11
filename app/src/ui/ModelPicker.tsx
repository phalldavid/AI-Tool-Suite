// Model list above the Render button: icon, name, badge, what it's good at, cost.
// Picking a Kie model switches to Kie; Prompt Copy and Test mode sit at the end.

import { useEffect, useRef, useState } from "react";
import { setState, useApp } from "../store";
import { updateSettings } from "../actions";
import { KIE_FAMILIES, KIE_MODELS, creditsFor, priceText, findKieModel } from "../core/providers/kie-models";
import type { KieFamilyId, KieModel } from "../core/providers/kie-models";
import { modelLogo } from "../core/model-logos";
import { toast } from "../toasts";
import { Icon } from "./Icon";

const TINT: Record<KieFamilyId, string> = { nano: "#4f7cff", gpt: "#19a37f", seedream: "#e8663d" };

function badgeFor(m: KieModel): string {
  if (m.id === "nano-banana-2-1") return "Default";
  const n = m.note.toLowerCase();
  if (/text|letter|sign/.test(n)) return "Text";
  if (/fast|flash|quick/.test(n)) return "Fastest";
  if (/detail|best|pro/.test(n)) return "Detail";
  return KIE_FAMILIES.find((f) => f.id === m.family)?.badge ?? "";
}

function Logo({ family, size = 32 }: { family: KieFamilyId; size?: number }) {
  return (
    <span className="mp-logo" style={{ width: size, height: size, background: TINT[family] }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: modelLogo(family, Math.round(size * 0.55)) }} />
  );
}

export function ModelPicker() {
  const s = useApp((x) => x.settings);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key, true);
    requestAnimationFrame(() => list.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus());
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key, true);
    };
  }, [open]);

  const kie = s.backend === "kie" && !s.testMode;
  const m = findKieModel(s.kieModel);
  const current = s.testMode ? "Test mode" : kie ? m.label : s.backend === "browser" ? "Prompt Copy" : s.backend === "gemini" ? "Gemini API" : "ComfyUI";
  const sub = s.testMode ? "No AI, free" : kie ? `${s.kieResolution} · ${creditsFor(m, s.kieResolution) ?? "?"} credits` : s.backend === "browser" ? "Free, paste into Gemini or ChatGPT" : "";

  const pick = (fn: () => Promise<void> | void) => () => {
    void fn();
    setOpen(false);
  };
  const pickKie = (id: string) =>
    pick(async () => {
      await updateSettings({ backend: "kie", testMode: false, kieModel: id });
      if (!s.kieKey.trim()) {
        toast("Add your Kie.ai key in Settings to render with this model.", "warn", { label: "Settings", run: () => setState({ dialog: "settings" }) });
      }
    });

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...(list.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
  };

  return (
    <div className="mp" ref={box}>
      <button type="button" className="mp-trigger" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
        {kie ? <Logo family={m.family} size={22} /> : <span className="mp-logo plain" style={{ width: 22, height: 22 }}><Icon name={s.testMode ? "cube" : "clipboard"} size={13} /></span>}
        <b>{current}</b>
        {sub ? <span className="mp-pill num">{sub}</span> : null}
        <Icon name="up" size={15} style={{ marginLeft: "auto", transition: "transform 200ms var(--ease)", transform: open ? "none" : "rotate(180deg)" }} />
      </button>
      {open ? (
        <div className="mp-pop glass" ref={list} role="listbox" aria-label="Model" onKeyDown={onListKey}>
          {KIE_MODELS.map((x) => {
            const on = kie && x.id === s.kieModel;
            const badge = badgeFor(x);
            const cr = creditsFor(x, s.kieResolution);
            return (
              <button key={x.id} type="button" role="option" aria-selected={on} className="mp-item" onClick={pickKie(x.id)}>
                <Logo family={x.family} />
                <span className="mp-text">
                  <span className="mp-name">
                    {x.label}
                    {badge ? <em>{badge}</em> : null}
                  </span>
                  <small>{x.note}</small>
                </span>
                <span className="mp-cost num">
                  {cr !== null ? `${cr} cr` : ""}
                  <small>{priceText(x, s.kieResolution)}</small>
                </span>
              </button>
            );
          })}
          <div className="mp-sep" role="presentation" />
          <button type="button" role="option" aria-selected={s.backend === "browser" && !s.testMode} className="mp-item" onClick={pick(() => updateSettings({ backend: "browser", testMode: false }))}>
            <span className="mp-logo plain"><Icon name="clipboard" size={16} /></span>
            <span className="mp-text">
              <span className="mp-name">Prompt Copy<em>Free</em></span>
              <small>Get the prompt, render in Gemini or ChatGPT yourself</small>
            </span>
          </button>
          <button type="button" role="option" aria-selected={s.testMode} className="mp-item" onClick={pick(() => updateSettings({ testMode: true }))}>
            <span className="mp-logo plain"><Icon name="cube" size={16} /></span>
            <span className="mp-text">
              <span className="mp-name">Test mode</span>
              <small>Sample image, no AI, nothing spent</small>
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
