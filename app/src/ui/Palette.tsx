// Ctrl+K: one search across looks, light, places and actions (cmdk-style).

import { useEffect, useMemo, useRef, useState } from "react";
import { getState, setState, useApp } from "../store";
import { libraryItems, matchesWords, searchWords } from "../core/library";
import { previewFile } from "../core/preview-files";
import { LIGHTING } from "../core/prompt";
import { CONTEXT_GROUPS } from "../core/context";
import { clearEdit, clearView, download, lookPreset, openReview, pasteFromClipboard, updateSettings, useFile } from "../actions";
import { isLight, toggleTheme } from "../prefs";
import { toast } from "../toasts";
import { startTour } from "./Tour";
import { Sheet } from "./Sheet";
import { Icon } from "./Icon";

interface Item {
  group: string;
  label: string;
  sub: string;
  img?: string | null;
  swatch?: string;
  icon?: string;
  /** what picking it does: run an action, open a place, change a setting */
  kind?: "action" | "go" | "setting";
  key?: string;
  run: () => void;
}

const GROUP_ORDER = ["Starred", "Rendering", "Editing", "Lighting", "Workspace", "Appearance", "Light presets", "Places", "Looks"];

/** Wraps the searched words in <mark>. */
function Mark({ text, words }: { text: string; words: string[] }) {
  if (!words.length) return <>{text}</>;
  const re = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "ig");
  const parts = text.split(re);
  return <>{parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : <span key={i}>{p}</span>))}</>;
}

function pickFile(): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = () => {
    const f = input.files?.[0];
    if (f) void useFile(f, f.name);
  };
  input.click();
}

export function Palette() {
  const open = useApp((s) => s.dialog === "palette");
  const favorites = useApp((s) => s.settings.favorites);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const close = () => {
    setState({ dialog: null });
    setQ("");
    setSel(0);
  };
  const all = useMemo<Item[]>(() => {
    if (!open) return [];
    const go = (fn: () => void) => () => {
      close();
      fn();
    };
    const edit = (mode: "spot" | "relight" | "view" | "style") =>
      go(() => {
        if (!getState().versions.length) toast("Open or upload a render on the Edit tab first.", "warn");
        setState((s) => ({ tab: "edit", editMode: mode, lookIndex: mode === "view" ? s.activeVersion : s.lookIndex }));
      });
    const actions: Item[] = [
      { group: "Rendering", icon: "aperture", kind: "action", label: "Render", sub: "Review the prompt and cost first", key: "R", run: go(() => { setState({ tab: "render" }); void openReview(); }) },
      { group: "Rendering", icon: "clipboard", kind: "action", label: "Preview prompt", sub: "See the full prompt without spending anything", run: go(() => { setState({ tab: "render" }); void openReview(); }) },
      { group: "Rendering", icon: "camera", kind: "go", label: "Multi-View", sub: "Same look, new angle: screenshot or 3D camera", run: edit("view") },
      { group: "Rendering", icon: "layers", kind: "go", label: "Reference Style Copy", sub: "Copy materials and light from a reference photo", run: edit("style") },
      { group: "Rendering", icon: "grid", kind: "go", label: "Browse all styles", sub: "The full style library", run: go(() => setState({ tab: "render", libOpen: "look" })) },
      { group: "Rendering", icon: "map", kind: "go", label: "Browse environments", sub: "Street, river, rice fields and more", run: go(() => setState({ tab: "render", libOpen: "env" })) },
      { group: "Editing", icon: "brush", kind: "go", label: "Spot edit", sub: "Paint an area: add LED, change material, remove furniture", run: edit("spot") },
      { group: "Editing", icon: "sun", kind: "go", label: "Relight", sub: "Same image, new time of day", run: edit("relight") },
      { group: "Editing", icon: "trash", kind: "action", label: "Clear image", sub: "Empty the Render view, or the Edit tab when you're on it", run: go(() => (getState().tab === "edit" ? clearEdit() : clearView())) },
      { group: "Lighting", icon: "sofa", kind: "setting", label: "Interior lighting", sub: "Window light, ceiling, cove and pendant fittings", run: go(() => setState({ lightScene: "interior" })) },
      { group: "Lighting", icon: "house", kind: "setting", label: "Exterior lighting", sub: "Sun, sky, facade and landscape lights", run: go(() => setState({ lightScene: "exterior" })) },
      { group: "Lighting", icon: "sun", kind: "go", label: "Sun direction", sub: "Set the exact sun angle and height", run: go(() => setState({ tab: "sun" })) },
      { group: "Lighting", icon: "moon", kind: "setting", label: "Night render", sub: "Dark sky, every light on", run: go(() => setState({ lighting: "night", tab: "render" })) },
      { group: "Workspace", icon: "clipboard", kind: "action", label: "Paste image", sub: "From the clipboard", key: "Ctrl V", run: go(() => void pasteFromClipboard()) },
      { group: "Workspace", icon: "image", kind: "action", label: "Upload image", sub: "From your computer", run: go(pickFile) },
      { group: "Workspace", icon: "download", kind: "action", label: "Download render", sub: "The version open on the Edit tab", run: go(() => { const st = getState(); const v = st.versions[st.activeVersion]; if (v) void download(v.image, `render-v${st.activeVersion + 1}`); else toast("Nothing to download yet.", "warn"); }) },
      { group: "Workspace", icon: "history", kind: "go", label: "History", sub: "Every render with its prompt", key: "3", run: go(() => setState({ tab: "history" })) },
      { group: "Workspace", icon: "settings", kind: "go", label: "Settings", sub: "Keys, models, Prompt Copy", run: go(() => setState({ dialog: "settings" })) },
      { group: "Appearance", icon: isLight() ? "moon" : "sun", kind: "setting", label: isLight() ? "Night mode" : "Day mode", sub: "Switch the theme", run: go(() => toggleTheme()) },
      { group: "Workspace", icon: "info", kind: "go", label: "Tutorial", sub: "The one-minute tour of the app", run: go(() => startTour(true)) },
      { group: "Appearance", icon: "palette", kind: "go", label: "Customise", sub: "Accent colour, font, moving background", run: go(() => setState({ customiseOpen: true })) },
    ];
    const light: Item[] = LIGHTING.map((o) => ({
      group: "Light presets",
      kind: "setting" as const,
      label: o.label,
      sub: o.sub ?? "",
      swatch: o.swatch ? `linear-gradient(180deg, ${o.swatch[0]}, ${o.swatch[1]})` : undefined,
      run: go(() => setState({ lighting: o.id, tab: "render" })),
    }));
    const places: Item[] = CONTEXT_GROUPS.flatMap((g) =>
      g.items.map((c) => ({
        group: "Places",
        kind: "setting" as const,
        icon: "map",
        label: c.label,
        sub: g.label,
        run: go(() => setState((s) => ({ preset: { ...s.preset, environment: c.id }, tab: "render" }))),
      })),
    );
    const looks: Item[] = libraryItems().map((it) => ({
      group: "Looks",
      kind: "setting" as const,
      label: it.name,
      sub: `${it.projectType} · ${it.style.slice(0, 60)}…`,
      img: previewFile(it.id),
      run: go(() => setState({ preset: lookPreset(it.id), tab: "render" })),
    }));
    return [...actions, ...light, ...places, ...looks];
  }, [open]);
  const words = useMemo(() => searchWords(q), [q]);
  const shown = useMemo(() => {
    const ACTION_GROUPS = ["Rendering", "Editing", "Lighting", "Workspace", "Appearance"];
    if (!words.length) {
      const fav = favorites.slice(0, 4).map((id) => all.find((x) => x.group === "Looks" && lookPreset(id).name === x.label)).filter(Boolean) as Item[];
      return [...fav.map((x) => ({ ...x, group: "Starred" })), ...all.filter((x) => ACTION_GROUPS.includes(x.group))];
    }
    const hit = all.filter((x) => matchesWords(`${x.label} ${x.sub} ${x.group}`, words));
    const by = (g: string, n: number) => hit.filter((x) => x.group === g).slice(0, n);
    return GROUP_ORDER.flatMap((g) => by(g, g === "Looks" ? 30 : g === "Places" ? 8 : 6));
  }, [words, all, favorites]);
  useEffect(() => setSel(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${sel}"]`)?.scrollIntoView({ block: "nearest" });
  }, [sel]);
  let lastGroup = "";
  return (
    <Sheet open={open} onClose={close} className="palette">
      {open ? (
        <>
          <div className="q">
            <Icon name="search" size={18} style={{ color: "var(--muted)" }} />
            <label htmlFor="pal-q" className="sr-only">Search</label>
            <input
              id="pal-q"
              autoFocus
              autoComplete="off"
              placeholder="Search looks, light, places, actions"
              value={q}
              role="combobox"
              aria-expanded="true"
              aria-controls="pal-list"
              aria-activedescendant={`pal-${sel}`}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSel((i) => Math.min(shown.length - 1, i + 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSel((i) => Math.max(0, i - 1));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  shown[sel]?.run();
                }
              }}
            />
            <span className="kbd">Esc</span>
          </div>
          <div className="list thin" id="pal-list" role="listbox" aria-label="Results" ref={listRef}>
            {shown.length === 0 ? <div className="empty" style={{ padding: 28 }}>No match. Try “monsoon”, “borey” or “render”.</div> : null}
            {shown.map((it, i) => {
              const head = it.group !== lastGroup ? <div className={`group${lastGroup ? " sep" : ""}`}>{it.group}</div> : null;
              lastGroup = it.group;
              return (
                <div key={`${it.group}-${it.label}-${i}`}>
                  {head}
                  <div id={`pal-${i}`} data-i={i} className="opt" role="option" aria-selected={i === sel} onMouseMove={() => setSel(i)} onClick={() => it.run()}>
                    {it.img ? (
                      <img className="thumbimg" src={it.img} alt="" loading="lazy" />
                    ) : it.icon ? (
                      <span className="thumbimg icon"><Icon name={it.icon} size={16} /></span>
                    ) : (
                      <span className="thumbimg" style={{ background: it.swatch ?? "var(--raised)" }} />
                    )}
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}><Mark text={it.label} words={words} /></span>
                      <small style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}><Mark text={it.sub} words={words} /></small>
                    </span>
                    {it.kind === "go" ? <span className="okind">Open</span> : it.kind === "setting" ? <span className="okind">Set</span> : null}
                    {it.key ? <span className="kbd">{it.key}</span> : null}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="foot">
            <span>↑ ↓ move</span>
            <span>Enter apply</span>
            <span style={{ marginLeft: "auto" }}>932 looks · {LIGHTING.length} lights</span>
          </div>
        </>
      ) : null}
    </Sheet>
  );
}

export function togglePalette(): void {
  setState({ dialog: getState().dialog === "palette" ? null : "palette" });
}

void updateSettings;
