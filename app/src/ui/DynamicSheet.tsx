// One Dynamic prompt form: fields left at "No change" stay out of the prompt.

import { useEffect, useState } from "react";
import { getState, setState, useApp } from "../store";
import { updateSettings } from "../actions";
import { findGenerator } from "../core/dynamic";
import type { DynValues } from "../core/dynamic";
import { Sheet } from "./Sheet";
import { Icon } from "./Icon";

export const DYN_ICONS: Record<string, string> = {
  time: "history",
  material: "pencil",
  vehicles: "map",
  people: "sofa",
  accessories: "bulb",
  plants: "sprout",
  camera: "scan",
  foreground: "house",
};

export function DynamicSheet() {
  const id = useApp((s) => s.dynOpen);
  const g = id ? findGenerator(id) : undefined;
  const [values, setValues] = useState<DynValues>({});
  useEffect(() => {
    if (id) setValues({ ...(getState().settings.dynamic[id] ?? {}) });
  }, [id]);
  const close = () => setState({ dynOpen: null });
  if (!g) return <Sheet open={false} onClose={close}>{null}</Sheet>;
  const save = async (v: DynValues) => {
    await updateSettings({ dynamic: { ...getState().settings.dynamic, [g.id]: v } });
    close();
  };
  const line = g.build(values);
  return (
    <Sheet
      open
      onClose={close}
      title={<span style={{ display: "flex", alignItems: "center", gap: 10 }}><Icon name={DYN_ICONS[g.id] ?? "sliders"} size={18} />{g.name}</span>}
      labelledBy="dyn-title"
      foot={
        <>
          <button type="button" className="btn ghost" onClick={() => setValues({})}><Icon name="trash" /> Reset</button>
          <div className="end">
            <button type="button" className="btn ghost" onClick={close}>Cancel</button>
            <button type="button" className="btn primary" onClick={() => void save(values)}><Icon name="check" /> Apply</button>
          </div>
        </>
      }
    >
      <div className="sheet-body thin">
        <p className="sub" style={{ margin: 0 }}>{g.blurb} Anything left at No change stays out of the prompt.</p>
        <div className="dyn-fields">
          {g.fields.map((f) => {
            if (f.kind === "text") {
              return (
                <div key={f.id} className="field">
                  <label htmlFor={`dyn-${f.id}`}>{f.label}</label>
                  <input id={`dyn-${f.id}`} className="input" maxLength={12} spellCheck={false} placeholder={f.placeholder} value={(values[f.id] as string) ?? ""} onChange={(e) => setValues({ ...values, [f.id]: e.target.value })} />
                  <small style={{ color: "var(--muted)" }}>Short plates (5 to 7 characters) come out best.</small>
                </div>
              );
            }
            if (f.kind === "one") {
              return (
                <div key={f.id} className={`field${f.half ? " half" : ""}`}>
                  <label htmlFor={`dyn-${f.id}`}>{f.label}</label>
                  <select id={`dyn-${f.id}`} className="input" value={(values[f.id] as string) ?? ""} onChange={(e) => setValues({ ...values, [f.id]: e.target.value })}>
                    {f.choices.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
              );
            }
            const chosen = Array.isArray(values[f.id]) ? (values[f.id] as string[]) : [];
            return (
              <div key={f.id} className="field full">
                <span className="lbl">{f.label}</span>
                <div className="chips-row">
                  {f.choices.map((c) => (
                    <button key={c.id} type="button" className="chip" aria-pressed={chosen.includes(c.id)} onClick={() => setValues({ ...values, [f.id]: chosen.includes(c.id) ? chosen.filter((x) => x !== c.id) : [...chosen, c.id] })}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="field">
          <span className="lbl">Adds to the prompt</span>
          <p className="note mono" style={{ margin: 0, minHeight: 44 }}>{line ?? "Nothing set yet."}</p>
        </div>
      </div>
    </Sheet>
  );
}
