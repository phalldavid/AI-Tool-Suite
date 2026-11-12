// Light fittings: which ones, colour temperature, brightness, on or off. Adapts to Interior / Exterior.

import { getState, setState, useApp } from "../store";
import { effectiveLightScene } from "../actions";
import { KELVIN_OPTIONS, LEVELS, fittingsFor, saveFittings } from "../lib/fittings";
import type { FittingState } from "../lib/fittings";
import { Icon } from "./Icon";

export function Fittings() {
  useApp((s) => s.lightScene);
  useApp((s) => s.preset.projectType);
  const all = useApp((s) => s.fittings);
  const scene = effectiveLightScene();
  const f = all[scene];
  const set = (patch: Partial<FittingState>) => {
    const next = { ...getState().fittings, [scene]: { ...f, ...patch } };
    setState({ fittings: next });
    saveFittings(next);
  };
  return (
    <div className={`fitg${f.on ? "" : " off"}`} key={scene}>
      <div className="fitg-head">
        <b>{scene === "interior" ? "Interior fittings" : "Exterior fittings"}</b>
        <label className="switch" title={f.on ? "Lights on" : "Lights off"}>
          <input type="checkbox" checked={f.on} onChange={(e) => set({ on: e.target.checked })} />
          <span aria-hidden="true" />
          {f.on ? "On" : "Off"}
        </label>
      </div>
      <div className="chips-row">
        {fittingsFor(scene).map((x) => (
          <button key={x.id} type="button" className="chip qchip" aria-pressed={f.types.includes(x.id)} disabled={!f.on} onClick={() => set({ types: f.types.includes(x.id) ? f.types.filter((t) => t !== x.id) : [...f.types, x.id] })}>
            <Icon name={x.icon} size={13} /> {x.label}
          </button>
        ))}
      </div>
      <input className="input" disabled={!f.on} aria-label="Other light" placeholder="Other light, e.g. lanterns on the terrace" value={f.other} onChange={(e) => set({ other: e.target.value })} />
      <div className="kelvins" role="radiogroup" aria-label="Colour temperature">
        {KELVIN_OPTIONS.map((o) => (
          <button key={o.k} type="button" role="radio" aria-checked={f.kelvin === o.k} disabled={!f.on} title={o.label} onClick={() => set({ kelvin: o.k })}>
            <span className="kdot" style={{ background: o.sw }} />
            <b className="num">{o.k}K</b>
            <small>{o.label}</small>
          </button>
        ))}
      </div>
      <div className="levels">
        <span className="lbl">Brightness</span>
        <div className="seg-mini" role="radiogroup" aria-label="Brightness">
          {LEVELS.map((l, i) => (
            <button key={l} type="button" role="radio" aria-checked={f.level === i} disabled={!f.on} onClick={() => set({ level: i })}>{l}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
