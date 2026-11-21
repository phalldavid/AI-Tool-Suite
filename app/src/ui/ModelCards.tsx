import { useEffect, useRef, useState } from "react";
import { KIE_MODELS, KIE_FAMILIES, findKieModel, priceText, resolutionFor } from "../core/providers/kie-models";
import type { KieModel, KieResolution } from "../core/providers/kie-models";
import { brandMark } from "../core/model-logos";
import { Icon } from "./Icon";

const FEATURED = ["seedream/5-flash-image-to-image", "nano-banana-2-1", "nano-banana-pro"];

function Mark({ m, size }: { m: KieModel; size: number }) {
  return <span className="mc-mark" aria-hidden="true" dangerouslySetInnerHTML={{ __html: brandMark(m.family, size) }} />;
}

/** Review-sheet model choice: three cards, an "All models" list, and the resolution buttons on one level. */
export function ModelCards(props: { modelId: string; resolution: KieResolution; onModel: (m: KieModel) => void; onResolution: (r: KieResolution) => void }) {
  const { modelId, resolution } = props;
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const cur = findKieModel(modelId);
  const featured = FEATURED.map((id) => KIE_MODELS.find((m) => m.id === id)).filter((m): m is KieModel => !!m);
  const inFeatured = featured.some((m) => m.id === modelId);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc, true);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc, true); };
  }, [open]);

  const price = (m: KieModel) => priceText(m, resolutionFor(m, resolution));

  return (
    <section className="model-pick" aria-label="Model">
      <div className="mc-grid" role="radiogroup" aria-label="Model">
        {featured.map((m) => (
          <button key={m.id} type="button" role="radio" aria-checked={m.id === modelId} className="mc-card" onClick={() => props.onModel(m)}>
            <span className="mc-text">
              <b>{m.label}</b>
              <small>{m.note}</small>
              <span className="mc-price num">{price(m)}</span>
            </span>
            <Mark m={m} size={30} />
          </button>
        ))}
      </div>
      <div className="mc-bar">
        <div className="mc-all" ref={wrap}>
          <button type="button" className="mc-allbtn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <span>{inFeatured ? "All models" : cur.label}</span>
            <Icon name="chevron" size={14} />
          </button>
          {open ? (
            <ul className="mc-menu" role="listbox" aria-label="All models">
              {KIE_FAMILIES.map((f) => (
                <li key={f.id} role="presentation">
                  <div className="mc-group">{f.label} · {f.maker}</div>
                  {KIE_MODELS.filter((m) => m.family === f.id).map((m) => (
                    <button key={m.id} type="button" role="option" aria-selected={m.id === modelId} className="mc-item" onClick={() => { props.onModel(m); setOpen(false); }}>
                      <span className="mc-text"><b>{m.label}</b><small>{m.note}</small></span>
                      <span className="mc-price num">{price(m)}</span>
                      <Mark m={m} size={20} />
                    </button>
                  ))}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="tabs3" role="radiogroup" aria-label="Resolution" style={{ flex: "none", gridTemplateColumns: "repeat(3, minmax(48px, 1fr))" }}>
          {(["1K", "2K", "4K"] as KieResolution[]).map((r) => {
            const ok = cur.resolutions.includes(r);
            return (
              <button key={r} type="button" role="radio" aria-checked={resolution === r} disabled={!ok} data-why={`${cur.label} does not make ${r}. Pick another model for ${r}.`} onClick={() => props.onResolution(r)}>{r}</button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
