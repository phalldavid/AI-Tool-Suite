// Interior | Exterior lighting switch. Starts from the Scene chips; tapping one overrides it.

import { setState, useApp } from "../store";
import { effectiveLightScene } from "../actions";

export function LightSceneSwitch({ compact }: { compact?: boolean }) {
  useApp((s) => s.lightScene);
  useApp((s) => s.preset.projectType);
  const scene = effectiveLightScene();
  return (
    <div className={`seg-mini${compact ? " compact" : ""}`} role="radiogroup" aria-label="Lighting for">
      {(["interior", "exterior"] as const).map((id) => (
        <button key={id} type="button" role="radio" aria-checked={scene === id} title={id === "interior" ? "Window light, ceiling and cove fittings, indoor balance" : "Sun, sky, facade reflections, landscape light"} onClick={() => setState({ lightScene: id })}>
          {id === "interior" ? "Interior" : "Exterior"}
        </button>
      ))}
    </div>
  );
}
