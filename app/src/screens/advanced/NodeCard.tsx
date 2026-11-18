// One node on the canvas: header (drag handle), ports, and its settings.

import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { NODE_DEFS, lookFor, updateSettings } from "../../core/graph";
import { resultKey } from "../../core/graph";
import type { GraphNode, NodeOutput, PortDef, PromptItem, RenderJob, SettingsByKind } from "../../core/graph";
import { useApp } from "../../store";
import { thumbFor } from "../../lib/thumbs";
import type { ImageData64 } from "../../core/types";
import type { JobStatus } from "./session";
import { useCanvas } from "./session";
import { libraryItems, findLibraryItem, matchesWords, searchWords } from "../../core/library";
import { CONTEXT_GROUPS, contextLabel, joinContexts, parseContexts } from "../../core/context";
import { LIGHTING, dialTimeId, parseDialTime } from "../../core/prompt";
import { previewFile } from "../../core/preview-files";
import { lookTile } from "../../lib/lookPreviews";
import { openPicker } from "../../lib/pickTarget";
import { SunDial, fmtHour } from "../SunDial";
import { EXTERIOR_FITTINGS, INTERIOR_FITTINGS, KELVIN_OPTIONS, LEVELS } from "../../lib/fittings";
import { Icon } from "../../ui/Icon";
import { toast } from "../../toasts";
import { commit, endTypingRun, getCanvas, graph, select } from "./session";
import type { Pending, Picture } from "./session";
import { HEADER_H, PORT_GAP, PORT_TOP, nodeWidth, portsHeight } from "./geometry";
import { S } from "./strings";

export interface PortHandlers {
  headerDown: (e: React.PointerEvent, id: string) => void;
  outDown: (e: React.PointerEvent, node: string, port: string) => void;
  portClick: (e: React.MouseEvent, node: string, port: string, side: "in" | "out") => void;
  portKey: (e: React.KeyboardEvent, node: string, port: string, side: "in" | "out") => void;
  remove: (id: string) => void;
  choosePicture: (id: string, file: File) => void;
}

interface Props {
  node: GraphNode;
  output: NodeOutput | undefined;
  selected: boolean;
  dx: number;
  dy: number;
  picture: Picture | undefined;
  pending: Pending | null;
  /** This node's input ports that already have a wire, "port|port". */
  wiredIn: string;
  ui: PortHandlers;
}

const NAMES: Record<string, string> = {
  image: S.image,
  look: S.look,
  light: S.light,
  surroundings: S.surroundings,
  fittings: S.fittings,
  prompt: S.prompt,
  note: S.note,
  render: S.render,
  result: S.result,
};

function set<K extends GraphNode["kind"]>(id: string, patch: Partial<SettingsByKind[K]>, key: string | null = null): void {
  commit(updateSettings<K>(graph(), id, patch), key);
}

export const NodeCard = memo(function NodeCard({ node, output, selected, dx, dy, picture, pending, wiredIn, ui }: Props) {
  const def = NODE_DEFS[node.kind];
  const name = NAMES[node.kind];
  const w = nodeWidth(node.kind);
  const port = (p: PortDef, side: "in" | "out", i: number) => {
    const wired = side === "in" && wiredIn.split("|").includes(p.id);
    const isPending = pending && pending.node === node.id && pending.port === p.id && pending.side === side;
    const target = pending && pending.side !== side && pending.node !== node.id;
    return (
      <button
        key={`${side}-${p.id}`}
        type="button"
        className={`gport ${side} t-${p.type}${wired ? " wired" : ""}${isPending ? " pending" : ""}${target ? " target" : ""}`}
        style={{ top: PORT_TOP - HEADER_H + i * PORT_GAP - 9 }}
        data-port-in={side === "in" ? `${node.id}:${p.id}` : undefined}
        data-port-out={side === "out" ? `${node.id}:${p.id}` : undefined}
        aria-label={p.label}
        title={p.label}
        aria-pressed={Boolean(isPending)}
        onPointerDown={(e) => {
          // The middle button still pans the canvas over a port.
          if (e.button !== 0) return;
          e.stopPropagation();
          if (side === "out") ui.outDown(e, node.id, p.id);
        }}
        onClick={(e) => ui.portClick(e, node.id, p.id, side)}
        onKeyDown={(e) => ui.portKey(e, node.id, p.id, side)}
      />
    );
  };
  return (
    <div
      className={`gnode k-${node.kind}${selected ? " sel" : ""}`}
      style={{ width: w, transform: `translate(${node.x + dx}px, ${node.y + dy}px)` }}
      data-node-id={node.id}
      data-kind={node.kind}
      tabIndex={0}
      role="group"
      aria-label={name}
      onFocus={() => {
        if (!getCanvas().selected.includes(node.id)) select([node.id]);
      }}
    >
      <div className="gnode-head" onPointerDown={(e) => ui.headerDown(e, node.id)}>
        <span className="gnode-title">{name}</span>
        <button type="button" className="gnode-x" aria-label={S.deleteNode} title={S.deleteNode} onPointerDown={(e) => e.button === 0 && e.stopPropagation()} onClick={() => ui.remove(node.id)}>
          <Icon name="close" size={14} />
        </button>
      </div>
      {def.inputs.length || def.outputs.length ? (
        <div className="gnode-ports" style={{ height: portsHeight(node.kind) }}>
          {def.inputs.map((p, i) => (
            <span key={`li-${p.id}`} className="gport-label in" style={{ top: PORT_TOP - HEADER_H + i * PORT_GAP - 9 }}>{p.label}</span>
          ))}
          {def.outputs.map((p, i) => (
            <span key={`lo-${p.id}`} className="gport-label out" style={{ top: PORT_TOP - HEADER_H + i * PORT_GAP - 9 }}>{p.label}</span>
          ))}
          {def.inputs.map((p, i) => port(p, "in", i))}
          {def.outputs.map((p, i) => port(p, "out", i))}
        </div>
      ) : null}
      <div className="gnode-body">
        <Body node={node} output={output} picture={picture} ui={ui} />
      </div>
    </div>
  );
});

export function Body({ node, output, picture, ui }: { node: GraphNode; output: NodeOutput | undefined; picture: Picture | undefined; ui: PortHandlers }) {
  switch (node.kind) {
    case "image":
      return <ImageBody node={node as GraphNode<"image">} picture={picture} ui={ui} />;
    case "look":
      return <LookBody node={node as GraphNode<"look">} />;
    case "light":
      return <LightBody node={node as GraphNode<"light">} />;
    case "surroundings":
      return <SurroundingsBody node={node as GraphNode<"surroundings">} />;
    case "fittings":
      return <FittingsBody node={node as GraphNode<"fittings">} />;
    case "prompt":
      return <PromptBody node={node as GraphNode<"prompt">} items={(output?.ports.prompts as PromptItem[] | undefined) ?? []} />;
    case "render":
      return <RenderBody jobs={(output?.ports.results as RenderJob[] | undefined) ?? []} />;
    case "result":
      return <ResultBody jobs={(output?.ports.shown as RenderJob[] | undefined) ?? []} />;
    case "note":
      return (
        <textarea
          className="input gscroll"
          rows={4}
          value={(node.settings as SettingsByKind["note"]).text}
          placeholder={S.notePlaceholder}
          aria-label={S.note}
          onChange={(e) => set<"note">(node.id, { text: e.target.value }, `text:${node.id}`)}
          onBlur={endTypingRun}
        />
      );
  }
  return null;
}

function ImageBody({ node, picture, ui }: { node: GraphNode<"image">; picture: Picture | undefined; ui: PortHandlers }) {
  const input = useRef<HTMLInputElement>(null);
  const guess = lookFor(node.settings.name, {}).preset.name;
  return (
    <>
      <div className="gthumb">
        {picture ? <img src={picture.thumb} alt="" /> : <span>{node.settings.name ? S.notLoaded : S.noPicture}</span>}
      </div>
      <button type="button" className="btn ghost gsmall" onClick={() => input.current?.click()}>
        <Icon name="image" size={14} />
        {picture ? S.replacePicture : S.choosePicture}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const f = e.target.files?.[0];
          if (f) ui.choosePicture(node.id, f);
          e.target.value = "";
        }}
      />
      <label className="gfield">
        <span>{S.fileName}</span>
        <input
          className="input"
          value={node.settings.name}
          data-no-translate
          onChange={(e) => set<"image">(node.id, { name: e.target.value.slice(0, 200) }, `name:${node.id}`)}
          onBlur={endTypingRun}
        />
      </label>
      <p className="gmuted">
        <span>{S.fromName}</span>: <b data-no-translate>{guess}</b>
      </p>
    </>
  );
}

function LookBody({ node }: { node: GraphNode<"look"> }) {
  const [q, setQ] = useState("");
  const picked = node.settings.presetId ? findLibraryItem(node.settings.presetId) : undefined;
  const hits = useMemo(() => {
    const words = searchWords(q);
    if (!words.length) return [];
    return libraryItems()
      .filter((x) => matchesWords(`${x.name} ${x.style}`, words))
      .slice(0, 8);
  }, [q]);
  return (
    <>
      {picked ? (
        <>
          <LookPicture id={picked.id} />
          <div className="gpicked">
            <b data-no-translate>{picked.name}</b>
            <button type="button" className="linkish" onClick={() => set<"look">(node.id, { presetId: null })}>{S.clearLook}</button>
          </div>
        </>
      ) : (
        <p className="gmuted">{S.noLook}</p>
      )}
      <button
        type="button"
        className="btn gsmall"
        onClick={() => openPicker({ kind: "look", current: node.settings.presetId ?? "", onPick: (id) => set<"look">(node.id, { presetId: id }) })}
      >
        <Icon name="grid" size={14} />
        {S.browseLooks}
      </button>
      <input className="input" value={q} placeholder={S.searchLooks} aria-label={S.searchLooks} onChange={(e) => setQ(e.target.value)} />
      {q.trim() ? (
        <div className="glist gscroll" role="listbox" aria-label={S.searchLooks}>
          {hits.length ? (
            hits.map((x) => (
              <button
                key={x.id}
                type="button"
                role="option"
                aria-selected={x.id === node.settings.presetId}
                data-no-translate
                onClick={() => {
                  set<"look">(node.id, { presetId: x.id });
                  setQ("");
                }}
              >
                {x.name}
              </button>
            ))
          ) : (
            <span className="gmuted">{S.noMatch}</span>
          )}
        </div>
      ) : null}
    </>
  );
}

function LightBody({ node }: { node: GraphNode<"light"> }) {
  const s = node.settings;
  const dial = parseDialTime(s.lighting);
  const known = dial !== null || LIGHTING.some((o) => o.id === s.lighting);
  return (
    <>
      <label className="gfield">
        <span>{S.timeOfDay}</span>
        <select
          className="input"
          value={dial !== null ? "dial" : s.lighting}
          onChange={(e) => set<"light">(node.id, { lighting: e.target.value === "dial" ? dialTimeId(16.5) : e.target.value })}
        >
          {known ? null : <option value={s.lighting}>{s.lighting}</option>}
          <option value="dial">{S.sunDial}</option>
          {LIGHTING.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      </label>
      {dial !== null ? (
        <div className="gdial">
          <SunDial id={`dial-${node.id}`} hour={dial} onHour={(h) => set<"light">(node.id, { lighting: dialTimeId(h) }, `dial:${node.id}`)} />
          <span className="gmuted num" data-no-translate>{fmtHour(dial)}</span>
        </div>
      ) : null}
      <label className="gfield">
        <span>{S.lightFor}</span>
        <select className="input" value={s.scene} onChange={(e) => set<"light">(node.id, { scene: e.target.value as SettingsByKind["light"]["scene"] })}>
          <option value="auto">{S.followLook}</option>
          <option value="interior">{S.interior}</option>
          <option value="exterior">{S.exterior}</option>
        </select>
      </label>
    </>
  );
}

function SurroundingsBody({ node }: { node: GraphNode<"surroundings"> }) {
  const [own, setOwn] = useState("");
  const list = node.settings.contexts;
  const put = (next: string[]) => set<"surroundings">(node.id, { contexts: next.slice(0, 12) });
  const addOwn = () => {
    const words = own.replace(/,/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
    if (!words) return;
    put([...list.filter((c) => c !== `custom:${words}`), `custom:${words}`]);
    setOwn("");
  };
  return (
    <>
      <div className="gchips">
        {list.length ? (
          list.map((c) => (
            <span key={c} className="chip gchip">
              <span data-no-translate={c.startsWith("custom:") ? true : undefined}>{contextLabel(c)}</span>
              <button type="button" aria-label={S.remove} title={S.remove} onClick={() => put(list.filter((x) => x !== c))}>
                <Icon name="close" size={12} />
              </button>
            </span>
          ))
        ) : (
          <span className="gmuted">{S.asModelled}</span>
        )}
      </div>
      <button
        type="button"
        className="btn gsmall"
        onClick={() => openPicker({ kind: "env", current: joinContexts(list), onPick: (env) => put(parseContexts(env)) })}
      >
        <Icon name="grid" size={14} />
        {S.browsePlaces}
      </button>
      <select
        className="input"
        value=""
        aria-label={S.addSurroundings}
        onChange={(e) => {
          if (e.target.value && !list.includes(e.target.value)) put([...list, e.target.value]);
        }}
      >
        <option value="">{S.addSurroundings}</option>
        {CONTEXT_GROUPS.map((g) => (
          <optgroup key={g.id} label={g.label}>
            {g.items.map((c) => (
              <option key={c.id} value={c.id} disabled={list.includes(c.id)}>{c.label}</option>
            ))}
          </optgroup>
        ))}
      </select>
      <form
        className="grow"
        onSubmit={(e) => {
          e.preventDefault();
          addOwn();
        }}
      >
        <input className="input" value={own} placeholder={S.ownWords} aria-label={S.ownWords} onChange={(e) => setOwn(e.target.value)} />
        <button type="submit" className="btn gsmall" disabled={!own.trim()}>{S.add}</button>
      </form>
    </>
  );
}

function FittingsBody({ node }: { node: GraphNode<"fittings"> }) {
  const s = node.settings;
  const f = s.fittings;
  const fit = (patch: Partial<typeof f>) => set<"fittings">(node.id, { fittings: { ...f, ...patch } });
  const toggle = (id: string) => fit({ types: f.types.includes(id) ? f.types.filter((x) => x !== id) : [...f.types, id] });
  return (
    <>
      <label className="gcheck">
        <input type="checkbox" checked={f.on} onChange={(e) => fit({ on: e.target.checked })} />
        <span>{S.switchedOn}</span>
      </label>
      {f.on ? (
        <>
          {[
            [S.interior, INTERIOR_FITTINGS],
            [S.exterior, EXTERIOR_FITTINGS],
          ].map(([label, list]) => (
            <fieldset key={label as string} className="gset">
              <legend>{label as string}</legend>
              {(list as typeof INTERIOR_FITTINGS).map((x) => (
                <label key={x.id} className="gcheck">
                  <input type="checkbox" checked={f.types.includes(x.id)} onChange={() => toggle(x.id)} />
                  <span>{x.label}</span>
                </label>
              ))}
            </fieldset>
          ))}
          <div className="grow">
            <label className="gfield">
              <span>{S.colour}</span>
              <select className="input" value={f.kelvin} onChange={(e) => fit({ kelvin: Number(e.target.value) })}>
                {KELVIN_OPTIONS.map((o) => (
                  <option key={o.k} value={o.k}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className="gfield">
              <span>{S.brightness}</span>
              <select className="input" value={f.level} onChange={(e) => fit({ level: Number(e.target.value) })}>
                {LEVELS.map((l, i) => (
                  <option key={l} value={i}>{l}</option>
                ))}
              </select>
            </label>
          </div>
        </>
      ) : null}
      <label className="gfield">
        <span>{S.materialLock}</span>
        <select
          className="input"
          value={s.materialLock === null ? "keep" : s.materialLock ? "on" : "off"}
          onChange={(e) => set<"fittings">(node.id, { materialLock: e.target.value === "keep" ? null : e.target.value === "on" })}
        >
          <option value="keep">{S.leaveAsIs}</option>
          <option value="on">{S.on}</option>
          <option value="off">{S.off}</option>
        </select>
      </label>
      <label className="gfield">
        <span>{S.notes}</span>
        <textarea
          className="input gscroll"
          rows={3}
          value={s.notes}
          placeholder={S.notesHint}
          onChange={(e) => set<"fittings">(node.id, { notes: e.target.value.slice(0, 4000) }, `notes:${node.id}`)}
          onBlur={endTypingRun}
        />
      </label>
    </>
  );
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast(S.copied, "ok");
  } catch {
    toast(S.copyFailed, "warn");
  }
}

function PromptBody({ node, items }: { node: GraphNode<"prompt">; items: PromptItem[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  if (!items.length) return <p className="gmuted">{S.wireImages}</p>;
  const setEdit = (img: string, text: string | null) => {
    const edits = { ...node.settings.edits };
    if (text === null) delete edits[img];
    else edits[img] = text.slice(0, 4000);
    set<"prompt">(node.id, { edits }, text === null ? null : `edit:${node.id}:${img}`);
  };
  return (
    <div className="gprompts gscroll">
      {items.map((p) => (
        <div key={p.imageNodeId} className="gprompt">
          <div className="gprompt-head">
            <b data-no-translate>{p.name || "—"}</b>
            {p.edited ? <span className="gtag">{S.edited}</span> : null}
          </div>
          <div className="gmuted gsmalltext">
            {p.guessed ? <span>{S.fromName}: </span> : null}
            <span data-no-translate>{p.lookName}</span>
          </div>
          {editing === p.imageNodeId ? (
            <textarea
              className="input mono gscroll"
              rows={8}
              value={p.text}
              aria-label={S.edit}
              onChange={(e) => setEdit(p.imageNodeId, e.target.value)}
              onBlur={endTypingRun}
            />
          ) : (
            <pre className="mono gtext gscroll">{p.text}</pre>
          )}
          <div className="grow">
            <button type="button" className="btn gsmall primary" onClick={() => void copyText(p.text)}>
              <Icon name="clipboard" size={14} />
              {S.copy}
            </button>
            <button type="button" className="btn gsmall ghost" aria-pressed={editing === p.imageNodeId} onClick={() => setEditing(editing === p.imageNodeId ? null : p.imageNodeId)}>
              <Icon name="pencil" size={14} />
              {editing === p.imageNodeId ? S.done : S.edit}
            </button>
            {p.edited ? (
              <button type="button" className="linkish" onClick={() => setEdit(p.imageNodeId, null)}>{S.useBuilt}</button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

/** The look's card picture, when the library has one. */
function LookPicture({ id }: { id: string }) {
  const item = findLibraryItem(id);
  const pic = item ? previewFile(item.id) ?? lookTile(item) : null;
  const [broken, setBroken] = useState<string | null>(null);
  if (!pic || broken === pic) return null;
  return (
    <div className="gthumb glook">
      <img src={pic} alt="" loading="lazy" draggable={false} onError={() => setBroken(pic)} />
    </div>
  );
}

const STATUS_WORD: Record<JobStatus, string> = {
  waiting: S.waiting,
  rendering: S.rendering,
  done: S.done,
  failed: S.failed,
  skipped: S.skipped,
  stopped: S.stopped,
};

/** Status of one job: from the run in progress, else from what is already rendered. */
function useJobStatus(job: RenderJob): { word: string; tone: string } {
  const key = resultKey(job);
  const live = useCanvas((s) => s.run?.jobs.find((j) => j.key === key));
  const res = useCanvas((s) => s.results[key]);
  if (live && (live.status === "rendering" || live.status === "waiting" || live.status === "failed")) return { word: STATUS_WORD[live.status], tone: live.status };
  if (res) return res.promptHash === job.promptHash ? { word: S.done, tone: "done" } : { word: S.changed, tone: "changed" };
  return { word: S.notRendered, tone: "none" };
}

function JobRow({ job }: { job: RenderJob }) {
  const st = useJobStatus(job);
  return (
    <li className={`gjob t-${st.tone}`}>
      <span className="gjob-dot" aria-hidden="true" />
      <b data-no-translate title={`${job.name} · ${job.lookName}`}>{`${job.name || "—"} · ${job.lookName}`}</b>
      <span>{st.word}</span>
    </li>
  );
}

function RenderBody({ jobs }: { jobs: RenderJob[] }) {
  const browser = useApp((s) => s.settings.backend === "browser" && !s.settings.testMode);
  if (browser) return <p className="gmuted">{S.promptReady}</p>;
  if (!jobs.length) return <p className="gmuted">{S.wireRender}</p>;
  return <ul className="gjobs gscroll">{jobs.map((j) => <JobRow key={resultKey(j)} job={j} />)}</ul>;
}

/** A small picture made in the background (full renders are large). */
function SmallPic({ id, img }: { id: string; img: ImageData64 }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void thumbFor(id, img, 420).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [id, img]);
  return url ? <img src={url} alt="" draggable={false} /> : <span className="hthumb-wait" aria-hidden="true" />;
}

export function ResultBody({ jobs }: { jobs: RenderJob[] }) {
  const results = useCanvas((s) => s.results);
  const [before, setBefore] = useState<string | null>(null);
  if (!jobs.length) return <p className="gmuted">{S.wireResult}</p>;
  return (
    <div className="gresults gscroll">
      {jobs.map((j) => {
        const key = resultKey(j);
        const r = results[key];
        return (
          <figure key={key} className="gresult">
            <div className="gresult-pic">
              {r ? (
                <SmallPic id={`${key}@${r.at}${before === key ? ":before" : ""}`} img={before === key ? r.before : r.image} />
              ) : (
                <span className="gmuted">{S.notRendered}</span>
              )}
            </div>
            <figcaption>
              <b data-no-translate title={`${j.name} · ${j.lookName}`}>{`${j.name || "—"} · ${j.lookName}`}</b>
              {r && r.promptHash !== j.promptHash ? <span className="gtag">{S.changed}</span> : null}
              {r ? (
                <button
                  type="button"
                  className="btn gsmall ghost"
                  aria-pressed={before === key}
                  title={`${S.before} / ${S.after}`}
                  onPointerDown={(e) => e.button === 0 && setBefore(key)}
                  onPointerUp={() => setBefore(null)}
                  onPointerLeave={() => setBefore(null)}
                  onKeyDown={(e) => (e.key === " " || e.key === "Enter") && setBefore(before === key ? null : key)}
                >
                  {before === key ? S.before : S.after}
                </button>
              ) : null}
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}
