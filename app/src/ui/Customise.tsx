import { setState, useApp } from "../store";
import { ACCENTS, FONTS, resetPrefs, setPrefs, usePrefs } from "../prefs";
import { Icon } from "./Icon";

export function Customise() {
  const open = useApp((s) => s.customiseOpen);
  const p = usePrefs();
  if (!open) return null;
  const close = () => setState({ customiseOpen: false });
  const seg = <T extends string>(label: string, value: T, opts: [T, string][], set: (v: T) => void, cls = "tabs3") => (
    <section className="step" style={{ gap: 8 }}>
      <h3>{label}</h3>
      <div className={cls} role="radiogroup" aria-label={label}>
        {opts.map(([id, l]) => (
          <button key={id} type="button" role="radio" aria-checked={value === id} onClick={() => set(id)}>
            {l}
          </button>
        ))}
      </div>
    </section>
  );
  return (
    <>
      <div className="scrim" onClick={close} />
      <div
        className="popover rise thin"
        role="dialog"
        aria-label="Customise"
        onKeyDown={(e) => {
          if (e.key === "Escape") close();
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <h2 style={{ fontSize: 18 }}>Customise</h2>
          <button type="button" className="icon-btn" style={{ marginLeft: "auto", width: 32, height: 32 }} aria-label="Close" onClick={close}>
            <Icon name="close" size={14} />
          </button>
        </div>
        {seg("Theme", p.theme, [["dark", "Night"], ["light", "Day"], ["auto", "Auto"]], (theme) => setPrefs({ theme }))}
        <section className="step" style={{ gap: 8 }}>
          <h3>Accent</h3>
          <div className="swatches" role="radiogroup" aria-label="Accent colour">
            {Object.entries(ACCENTS).map(([id, a]) => (
              <button key={id} type="button" role="radio" className="swatch" aria-checked={p.accent === id} aria-label={a.label} title={a.label} style={{ background: a.color, ["--sw" as string]: a.color }} onClick={() => setPrefs({ accent: id })} />
            ))}
          </div>
        </section>
        <section className="step" style={{ gap: 8 }}>
          <h3>Font</h3>
          <div role="radiogroup" aria-label="Font" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {Object.entries(FONTS).map(([id, f]) => (
              <button key={id} type="button" role="radio" className="fontopt" aria-checked={p.font === id} onClick={() => setPrefs({ font: id })}>
                <span style={{ flex: 1, textAlign: "left" }}>{f.label}</span>
                <span style={{ fontFamily: f.stack, fontSize: 15, fontWeight: 600 }}>Aa ក</span>
              </button>
            ))}
          </div>
        </section>
        {seg("Language", p.lang, [["en", "English"], ["km", "ខ្មែរ"]], (lang) => setPrefs({ lang }), "tabs2")}
        {seg("Motion", p.motion, [["full", "Full"], ["reduced", "Reduced"]], (motion) => setPrefs({ motion }), "tabs2")}
        <button type="button" className="linkish" style={{ alignSelf: "flex-start", color: "var(--muted)" }} onClick={resetPrefs}>
          Reset to defaults
        </button>
      </div>
    </>
  );
}
