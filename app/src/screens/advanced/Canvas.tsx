// The node canvas: pan, zoom, move nodes, draw wires. Nodes move with CSS
// transforms and wires are SVG paths; the graph is only committed when a drag ends.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NODE_DEFS, addImages, addNode, cannotAdd, moveNodes, removeNodes, removeWires, searchAddMenu, setView, wire, wiresInto } from "../../core/graph";
import type { EvalCache, GraphView, NodeKind, PortRef } from "../../core/graph";
import { fileToImage, shrinkJpeg, toDataUrl } from "../../core/images";
import { toast } from "../../toasts";
import { Icon } from "../../ui/Icon";
import { NodeCard } from "./NodeCard";
import type { PortHandlers } from "./NodeCard";
import { commit, commitView, getCanvas, graph, openAdd, redo, select, selectWire, setPending, setPicture, undo, useCanvas } from "./session";
import { fitView, portPoint, screenToWorld, wirePath, zoomAt } from "./geometry";
import { S } from "./strings";

type Gesture =
  | { type: "pan"; id: number; sx: number; sy: number; view: GraphView; moved: boolean }
  | { type: "move"; id: number; sx: number; sy: number; ids: string[]; moved: boolean }
  | { type: "link"; id: number; sx: number; sy: number; moved: boolean };

const KIND_NAME: Record<NodeKind, string> = {
  image: S.image,
  look: S.look,
  light: S.light,
  surroundings: S.surroundings,
  fittings: S.fittings,
  prompt: S.prompt,
  note: S.note,
};

function typing(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  return Boolean(el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable));
}

/** Loads pictures into Image nodes: a small thumbnail for the node, the picture kept in memory. */
export async function loadPicture(nodeId: string, file: File): Promise<void> {
  try {
    const full = await fileToImage(file);
    const thumb = await shrinkJpeg(full, 320, 0.8);
    setPicture(nodeId, { full, thumb: toDataUrl(thumb) });
  } catch {
    /* the node keeps its name; the prompt does not need the picture */
  }
}

/** Adds one Image node per file at a canvas point. */
export function addPictureFiles(files: File[], at: { x: number; y: number }): void {
  const pics = files.filter((f) => f.type.startsWith("image/"));
  if (!pics.length) {
    if (files.length) toast(S.imagesOnly, "warn");
    return;
  }
  const r = addImages(graph(), pics.map((f) => f.name), at.x, at.y);
  if (!r.added.length) {
    toast(cannotAdd(graph(), "image") ?? S.imagesOnly, "warn");
    return;
  }
  commit(r.graph);
  if (r.skipped) toast(cannotAdd(r.graph, "image") ?? "", "warn");
  r.added.forEach((id, i) => void loadPicture(id, pics[i]));
}

export function Canvas({ outputs, fitSignal }: { outputs: EvalCache; fitSignal: number }) {
  const g = useCanvas((s) => s.undo.present);
  const selected = useCanvas((s) => s.selected);
  const selectedWire = useCanvas((s) => s.selectedWire);
  const pending = useCanvas((s) => s.pending);
  const pictures = useCanvas((s) => s.pictures);
  const addAt = useCanvas((s) => s.addAt);
  const root = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [view, setLiveView] = useState<GraphView>(g.view);
  const viewRef = useRef(view);
  viewRef.current = view;
  const [drag, setDrag] = useState<{ ids: string[]; dx: number; dy: number } | null>(null);
  const [link, setLink] = useState<{ x: number; y: number } | null>(null);
  const focusNext = useRef<string | null>(null);
  const wheelTimer = useRef(0);

  // Undo, a new graph or an opened file bring their own view.
  useEffect(() => setLiveView(g.view), [g.view]);

  const keepView = useCallback((v: GraphView) => {
    setLiveView(v);
    commitView(setView(graph(), v));
  }, []);

  const fit = useCallback(() => {
    const r = root.current?.getBoundingClientRect();
    if (!r) return;
    const heights = new Map<string, number>();
    root.current?.querySelectorAll<HTMLElement>("[data-node-id]").forEach((el) => heights.set(el.dataset.nodeId!, el.offsetHeight));
    keepView(fitView(graph().nodes, r.width, r.height, (id) => heights.get(id) ?? 260));
  }, [keepView]);

  useEffect(() => {
    if (fitSignal) fit();
  }, [fitSignal, fit]);

  const local = (clientX: number, clientY: number) => {
    const r = root.current!.getBoundingClientRect();
    return { sx: clientX - r.left, sy: clientY - r.top };
  };
  const world = (clientX: number, clientY: number) => {
    const { sx, sy } = local(clientX, clientY);
    return screenToWorld(viewRef.current, sx, sy);
  };
  const centre = () => {
    const r = root.current?.getBoundingClientRect();
    const p = screenToWorld(viewRef.current, (r?.width ?? 800) / 2 - 130, (r?.height ?? 600) / 3);
    return { x: Math.round(p.x), y: Math.round(p.y) };
  };

  const tryConnect = (from: PortRef, to: PortRef) => {
    const r = wire(graph(), from, to);
    if ("reason" in r) toast(r.reason, "warn");
    else commit(r.graph);
    setPending(null);
  };

  const removeSelection = () => {
    const s = getCanvas();
    if (s.selectedWire) commit(removeWires(graph(), [s.selectedWire]));
    else if (s.selected.length) commit(removeNodes(graph(), s.selected));
  };

  // Wheel zoom needs a non-passive listener to stop the page from scrolling.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const scroller = (e.target as HTMLElement).closest(".gscroll") as HTMLElement | null;
      if (scroller && scroller.scrollHeight > scroller.clientHeight && !e.ctrlKey) return;
      e.preventDefault();
      const { sx, sy } = local(e.clientX, e.clientY);
      const v = zoomAt(viewRef.current, sx, sy, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
      setLiveView(v);
      window.clearTimeout(wheelTimer.current);
      wheelTimer.current = window.setTimeout(() => commitView(setView(graph(), viewRef.current)), 250);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Focus a node that was just added from the menu, for keyboard users.
  useEffect(() => {
    if (!focusNext.current) return;
    const el = root.current?.querySelector<HTMLElement>(`[data-node-id="${focusNext.current}"]`);
    focusNext.current = null;
    el?.focus();
  });

  const ui: PortHandlers = useMemo(
    () => ({
      headerDown: (e, id) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        // No text selection while dragging; focus the card by hand so Shift-click keeps the set.
        e.preventDefault();
        const s = getCanvas();
        let ids = s.selected.includes(id) ? s.selected : [id];
        if (e.shiftKey) ids = s.selected.includes(id) ? s.selected.filter((x) => x !== id) : [...s.selected, id];
        select(ids);
        if (!ids.includes(id)) return;
        (e.currentTarget.closest(".gnode") as HTMLElement | null)?.focus({ preventScroll: true });
        root.current?.setPointerCapture(e.pointerId);
        gesture.current = { type: "move", id: e.pointerId, sx: e.clientX, sy: e.clientY, ids, moved: false };
      },
      outDown: (e, node, port) => {
        if (e.button !== 0) return;
        const p = getCanvas().pending;
        if (p && p.side === "in") {
          tryConnect({ node, port }, p);
          return;
        }
        e.preventDefault(); // no text selection while drawing a wire
        setPending({ node, port, side: "out" });
        setLink(world(e.clientX, e.clientY));
        root.current?.setPointerCapture(e.pointerId);
        gesture.current = { type: "link", id: e.pointerId, sx: e.clientX, sy: e.clientY, moved: false };
      },
      portClick: (e, node, port, side) => {
        const p = getCanvas().pending;
        const keyboard = e.detail === 0;
        if (side === "out") {
          // Mouse presses on outputs are handled on pointer down.
          if (!keyboard) return;
          if (p && p.side === "in") tryConnect({ node, port }, p);
          else setPending(p && p.node === node && p.port === port ? null : { node, port, side: "out" });
          return;
        }
        if (p && p.side === "out") {
          tryConnect(p, { node, port });
          return;
        }
        const into = wiresInto(graph(), { node, port });
        if (into.length && !keyboard) {
          selectWire(into[0]);
          return;
        }
        setPending(p && p.node === node && p.port === port ? null : { node, port, side: "in" });
      },
      portKey: (e, node, port, side) => {
        if (side === "in" && (e.key === "Delete" || e.key === "Backspace")) {
          e.preventDefault();
          e.stopPropagation();
          const into = wiresInto(graph(), { node, port });
          if (into.length) commit(removeWires(graph(), into));
        }
      },
      remove: (id) => commit(removeNodes(graph(), [id])),
      choosePicture: (id, file) => {
        commit({ ...graph(), nodes: graph().nodes.map((n) => (n.id === id ? { ...n, settings: { name: file.name.slice(0, 200) } } : n)) });
        void loadPicture(id, file);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    if ((e.target as HTMLElement).closest(".gnode, .gwire-hit, .gadd")) return;
    e.preventDefault();
    root.current?.focus({ preventScroll: true });
    if (getCanvas().pending) setPending(null);
    select([]);
    root.current?.setPointerCapture(e.pointerId);
    gesture.current = { type: "pan", id: e.pointerId, sx: e.clientX, sy: e.clientY, view: viewRef.current, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const gs = gesture.current;
    if (!gs || gs.id !== e.pointerId) return;
    const dxs = e.clientX - gs.sx;
    const dys = e.clientY - gs.sy;
    if (!gs.moved && Math.hypot(dxs, dys) < 4) return;
    gs.moved = true;
    if (gs.type === "pan") setLiveView({ ...gs.view, x: gs.view.x + dxs, y: gs.view.y + dys });
    else if (gs.type === "move") setDrag({ ids: gs.ids, dx: dxs / viewRef.current.zoom, dy: dys / viewRef.current.zoom });
    else setLink(world(e.clientX, e.clientY));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const gs = gesture.current;
    if (!gs || gs.id !== e.pointerId) return;
    gesture.current = null;
    try {
      root.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    if (gs.type === "pan") {
      if (gs.moved) commitView(setView(graph(), viewRef.current));
    } else if (gs.type === "move") {
      if (gs.moved) {
        const z = viewRef.current.zoom;
        commit(moveNodes(graph(), gs.ids, (e.clientX - gs.sx) / z, (e.clientY - gs.sy) / z));
      }
      setDrag(null);
    } else {
      setLink(null);
      if (gs.moved) {
        const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-port-in]");
        const p = getCanvas().pending;
        if (hit && p && p.side === "out") {
          const [node, port] = hit.dataset.portIn!.split(":");
          tryConnect(p, { node, port });
        } else setPending(null);
      }
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (typing(e.target) && e.key !== "Escape") return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key;
    const s = getCanvas();
    if (mod && k.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    } else if (mod && k.toLowerCase() === "y") {
      e.preventDefault();
      redo();
    } else if (mod && k.toLowerCase() === "a") {
      e.preventDefault();
      select(graph().nodes.map((n) => n.id));
    } else if (mod) {
      return;
    } else if (k === "Delete" || k === "Backspace") {
      e.preventDefault();
      removeSelection();
    } else if (k === "Escape") {
      if (s.addAt) openAdd(null);
      else if (s.pending) setPending(null);
      else select([]);
    } else if (k.startsWith("Arrow")) {
      e.preventDefault();
      const step = e.shiftKey ? 50 : 10;
      const dx = k === "ArrowLeft" ? -step : k === "ArrowRight" ? step : 0;
      const dy = k === "ArrowUp" ? -step : k === "ArrowDown" ? step : 0;
      if (s.selected.length) commit(moveNodes(graph(), s.selected, dx, dy), `move:${s.selected.join(",")}`);
      else keepView({ ...viewRef.current, x: viewRef.current.x - dx * 4, y: viewRef.current.y - dy * 4 });
    } else if (k === "a" || k === "A" || k === "/") {
      e.preventDefault();
      openAdd(centre());
    } else if (k === "+" || k === "=") {
      const r = root.current!.getBoundingClientRect();
      keepView(zoomAt(viewRef.current, r.width / 2, r.height / 2, 1.2));
    } else if (k === "-") {
      const r = root.current!.getBoundingClientRect();
      keepView(zoomAt(viewRef.current, r.width / 2, r.height / 2, 1 / 1.2));
    } else if (k === "0") {
      fit();
    }
  };

  const onDrop = (e: React.DragEvent) => {
    const files = [...(e.dataTransfer?.files ?? [])];
    if (!files.length) return;
    e.preventDefault();
    e.stopPropagation();
    const onNode = (e.target as HTMLElement).closest<HTMLElement>('[data-kind="image"]');
    const pic = files.find((f) => f.type.startsWith("image/"));
    if (onNode && pic && files.length === 1) {
      ui.choosePicture(onNode.dataset.nodeId!, pic);
      return;
    }
    addPictureFiles(files, world(e.clientX, e.clientY));
  };

  const byId = useMemo(() => new Map(g.nodes.map((n) => [n.id, n])), [g.nodes]);
  const offset = (id: string) => (drag && drag.ids.includes(id) ? { dx: drag.dx, dy: drag.dy } : { dx: 0, dy: 0 });
  const at = (id: string) => {
    const n = byId.get(id)!;
    const o = offset(id);
    return { ...n, x: n.x + o.dx, y: n.y + o.dy };
  };

  let livePath: string | null = null;
  if (pending && link) {
    const n = byId.get(pending.node);
    if (n) {
      const p = portPoint(at(n.id), pending.port, pending.side);
      livePath = pending.side === "out" ? wirePath(p, link) : wirePath(link, p);
    }
  }

  return (
    <div
      ref={root}
      className={`gcanvas${pending ? " linking" : ""}`}
      tabIndex={0}
      role="application"
      aria-label={S.canvas}
      aria-roledescription={S.canvas}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      onDragOver={(e) => {
        if ([...(e.dataTransfer?.types ?? [])].includes("Files")) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      onDrop={onDrop}
      style={{ backgroundPosition: `${view.x}px ${view.y}px`, backgroundSize: `${24 * view.zoom}px ${24 * view.zoom}px` }}
    >
      <div className="gworld" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}>
        <svg className="gwires" aria-label={S.wires} role="group">
          {g.wires.map((w) => {
            const a = byId.get(w.from.node);
            const b = byId.get(w.to.node);
            if (!a || !b) return null;
            const d = wirePath(portPoint(at(a.id), w.from.port, "out"), portPoint(at(b.id), w.to.port, "in"));
            const type = NODE_DEFS[a.kind].outputs.find((p) => p.id === w.from.port)?.type ?? "look";
            const label = `${KIND_NAME[a.kind]} → ${KIND_NAME[b.kind]}`;
            return (
              <g key={w.id}>
                <path className={`gwire t-${type}${selectedWire === w.id ? " sel" : ""}`} d={d} />
                <path
                  className="gwire-hit"
                  d={d}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    selectWire(w.id);
                    root.current?.focus({ preventScroll: true });
                  }}
                >
                  <title>{label}</title>
                </path>
              </g>
            );
          })}
          {livePath ? <path className="gwire live" d={livePath} /> : null}
        </svg>
        {g.nodes.map((n) => {
          const o = offset(n.id);
          return (
            <NodeCard
              key={n.id}
              node={n}
              output={outputs.get(n.id)}
              selected={selected.includes(n.id)}
              dx={o.dx}
              dy={o.dy}
              picture={n.kind === "image" ? pictures[n.id] : undefined}
              pending={pending}
              wiredIn={g.wires.filter((w) => w.to.node === n.id).map((w) => w.to.port).join("|")}
              ui={ui}
            />
          );
        })}
      </div>
      {pending ? (
        <div className="gpending" role="status">
          {pending.side === "out" ? S.pickInput : S.pickOutput}
        </div>
      ) : null}
      {addAt ? (
        <AddMenu
          onPick={(kind) => {
            const r = addNode(graph(), kind, addAt.x, addAt.y);
            openAdd(null);
            if ("reason" in r) return void toast(r.reason, "warn");
            commit(r.graph);
            select([r.id!]);
            focusNext.current = r.id!;
          }}
        />
      ) : null}
    </div>
  );
}

function AddMenu({ onPick }: { onPick: (k: NodeKind) => void }) {
  const [q, setQ] = useState("");
  const kinds = searchAddMenu(q);
  return (
    <div className="gadd glass" role="dialog" aria-label={S.addTitle} onPointerDown={(e) => e.stopPropagation()}>
      <div className="grow">
        <b>{S.addTitle}</b>
        <button type="button" className="icon-btn gclose" aria-label={S.close} title={S.close} onClick={() => openAdd(null)}>
          <Icon name="close" size={14} />
        </button>
      </div>
      <input
        className="input"
        autoFocus
        value={q}
        placeholder={S.addSearch}
        aria-label={S.addSearch}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && kinds[0]) {
            e.preventDefault();
            onPick(kinds[0]);
          } else if (e.key === "Escape") {
            e.stopPropagation();
            openAdd(null);
          }
        }}
      />
      <div className="glist" role="listbox" aria-label={S.addTitle}>
        {kinds.length ? (
          kinds.map((k) => (
            <button key={k} type="button" role="option" aria-selected={false} onClick={() => onPick(k)}>
              {KIND_NAME[k]}
            </button>
          ))
        ) : (
          <span className="gmuted">{S.noMatch}</span>
        )}
      </div>
    </div>
  );
}

