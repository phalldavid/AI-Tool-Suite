// Interior | Exterior lighting switch. Starts from the Scene chips; tapping one overrides it.
// A sliding thumb, an icon and a one-line description make the change visible.

import { useEffect, useRef, useState } from "react";
import { setState, useApp } from "../store";
import { editLightScene, effectiveLightScene } from "../actions";
import { Icon } from "./Icon";

const INFO = {
  interior: { icon: "sofa", label: "Interior lighting", desc: "Window light, ceiling, cove and pendant fittings, indoor and outdoor exposure balanced." },
  exterior: { icon: "house", label: "Exterior lighting", desc: "Sun and sky, facade and glass reflections, landscape and path lights." },
} as const;

/** edit: the Edit tab's own switch, which never follows or changes the Render tab. */
export function LightSceneSwitch({ info, edit }: { info?: boolean; edit?: boolean }) {
  useApp((s) => s.lightScene);
  useApp((s) => s.preset.projectType);
  useApp((s) => s.editScene);
  useApp((s) => s.versions[s.activeVersion]);
  const scene = edit ? editLightScene() : effectiveLightScene();
  const [flash, setFlash] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setFlash(true);
    const t = window.setTimeout(() => setFlash(false), 700);
    return () => window.clearTimeout(t);
  }, [scene]);
  return (
    <div className={`lss${info ? " with-info" : ""}${flash ? " flash" : ""}`}>
      <div className="lss-seg" role="radiogroup" aria-label={edit ? "Scene" : "Lighting for"} data-on={scene}>
        <span className="lss-thumb" aria-hidden="true" />
        {(["interior", "exterior"] as const).map((id) => (
          <button key={id} type="button" role="radio" aria-checked={scene === id} title={INFO[id].desc} onClick={() => setState(edit ? { editScene: id } : { lightScene: id })}>
            <Icon name={INFO[id].icon} size={14} />
            {id === "interior" ? "Interior" : "Exterior"}
          </button>
        ))}
      </div>
      {info ? (
        <p className="lss-info" aria-live="polite" key={scene}>
          <b>{INFO[scene].label}</b> · {INFO[scene].desc}
        </p>
      ) : null}
    </div>
  );
}
