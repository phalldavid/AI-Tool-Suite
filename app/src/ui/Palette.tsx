// Ctrl+K: one search across looks, light, places and actions (cmdk-style).

import { useEffect, useMemo, useRef, useState } from "react";
import { getState, setState, useApp } from "../store";
import { libraryItems, matchesWords, searchWords } from "../core/library";
import { previewFile } from "../core/preview-files";
import { LIGHTING } from "../core/prompt";
import { CONTEXT_GROUPS } from "../core/context";
import { clearView, lookPreset, openReview, pasteFromClipboard, updateSettings } from "../actions";
import { isLight, setPrefs } from "../prefs";
import { Sheet } from "./Sheet";
import { Icon } from "./Icon";

interface Item {
  group: string;
  label: string;
  sub: string;
  img?: string | null;
  swatch?: string;
  key?: string;
  run: () => void;
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
    const actions: Item[] = [
      { group: "Actions", label: "Render", sub: "Review the prompt and cost first", key: "R", run: go(() => void openReview()) },
      { group: "Actions", label: "Paste image", sub: "From the clipboard", key: "Ctrl V", run: go(() => void pasteFromClipboard()) },
      { group: "Actions", label: "Clear image", sub: "Start again with an empty view", run: go(clearView) },
      { group: "Actions", label: "Sun direction", sub: "Set the exact sun angle and height", run: go(() => setState({ tab: "sun" })) },
      { group: "Actions", label: "New view, same look", sub: "Edit tab: your screenshot or a new camera", run: go(() => setState((s) => ({ tab: "edit", editMode: "view", lookIndex: s.activeVersion }))) },
      { group: "Actions", label: "Browse all styles", sub: "The full style library", run: go(() => setState({ libOpen: "look" })) },
      { group: "Actions", label: "Browse environments", sub: "Street, river, rice fields and more", run: go(() => setState({ libOpen: "env" })) },
      { group: "Actions", label: "History", sub: "Every render with its prompt", run: go(() => setState({ tab: "history" })) },
      { group: "Actions", label: isLight() ? "Night mode" : "Day mode", sub: "Switch the theme", run: go(() => setPrefs({ theme: isLight() ? "dark" : "light" })) },
      { group: "Actions", label: "Settings", sub: "Keys, models, Prompt Copy", run: go(() => setState({ dialog: "settings" })) },
    ];
    const light: Item[] = LIGHTING.map((o) => ({
      group: "Lighting",
      label: o.label,
      sub: o.sub ?? "",
      swatch: o.swatch ? `linear-gradient(180deg, ${o.swatch[0]}, ${o.swatch[1]})` : undefined,
      run: go(() => setState({ lighting: o.id, tab: "render" })),
    }));
    const places: Item[] = CONTEXT_GROUPS.flatMap((g) =>
      g.items.map((c) => ({
        group: "Places",
        label: c.label,
        sub: g.label,
        run: go(() => setState((s) => ({ preset: { ...s.preset, environment: c.id }, tab: "render" }))),
      })),
    );
    const looks: Item[] = libraryItems().map((it) => ({
      group: "Looks",
      label: it.name,
      sub: `${it.projectType} · ${it.style.slice(0, 60)}…`,
      img: previewFile(it.id),
      run: go(() => setState({ preset: lookPreset(it.id), tab: "render" })),
    }));
    return [...actions, ...light, ...places, ...looks];
  }, [open]);
  const shown = useMemo(() => {
    const words = searchWords(q);
    if (!words.length) {
      const fav = favorites.slice(0, 4).map((id) => all.find((x) => x.group === "Looks" && lookPreset(id).name === x.label)).filter(Boolean) as Item[];
      return [...fav.map((x) => ({ ...x, group: "Starred" })), ...all.filter((x) => x.group === "Actions"), ...all.filter((x) => x.group === "Lighting").slice(0, 4)];
    }
    const hit = all.filter((x) => matchesWords(`${x.label} ${x.sub} ${x.group}`, words));
    const by = (g: string, n: number) => hit.filter((x) => x.group === g).slice(0, n);
    return [...by("Actions", 6), ...by("Lighting", 6), ...by("Places", 8), ...by("Looks", 30)];
  }, [q, all, favorites]);
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
              const head = it.group !== lastGroup ? <div className="group">{it.group}</div> : null;
              lastGroup = it.group;
              return (
                <div key={`${it.group}-${it.label}-${i}`}>
                  {head}
                  <div id={`pal-${i}`} data-i={i} className="opt" role="option" aria-selected={i === sel} onMouseMove={() => setSel(i)} onClick={() => it.run()}>
                    {it.img ? <img className="thumbimg" src={it.img} alt="" loading="lazy" /> : <span className="thumbimg" style={{ background: it.swatch ?? "var(--raised)" }} />}
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.label}</span>
                      <small style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.sub}</small>
                    </span>
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
