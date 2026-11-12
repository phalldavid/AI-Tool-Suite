// "Browse all": the old app's style library (category → building or room → style)
// and the environment list (grouped, pick several).

import { useEffect, useMemo, useState } from "react";
import { setState, useApp } from "../store";
import { lookPreset, updateSettings } from "../actions";
import { AERIAL_LOOKS, AERIAL_TYPES, EXT_STYLES, EXT_TYPES, INT_STYLES, ROOMS, filterLibrary, libraryItems } from "../core/library";
import type { LibItem } from "../core/library";
import { CONTEXT_GROUPS, joinContexts, parseContexts } from "../core/context";
import { previewFile } from "../core/preview-files";
import type { ProjectType } from "../core/types";
import { Sheet } from "./Sheet";
import { Icon } from "./Icon";
import { useEnvTiles } from "./EnvPicturesSheet";
import { useLookTiles } from "./EnvPicturesSheet";
import { envMadeCount, envPicture } from "../lib/envPreviews";
import { lookTile } from "../lib/lookPreviews";
import { useDev } from "../lib/dev";

/** A look card's picture: shipped with the app, else made on this computer. */
function lookPic(x: LibItem): string | null {
  return previewFile(x.id) ?? lookTile(x);
}

const CATS: { id: ProjectType; label: string }[] = [
  { id: "exterior", label: "Exterior" },
  { id: "interior", label: "Interior" },
  { id: "aerial", label: "Aerial" },
  { id: "sketch", label: "Sketch" },
];

type Level = { type: "home" } | { type: ProjectType; subject: string };

function subjectsOf(type: ProjectType): { id: string; label: string; group?: string }[] {
  return type === "exterior" ? EXT_TYPES : type === "interior" ? ROOMS : type === "aerial" ? AERIAL_TYPES : [];
}

function styleName(x: LibItem): string {
  const styles: { id: string; label: string }[] = x.projectType === "exterior" ? EXT_STYLES : x.projectType === "interior" ? INT_STYLES : x.projectType === "aerial" ? AERIAL_LOOKS : [];
  return styles.find((s) => s.id === x.styleId)?.label ?? x.name;
}

/** A picture for a folder card: the first style in it that has a preview. */
function folderPic(type: ProjectType, subject: string | null): string | null {
  for (const x of libraryItems()) {
    if (x.projectType !== type || (subject ? x.subjectId !== subject : false)) continue;
    const p = lookPic(x);
    if (p) return p;
  }
  return null;
}

export function LibrarySheet() {
  const open = useApp((s) => s.libOpen);
  const close = () => setState({ libOpen: null });
  return (
    <Sheet open={open === "look" || open === "env"} onClose={close} className="lib">
      {open === "look" ? <LookBrowser close={close} /> : open === "env" ? <EnvBrowser close={close} /> : null}
    </Sheet>
  );
}

function Card({ label, sub, pic, on, onClick, colors }: { label: string; sub?: string; pic: string | null; on?: boolean; onClick: () => void; colors?: string[] }) {
  return (
    <button type="button" className="look lift lib-card" aria-pressed={Boolean(on)} title={label} onClick={onClick}>
      {pic ? <img src={pic} alt="" loading="lazy" /> : <span className="noimg" style={colors?.length ? { background: `linear-gradient(135deg, ${colors.join(", ")})`, color: "#fff" } : undefined}>{colors?.length ? "" : label}</span>}
      <span className="name">
        {label}
        {sub ? <small>{sub}</small> : null}
      </span>
      {on ? (
        <span className="tick">
          <Icon name="check" size={12} stroke={3.2} />
        </span>
      ) : null}
    </button>
  );
}

function LookBrowser({ close }: { close: () => void }) {
  useLookTiles();
  const dev = useDev();
  const [words, setWords] = useState("");
  const preset = useApp((s) => s.preset);
  const favorites = useApp((s) => s.settings.favorites);
  const [level, setLevel] = useState<Level>(() => (preset.projectType === "sketch" ? { type: "sketch", subject: "all" } : { type: preset.projectType, subject: "all" }));
  const [q, setQ] = useState("");
  const current = libraryItems().find((x) => x.id === preset.id);
  const [picked, setPicked] = useState<string>(preset.id);
  const apply = () => {
    const x = libraryItems().find((i) => i.id === picked);
    const own = words.trim();
    if (x) {
      setState((s) => {
        const base = lookPreset(x.id);
        return { preset: { ...base, style: own ? `${base.style}, ${own}` : base.style, lighting: s.preset.lighting, environment: x.projectType === s.preset.projectType ? s.preset.environment : x.environment } };
      });
    } else if (own) setState((s) => ({ preset: { ...s.preset, style: `${s.preset.style}, ${own}` } }));
    close();
  };
  const use = (x: LibItem) => setPicked(x.id);
  const star = (id: string) => void updateSettings({ favorites: favorites.includes(id) ? favorites.filter((x) => x !== id) : [id, ...favorites] });

  let title = "Browse all";
  let back: (() => void) | null = null;
  let body: React.ReactNode;
  const typed = q.trim();
  if (typed) {
    const list = filterLibrary("exterior", "all", "all", typed).slice(0, 240);
    body = list.length ? <div className="lib-grid">{list.map((x) => <StyleCell key={x.id} x={x} on={x.id === picked} fav={favorites.includes(x.id)} onUse={use} onStar={star} />)}</div> : <p className="note">Nothing matches. Try a room, a building or a style, e.g. kitchen, villa, Khmer.</p>;
  } else if (level.type === "home") {
    body = (
      <div className="lib-grid big">
        {CATS.map((c) => (
          <Card key={c.id} label={c.label} sub={`${libraryItems().filter((x) => x.projectType === c.id).length} styles`} pic={folderPic(c.id, null)} on={preset.projectType === c.id} onClick={() => setLevel({ type: c.id, subject: "all" })} />
        ))}
        <Card label="Starred" sub={`${favorites.length} saved`} pic={favorites[0] ? previewFile(favorites[0]) : null} onClick={() => setLevel({ type: "exterior", subject: "starred" })} />
      </div>
    );
  } else {
    const type = level.type;
    const cat = CATS.find((c) => c.id === type)!.label;
    back = () => setLevel(level.subject === "all" || type === "sketch" ? { type: "home" } : { type, subject: "all" });
    if (level.subject === "starred") {
      title = "Starred";
      back = () => setLevel({ type: "home" });
      const list = favorites.map((id) => libraryItems().find((x) => x.id === id)).filter((x): x is LibItem => Boolean(x));
      body = list.length ? <div className="lib-grid">{list.map((x) => <StyleCell key={x.id} x={x} on={x.id === picked} fav onUse={use} onStar={star} />)}</div> : <p className="note">Nothing starred yet. Tap the star on any style to keep it here and first in the Look row.</p>;
    } else if (type === "sketch" || level.subject !== "all") {
      const subj = subjectsOf(type).find((s) => s.id === level.subject);
      title = type === "sketch" ? cat : `${cat} · ${subj?.label ?? ""}`;
      const list = type === "sketch" ? filterLibrary("sketch", "all", "all") : filterLibrary(type, "all", level.subject);
      body = <div className="lib-grid">{list.map((x) => <StyleCell key={x.id} x={x} label={type === "sketch" ? undefined : styleName(x)} on={x.id === picked} fav={favorites.includes(x.id)} onUse={use} onStar={star} />)}</div>;
    } else {
      title = cat;
      const subjects = subjectsOf(type);
      const groups = [...new Set(subjects.map((s) => s.group ?? ""))];
      const featured = filterLibrary(type, "featured", "featured");
      body = (
        <>
          {groups.map((g) => (
            <section key={g || "all"} className="lib-group">
              {g ? <h3>{g}</h3> : null}
              <div className="lib-grid big">
                {subjects.filter((s) => (s.group ?? "") === g).map((s) => (
                  <Card key={s.id} label={s.label} pic={folderPic(type, s.id)} on={current?.subjectId === s.id && current.projectType === type} onClick={() => setLevel({ type, subject: s.id })} />
                ))}
              </div>
            </section>
          ))}
          {featured.length ? (
            <section className="lib-group">
              <h3>Featured</h3>
              <div className="lib-grid">{featured.map((x) => <StyleCell key={x.id} x={x} on={x.id === picked} fav={favorites.includes(x.id)} onUse={use} onStar={star} />)}</div>
            </section>
          ) : null}
        </>
      );
    }
  }
  return (
    <>
      <div className="sheet-head">
        {back && !typed ? (
          <button type="button" className="icon-btn" aria-label="Back" onClick={back}>
            <Icon name="back" />
          </button>
        ) : null}
        <h2>{typed ? "Search" : title}</h2>
        <button type="button" className="icon-btn close" aria-label="Close" onClick={close}>
          <Icon name="close" />
        </button>
      </div>
      <div className="lib-search">
        <Icon name="search" />
        <input type="search" className="input" placeholder="Search, e.g. kitchen, shophouse, Khmer" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search styles" autoFocus />
      </div>
      <div className="sheet-body thin">{body}</div>
      <div className="sheet-foot lib-foot">
        <input className="input own" value={words} onChange={(e) => setWords(e.target.value)} placeholder="Your own words (optional), e.g. darker timber, more glass" aria-label="Your own words for the look" />
        {dev ? (
          <button type="button" className="btn ghost" title="Developer: make or update the pictures" onClick={() => setState({ libOpen: "look-pics" })}>
            <Icon name="image" /> Pictures
          </button>
        ) : null}
        <div className="end">
          <button type="button" className="btn primary big" onClick={apply}>
            <Icon name="check" /> Use
          </button>
        </div>
      </div>
    </>
  );
}

function StyleCell({ x, label, on, fav, onUse, onStar }: { x: LibItem; label?: string; on: boolean; fav: boolean; onUse: (x: LibItem) => void; onStar: (id: string) => void }) {
  return (
    <div style={{ position: "relative" }}>
      <Card label={label ?? x.name} pic={lookPic(x)} colors={x.colors} on={on} onClick={() => onUse(x)} />
      <button type="button" className={`look-star${fav ? " on" : ""}`} aria-pressed={fav} aria-label={fav ? `Unstar ${x.name}` : `Star ${x.name}`} onClick={() => onStar(x.id)}>
        <Icon name="star" size={13} />
      </button>
    </div>
  );
}

function EnvBrowser({ close }: { close: () => void }) {
  useEnvTiles();
  const dev = useDev();
  const preset = useApp((s) => s.preset);
  const [picks, setPicks] = useState<string[]>(() => parseContexts(preset.environment));
  const [own, setOwn] = useState("");
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<string | null>(null);
  useEffect(() => setPicks(parseContexts(preset.environment)), [preset.environment]);
  const typed = q.trim().toLowerCase();
  const found = useMemo(
    () => (typed ? CONTEXT_GROUPS.flatMap((g) => g.items.filter((i) => `${i.label} ${i.sub} ${i.text} ${g.label}`.toLowerCase().includes(typed)).map((i) => ({ i, g }))) : []),
    [typed],
  );
  const toggle = (id: string) => setPicks((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const apply = (list: string[]) => {
    const all = own.trim() ? [...list, `custom:${own.trim()}`] : list;
    setState((s) => ({ preset: { ...s.preset, environment: joinContexts(all) } }));
    close();
  };
  const g = CONTEXT_GROUPS.find((x) => x.id === group);
  const hero = (gid: string) => {
    const gr = CONTEXT_GROUPS.find((x) => x.id === gid)!;
    for (const i of gr.items) {
      const p = envPicture(i.id);
      if (p) return p;
    }
    return null;
  };
  let body: React.ReactNode;
  if (typed) {
    body = found.length ? (
      <div className="lib-grid">
        {found.map(({ i, g: gr }) => <Card key={i.id} label={i.label} sub={i.sub} pic={envPicture(i.id)} colors={gr.colors} on={picks.includes(i.id)} onClick={() => toggle(i.id)} />)}
      </div>
    ) : (
      <p className="note">Nothing matches. Try river, borey, pagoda or Kampot.</p>
    );
  } else if (!g) {
    body = (
      <div className="lib-grid big">
        {CONTEXT_GROUPS.map((gr) => {
          const n = gr.items.filter((i) => picks.includes(i.id)).length;
          return <Card key={gr.id} label={gr.label} sub={n ? `${n} picked · ${gr.items.length} places` : `${gr.items.length} places`} pic={hero(gr.id)} colors={gr.colors} on={n > 0} onClick={() => setGroup(gr.id)} />;
        })}
      </div>
    );
  } else {
    body = (
      <div className="lib-grid">
        {g.items.map((i) => <Card key={i.id} label={i.label} sub={i.sub} pic={envPicture(i.id)} colors={g.colors} on={picks.includes(i.id)} onClick={() => toggle(i.id)} />)}
      </div>
    );
  }
  return (
    <>
      <div className="sheet-head">
        {g && !typed ? (
          <button type="button" className="icon-btn" aria-label="Back" onClick={() => setGroup(null)}>
            <Icon name="back" />
          </button>
        ) : null}
        <h2>{typed ? "Search" : g ? g.label : "Environment"}</h2>
        <button type="button" className="icon-btn close" aria-label="Close" onClick={close}>
          <Icon name="close" />
        </button>
      </div>
      <div className="lib-search">
        <Icon name="search" />
        <input type="search" className="input" placeholder="Search, e.g. river, rice field, Kampot" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search environments" />
      </div>
      <div className="sheet-body thin">{body}</div>
      <div className="sheet-foot lib-foot">
        <input className="input own" value={own} onChange={(e) => setOwn(e.target.value)} placeholder="Your own words (optional), e.g. next to a pagoda" aria-label="Your own words for the environment" />
        {dev ? (
          <button type="button" className="btn ghost" title="Developer: make or update the pictures" onClick={() => setState({ libOpen: "env-pics" })}>
            <Icon name="image" /> Pictures · {envMadeCount()}/36
          </button>
        ) : null}
        <small className="count">{picks.length ? `${picks.length} picked` : "Nothing picked"}</small>
        <div className="end">
          <button type="button" className="btn ghost" onClick={() => apply([])} title="Keep the surroundings as modelled">As modelled</button>
          <button type="button" className="btn primary big" onClick={() => apply(picks)}>
            <Icon name="check" /> Use
          </button>
        </div>
      </div>
    </>
  );
}
