import { useState } from "react";
import { getState, setState, useApp } from "../store";
import { checkKey, importFromV1, updateSettings } from "../actions";
import { BROWSER_SITES } from "../core/settings";
import type { Settings } from "../core/settings";
import { KIE_MODELS, priceText, findKieModel } from "../core/providers/kie-models";
import type { KieResolution } from "../core/providers/kie-models";
import { KIE_KEY_PAGE } from "../core/providers/kie";
import { backendStatus } from "../lib/status";
import { Sheet } from "./Sheet";
import { Icon } from "./Icon";

const BACKENDS: { id: Settings["backend"] | "test"; label: string; sub: string }[] = [
  { id: "browser", label: "Free · copy-paste", sub: "Gemini, ChatGPT or Flow with your own login. No key." },
  { id: "kie", label: "Kie.ai key", sub: "Nano Banana, GPT Image, Seedream. Paid per image." },
  { id: "gemini", label: "Gemini API key", sub: "Google AI Studio key, billed by Google." },
  { id: "comfyui", label: "ComfyUI (local)", sub: "Your own PC and models." },
  { id: "test", label: "Test mode", sub: "Sample images. Nothing is sent or spent." },
];

export function SettingsSheet() {
  const open = useApp((s) => s.dialog === "settings");
  const s = useApp((x) => x.settings);
  const check = useApp((x) => x.keyCheck);
  const [show, setShow] = useState(false);
  const close = () => setState({ dialog: null });
  const current = s.testMode ? "test" : s.backend;
  const st = backendStatus(s, check);
  const model = findKieModel(s.kieModel);
  const pick = (id: string) => {
    if (id === "test") void updateSettings({ testMode: true });
    else void updateSettings({ testMode: false, backend: id as Settings["backend"] });
  };
  return (
    <Sheet open={open} onClose={close} title="Settings" labelledBy="settings-title">
      <div className="sheet-body thin">
        <section className="step">
          <div className="step-head">
            <h2>How renders are made</h2>
            <span className={`status ${st.tone}`} style={{ marginLeft: "auto", cursor: "default" }}>
              <span className="dot" />
              {st.label}
            </span>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {BACKENDS.map((b) => (
              <button key={b.id} type="button" className="fontopt" role="radio" aria-checked={current === b.id} onClick={() => pick(b.id)} style={{ alignItems: "flex-start", flexDirection: "column", gap: 2 }}>
                <b style={{ color: "var(--text)" }}>{b.label}</b>
                <small style={{ color: "var(--muted)" }}>{b.sub}</small>
              </button>
            ))}
          </div>
        </section>

        {current === "browser" ? (
          <section className="step">
            <h2 style={{ fontSize: 16 }}>Which site</h2>
            <div className="tabs3" role="radiogroup" aria-label="Site">
              {BROWSER_SITES.map((x) => (
                <button key={x.id} type="button" role="radio" aria-checked={s.browserSite === x.id} onClick={() => void updateSettings({ browserSite: x.id })}>
                  {x.label}
                </button>
              ))}
            </div>
            <p className="note">After Review, you copy the view and prompt into {BROWSER_SITES.find((x) => x.id === s.browserSite)?.label}, then paste the result back here with Ctrl V. It's saved to History with its prompt.</p>
          </section>
        ) : null}

        {current === "kie" ? (
          <section className="step">
            <div className="field">
              <label htmlFor="kie-key">Kie.ai API key</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input id="kie-key" className="input" type={show ? "text" : "password"} autoComplete="off" spellCheck={false} value={s.kieKey} onChange={(e) => void updateSettings({ kieKey: e.target.value })} placeholder="Paste your key" />
                <button type="button" className="btn" onClick={() => setShow(!show)}>{show ? "Hide" : "Show"}</button>
                <button type="button" className="btn primary" onClick={() => void checkKey()}>Test</button>
              </div>
              <small style={{ color: "var(--muted)" }}>
                Kept in this browser only. <a href={KIE_KEY_PAGE} target="_blank" rel="noreferrer">Get a key</a>. Images you render are uploaded to Kie.ai.
              </small>
            </div>
            <div className="field">
              <label htmlFor="kie-model">Model</label>
              <select id="kie-model" className="input" value={s.kieModel} onChange={(e) => void updateSettings({ kieModel: e.target.value })}>
                {KIE_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} · {priceText(m, s.kieResolution)} · {m.note}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid2">
              <div className="field">
                <span className="label">Resolution</span>
                <div className="tabs3" role="radiogroup" aria-label="Resolution">
                  {(["1K", "2K", "4K"] as KieResolution[]).map((r) => (
                    <button key={r} type="button" role="radio" aria-checked={s.kieResolution === r} disabled={!model.resolutions.includes(r)} onClick={() => void updateSettings({ kieResolution: r })}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field">
                <span className="label">Images per render</span>
                <div className="tabs2" style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))" }} role="radiogroup" aria-label="Images per render">
                  {[1, 2, 3, 4].map((n) => (
                    <button key={n} type="button" role="radio" aria-checked={s.imageCount === n} onClick={() => void updateSettings({ imageCount: n })}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {current === "gemini" ? (
          <section className="step">
            <div className="field">
              <label htmlFor="gem-key">Gemini API key</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input id="gem-key" className="input" type={show ? "text" : "password"} autoComplete="off" spellCheck={false} value={s.geminiKey} onChange={(e) => void updateSettings({ geminiKey: e.target.value })} placeholder="Paste your key" />
                <button type="button" className="btn" onClick={() => setShow(!show)}>{show ? "Hide" : "Show"}</button>
                <button type="button" className="btn primary" onClick={() => void checkKey()}>Test</button>
              </div>
              <small style={{ color: "var(--muted)" }}>
                From <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Google AI Studio</a>. Kept in this browser only; image generation is billed to the key's Google account.
              </small>
            </div>
            <div className="field">
              <label htmlFor="gem-model">Model</label>
              <input id="gem-model" className="input" value={s.geminiModel} onChange={(e) => void updateSettings({ geminiModel: e.target.value })} />
            </div>
          </section>
        ) : null}

        {current === "comfyui" ? (
          <section className="step">
            <div className="field">
              <label htmlFor="comfy-url">ComfyUI address</label>
              <input id="comfy-url" className="input" value={s.comfyUrl} onChange={(e) => void updateSettings({ comfyUrl: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="comfy-wf">Workflow (API JSON) with {"{{PROMPT}}"} and {"{{IMAGE_1}}"}</label>
              <textarea id="comfy-wf" className="input mono" rows={5} value={s.comfyWorkflow} onChange={(e) => void updateSettings({ comfyWorkflow: e.target.value })} />
            </div>
          </section>
        ) : null}

        <section className="step">
          <h2 style={{ fontSize: 16 }}>Look</h2>
          <div className="tabs2" role="radiogroup" aria-label="Look">
            <button type="button" role="radio" aria-checked={s.look === "photo"} onClick={() => void updateSettings({ look: "photo" })}>Photo</button>
            <button type="button" role="radio" aria-checked={s.look === "cgi"} onClick={() => void updateSettings({ look: "cgi" })}>3D render</button>
          </div>
          <label className="fontopt" style={{ cursor: "pointer" }}>
            <input type="checkbox" checked={s.materialLock} onChange={(e) => void updateSettings({ materialLock: e.target.checked })} style={{ accentColor: "var(--accent)" }} />
            <span style={{ flex: 1, textAlign: "left" }}>Material lock: keep every material exactly as modelled</span>
          </label>
          <label className="fontopt" style={{ cursor: "pointer" }}>
            <input type="checkbox" checked={s.boundaryLock} onChange={(e) => void updateSettings({ boundaryLock: e.target.checked })} style={{ accentColor: "var(--accent)" }} />
            <span style={{ flex: 1, textAlign: "left" }}>Boundary lock: improve realism only inside each material's own area</span>
          </label>
          <div className="field">
            <label htmlFor="avoid">Avoid (added to every render)</label>
            <textarea id="avoid" className="input" rows={2} value={s.avoid} onChange={(e) => void updateSettings({ avoid: e.target.value })} />
          </div>
        </section>

        <section className="step">
          <h2 style={{ fontSize: 16 }}>Moving from v1</h2>
          <p className="note" style={{ margin: 0 }}>Copies your presets, favourites and projects from the old version in this browser. v1 is not changed.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn" onClick={() => void importFromV1(false)}>
              <Icon name="download" /> Import from v1
            </button>
            <button type="button" className="btn ghost" onClick={() => void importFromV1(true)}>Import with keys</button>
          </div>
        </section>
      </div>
      <div className="sheet-foot">
        <small style={{ color: "var(--muted)" }}>v{getState().host.kind === "sketchup" ? "2 · SketchUp" : "2 beta"} · settings saved automatically</small>
        <div className="end">
          <button type="button" className="btn primary" onClick={close}>Done</button>
        </div>
      </div>
    </Sheet>
  );
}
