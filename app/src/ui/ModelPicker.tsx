// Model list above the Render button: icon, name, badge, what it's good at, cost.
// Picking a Kie model switches to Kie; Prompt Copy and Test mode sit at the end.

import { useEffect, useRef, useState } from "react";
import { setState, useApp } from "../store";
import { editModelId, updateSettings } from "../actions";
import { useDev } from "../lib/dev";
import { KIE_MODELS, creditsFor, priceText, findKieModel } from "../core/providers/kie-models";
import type { KieFamilyId, KieModel } from "../core/providers/kie-models";
import { modelLogo } from "../core/model-logos";
import { toast } from "../toasts";
import { Icon } from "./Icon";

const TINT: Record<KieFamilyId, string> = { nano: "#4f7cff", gpt: "#19a37f", seedream: "#e8663d" };

/** Groups by what each model is for. Every model is in exactly one group. */
export const MODEL_GROUPS: { id: string; label: string; ids: string[] }[] = [
  { id: "rec", label: "Recommended", ids: ["nano-banana-2-1"] },
  { id: "quality", label: "Best quality", ids: ["nano-banana-pro", "gpt-image-2-5-sunburst-image-to-image", "seedream/5-pro-image-to-image"] },
  { id: "fast", label: "Fast and low cost", ids: ["seedream/5-5-image-to-image", "seedream/5-flash-image-to-image", "gpt-image-2-5-flare-image-to-image"] },
  { id: "text", label: "Signs and lettering", ids: ["gpt-image-2-image-to-image"] },
];

/** Capability labels taken from the model list itself, so nothing is claimed that isn't there. */
function capsFor(m: KieModel): string[] {
  const caps: string[] = [];
  if (m.id === "nano-banana-2-1") caps.push("Default");
  if (m.id === "seedream/5-flash-image-to-image") caps.push("Lowest cost");
  if (m.resolutions.includes("4K")) caps.push("4K");
  else caps.push(`Up to ${m.resolutions.includes("2K") ? "2K" : "1K"}`);
  if (m.textId) caps.push("No image needed");
  return caps;
}

function groupOf(id: string): string {
  return MODEL_GROUPS.find((g) => g.ids.includes(id))?.id ?? "other";
}

function Logo({ family, size = 32 }: { family: KieFamilyId; size?: number }) {
  return (
    <span className="mp-logo" style={{ width: size, height: size, background: TINT[family] }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: modelLogo(family, Math.round(size * 0.55)) }} />
  );
}

/** edit: picks the Edit tab's model (default the low-cost one), not the Render tab's. */
export function ModelPicker({ edit }: { edit?: boolean }) {
  const s = useApp((x) => x.settings);
  const dev = useDev();
  const [open, setOpen] = useState(false);
  const [shut, setShut] = useState<string[]>([]);
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
  const modelId = edit ? editModelId() : s.kieModel;
  const m = findKieModel(modelId);
  const current = s.testMode ? "Test mode" : kie ? m.label : s.backend === "browser" ? "Prompt Copy" : s.backend === "gemini" ? "Gemini API" : "ComfyUI";
  const sub = s.testMode ? "No AI, free" : kie ? `${s.kieResolution} · ${creditsFor(m, s.kieResolution) ?? "?"} credits` : s.backend === "browser" ? "Free, paste into Gemini or ChatGPT" : "";

  const pick = (fn: () => Promise<void> | void) => () => {
    void fn();
    setOpen(false);
  };
  const pickKie = (id: string) =>
    pick(async () => {
      await updateSettings(edit ? { backend: "kie", testMode: false, editModel: id } : { backend: "kie", testMode: false, kieModel: id });
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
    <div className="mp" ref={box} data-tour="model">
      <button type="button" className="mp-trigger" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
        {kie ? <Logo family={m.family} size={22} /> : <span className="mp-logo plain" style={{ width: 22, height: 22 }}><Icon name={s.testMode ? "cube" : "clipboard"} size={13} /></span>}
        <b>{current}</b>
        {sub ? <span className="mp-pill num">{sub}</span> : null}
        <Icon name="up" size={15} style={{ marginLeft: "auto", transition: "transform 200ms var(--ease)", transform: open ? "none" : "rotate(180deg)" }} />
      </button>
      {open ? (
        <div className="mp-pop glass" ref={list} role="listbox" aria-label="Model" onKeyDown={onListKey}>
          {[...MODEL_GROUPS, { id: "other", label: "Other models", ids: [] as string[] }].map((g) => {
            const list = KIE_MODELS.filter((x) => groupOf(x.id) === g.id);
            if (!list.length) return null;
            const closed = shut.includes(g.id);
            return (
              <div key={g.id} className="mp-group" role="group" aria-label={g.label}>
                <button type="button" className="mp-ghead" aria-expanded={!closed} onClick={() => setShut((x) => (closed ? x.filter((y) => y !== g.id) : [...x, g.id]))}>
                  <Icon name="chevron" size={13} style={{ transform: closed ? "rotate(-90deg)" : "none", transition: "transform 160ms var(--ease)" }} />
                  {g.label}
                  <small>{list.length}</small>
                </button>
                {closed
                  ? null
                  : list.map((x) => {
                      const on = kie && x.id === modelId;
                      const cr = creditsFor(x, s.kieResolution);
                      return (
                        <button key={x.id} type="button" role="option" aria-selected={on} className="mp-item" onClick={pickKie(x.id)}>
                          <Logo family={x.family} />
                          <span className="mp-text">
                            <span className="mp-name">
                              {x.label}
                              {capsFor(x).map((t) => <em key={t}>{t}</em>)}
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
              </div>
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
          {dev || s.testMode ? (
            <button type="button" role="option" aria-selected={s.testMode} className="mp-item" onClick={pick(() => updateSettings({ testMode: true }))}>
              <span className="mp-logo plain"><Icon name="cube" size={16} /></span>
              <span className="mp-text">
                <span className="mp-name">Test mode<em>Developer</em></span>
                <small>Sample image after about 12 s, no AI, nothing spent</small>
              </span>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
