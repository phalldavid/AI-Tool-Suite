import { setState, useApp } from "../store";
import { ACCENTS, FONTS, resetPrefs, setPrefs, usePrefs } from "../prefs";
import { Icon } from "./Icon";
import { LoaderPreview } from "./RenderLoader";
import { LOADER_STYLES } from "./loader/engine";

/** Everything in Customise: on desktop in its popover, on phones in Settings → Customize. */
export function CustomiseBody({ phone }: { phone?: boolean }) {
  const p = usePrefs();
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
        {phone ? seg("Language", p.lang, [["km", "ខ្មែរ"], ["en", "English"]], (lang) => setPrefs({ lang }), "tabs2") : null}
        {phone ? null : seg("Theme", p.theme, [["dark", "Night"], ["light", "Day"], ["auto", "Auto"]], (theme) => setPrefs({ theme }))}
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
        {phone ? null : seg("Language", p.lang, [["en", "English"], ["km", "ខ្មែរ"]], (lang) => setPrefs({ lang }), "tabs2")}
        {seg("Motion", p.motion, [["full", "Full"], ["reduced", "Reduced"]], (motion) => setPrefs({ motion }), "tabs2")}
        {seg("Background", p.bg, [["moving", "Moving"], ["still", "Still"], ["plain", "Plain"]], (bg) => setPrefs({ bg }))}
        <section className="step" style={{ gap: 8 }}>
          <h3>Loading animation</h3>
          <LoaderPreview key={p.loader} style={p.loader} />
          <p className="note" style={{ margin: 0 }}>{(LOADER_STYLES.find((x) => x.id === p.loader) ?? LOADER_STYLES[0]).hint}</p>
          <div className="loader-pick" role="radiogroup" aria-label="Loading animation">
            {LOADER_STYLES.map((x) => (
              <button key={x.id} type="button" role="radio" className="fontopt" aria-checked={p.loader === x.id} onClick={() => setPrefs({ loader: x.id })}>
                <span style={{ flex: 1, textAlign: "left" }}>{x.label}</span>
                {x.id === "orb" ? <span className="note" style={{ margin: 0 }}>Default</span> : null}
              </button>
            ))}
          </div>
        </section>
        <button type="button" className="linkish" style={{ alignSelf: "flex-start", color: "var(--muted)" }} onClick={resetPrefs}>
          Reset to defaults
        </button>
    </>
  );
}

export function Customise() {
  const open = useApp((s) => s.customiseOpen);
  if (!open) return null;
  const close = () => setState({ customiseOpen: false });
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
        <CustomiseBody />
      </div>
    </>
  );
}
