// The node canvas: pan, zoom, move nodes, draw wires. Nodes move with CSS
// transforms and wires are SVG paths; the graph is only committed when a drag ends.
// The browser's own right-click menu is replaced by the canvas menu.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NODE_DEFS, addImages, addNode, cannotAdd, duplicateNodes, moveNodes, pasteNodes, removeNodes, removeWires, searchAddMenu, setView, wire, wiresInto, wiresOf } from "../../core/graph";
import type { EvalCache, GraphView, NodeKind, PortRef } from "../../core/graph";
import { fileToImage, shrinkJpeg, toDataUrl } from "../../core/images";
import { toast } from "../../toasts";
import { Icon } from "../../ui/Icon";
import { NodeCard } from "./NodeCard";
import type { PortHandlers } from "./NodeCard";
import { commit, commitView, copyNodes, getCanvas, graph, openAdd, openMenu, redo, select, selectWire, setPending, setPicture, sharePictures, undo, useCanvas } from "./session";
import type { MenuAt } from "./session";
import { fitView, portPoint, screenToWorld, wirePath, zoomAt } from "./geometry";
import { S } from "./strings";

type Gesture =
  | { type: "pan"; id: number; sx: number; sy: number; view: GraphView; moved: boolean }
  | { type: "move"; id: number; sx: number; sy: number; ids: string[]; moved: boolean }
  | { type: "link"; id: number; sx: number; sy: number; moved: boolean };

export const KIND_NAME: Record<NodeKind, string> = {
  image: S.image,
  look: S.look,
  light: S.light,
  surroundings: S.surroundings,
  fittings: S.fittings,
  prompt: S.prompt,
  note: S.note,
  render: S.render,
  batch: S.batchRender,
  result: S.result,
  relight: S.relight,
  view: S.newView,
  edit: S.editNode,
  style: S.styleCopy,
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

/** A new picture for an Image node: the node takes the file's name. */
export function choosePictureFor(id: string, file: File): void {
  commit({ ...graph(), nodes: graph().nodes.map((n) => (n.id === id ? { ...n, settings: { name: file.name.slice(0, 200) } } : n)) });
  void loadPicture(id, file);
}

/** Ctrl D (and Ctrl Shift D, which keeps the wires coming in). */
export function duplicateSelection(keepInputs: boolean): string[] {
  const ids = getCanvas().selected;
  if (!ids.length) return [];
  // Copies go just below the originals, so they never hide them.
  const nodes = graph().nodes.filter((n) => ids.includes(n.id));
  const top = Math.min(...nodes.map((n) => n.y));
  const bottom = Math.max(...nodes.map((n) => n.y + (document.querySelector<HTMLElement>(`[data-node-id="${n.id}"]`)?.offsetHeight ?? 200)));
  const r = duplicateNodes(graph(), ids, 0, bottom - top + 30, keepInputs);
  if ("reason" in r) {
    toast(r.reason, "warn");
    return [];
  }
  commit(r.graph);
  sharePictures(ids, r.ids);
  select(r.ids);
  return r.ids;
}

export function pasteAt(at: { x: number; y: number }): void {
  const slice = getCanvas().copied;
  if (!slice) return;
  const r = pasteNodes(graph(), slice, at.x, at.y);
  if ("reason" in r) return void toast(r.reason, "warn");
  commit(r.graph);
  sharePictures(r.from, r.ids);
  select(r.ids);
}

export function Canvas({ outputs, fitSignal }: { outputs: EvalCache; fitSignal: number }) {
  const g = useCanvas((s) => s.undo.present);
  const selected = useCanvas((s) => s.selected);
  const selectedWire = useCanvas((s) => s.selectedWire);
  const pending = useCanvas((s) => s.pending);
  const pictures = useCanvas((s) => s.pictures);
  const addAt = useCanvas((s) => s.addAt);
  const menu = useCanvas((s) => s.menu);
  const copied = useCanvas((s) => s.copied);
  const root = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [view, setLiveView] = useState<GraphView>(g.view);
  const viewRef = useRef(view);
  viewRef.current = view;
  const [drag, setDrag] = useState<{ ids: string[]; dx: number; dy: number } | null>(null);
  const [link, setLink] = useState<{ x: number; y: number } | null>(null);
  const focusNext = useRef<string | null>(null);
  const wheelTimer = useRef(0);
  const settle = useRef(0);
  /** Smooth layer while panning or zooming; text is drawn sharp again a moment after. */
  const moving = () => {
    root.current?.classList.add("moving");
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => root.current?.classList.remove("moving"), 180);
  };
  /** Last pointer position inside the canvas, for Shift A and Ctrl V. */
  const mouse = useRef<{ sx: number; sy: number } | null>(null);

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
  /** Where a menu or a new node goes: the mouse if it is over the canvas, else the middle. */
  const here = (): MenuAt => {
    const r = root.current?.getBoundingClientRect();
    const m = mouse.current ?? { sx: (r?.width ?? 800) / 2 - 130, sy: (r?.height ?? 600) / 3 };
    const p = screenToWorld(viewRef.current, m.sx, m.sy);
    return { x: Math.round(p.x), y: Math.round(p.y), sx: m.sx, sy: m.sy };
  };
  const atClient = (clientX: number, clientY: number): MenuAt => {
    const { sx, sy } = local(clientX, clientY);
    const p = screenToWorld(viewRef.current, sx, sy);
    return { x: Math.round(p.x), y: Math.round(p.y), sx, sy };
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

  // Wheel zooms the canvas, like Blender and 3ds Max. Hover a list or text box that can
  // scroll and the wheel scrolls it instead (even if the node is not selected); at the
  // end of the list nothing happens, so the canvas never jumps. Shift + wheel pans up and down.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const scrollerAt = (t: HTMLElement): HTMLElement | null => {
      const node = t.closest<HTMLElement>("[data-node-id]");
      for (let n: HTMLElement | null = t; n && node && node.contains(n); n = n.parentElement) {
        if (n.scrollHeight > n.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(n).overflowY)) return n;
      }
      return null;
    };
    const onWheel = (e: WheelEvent) => {
      const t = e.target as HTMLElement;
      const scroller = e.ctrlKey || e.shiftKey ? null : scrollerAt(t);
      if (scroller) {
        const atTop = scroller.scrollTop <= 0, atEnd = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
        if ((e.deltaY < 0 && atTop) || (e.deltaY > 0 && atEnd)) e.preventDefault();
        return; // the browser scrolls the list
      }
      e.preventDefault();
      moving();
      if (e.shiftKey && !e.ctrlKey) {
        const d = e.deltaY || e.deltaX;
        setLiveView({ ...viewRef.current, y: viewRef.current.y - d });
      } else {
        const { sx, sy } = local(e.clientX, e.clientY);
        setLiveView(zoomAt(viewRef.current, sx, sy, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))));
      }
      window.clearTimeout(wheelTimer.current);
      wheelTimer.current = window.setTimeout(() => commitView(setView(graph(), viewRef.current)), 250);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Focus a node that was just added, for keyboard users.
  useEffect(() => {
    if (!focusNext.current) return;
    const el = root.current?.querySelector<HTMLElement>(`[data-node-id="${focusNext.current}"]`);
    focusNext.current = null;
    el?.focus({ preventScroll: true });
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
      choosePicture: choosePictureFor,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (getCanvas().menu && !target.closest(".gmenu")) openMenu(null);
    // Middle button pans from anywhere, nodes included, and never starts the
    // browser's auto-scroll inside a node.
    const middle = e.button === 1;
    if (!middle && e.button !== 0) return;
    if (!middle && target.closest(".gnode, .gwire-hit, .gadd, .gmenu")) return;
    e.preventDefault();
    root.current?.focus({ preventScroll: true });
    if (!middle) {
      if (getCanvas().pending) setPending(null);
      select([]);
    }
    root.current?.setPointerCapture(e.pointerId);
    gesture.current = { type: "pan", id: e.pointerId, sx: e.clientX, sy: e.clientY, view: viewRef.current, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    mouse.current = local(e.clientX, e.clientY);
    const gs = gesture.current;
    if (!gs || gs.id !== e.pointerId) return;
    const dxs = e.clientX - gs.sx;
    const dys = e.clientY - gs.sy;
    if (!gs.moved && Math.hypot(dxs, dys) < 4) return;
    gs.moved = true;
    if (gs.type === "pan") {
      moving();
      setLiveView({ ...gs.view, x: gs.view.x + dxs, y: gs.view.y + dys });
    }
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

  const onContextMenu = (e: React.MouseEvent) => {
    // Text fields keep the browser menu (paste, spelling); everything else gets ours.
    if (typing(e.target)) return;
    e.preventDefault();
    const t = e.target as HTMLElement;
    const nodeEl = t.closest<HTMLElement>("[data-node-id]");
    const wireEl = t.closest<SVGElement>("[data-wire-id]");
    const node = nodeEl?.dataset.nodeId ?? null;
    if (node && !getCanvas().selected.includes(node)) select([node]);
    const wireId = wireEl?.getAttribute("data-wire-id") ?? null;
    if (wireId) selectWire(wireId);
    openMenu({ ...atClient(e.clientX, e.clientY), node, wire: wireId });
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".gnode, .gwire-hit, .gadd, .gmenu")) return;
    openAdd(atClient(e.clientX, e.clientY));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if ((typing(t) || t.closest('[role="slider"]')) && e.key !== "Escape") return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    const s = getCanvas();
    if (mod && k === "z") {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    } else if (mod && k === "y") {
      e.preventDefault();
      redo();
    } else if (mod && k === "a") {
      e.preventDefault();
      select(graph().nodes.map((n) => n.id));
    } else if (mod && k === "d") {
      e.preventDefault();
      focusNext.current = duplicateSelection(e.shiftKey)[0] ?? null;
    } else if (mod && k === "c") {
      if (s.selected.length) {
        e.preventDefault();
        copyNodes(s.selected);
      }
    } else if (mod && k === "v") {
      if (s.copied) {
        e.preventDefault();
        pasteAt(here());
      }
    } else if (mod) {
      return;
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      removeSelection();
    } else if (e.key === "Escape") {
      if (s.menu) openMenu(null);
      else if (s.addAt) openAdd(null);
      else if (s.pending) setPending(null);
      else select([]);
    } else if (e.key.startsWith("Arrow")) {
      e.preventDefault();
      const step = e.shiftKey ? 50 : 10;
      const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
      const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
      if (s.selected.length) commit(moveNodes(graph(), s.selected, dx, dy), `move:${s.selected.join(",")}`);
      else keepView({ ...viewRef.current, x: viewRef.current.x - dx * 4, y: viewRef.current.y - dy * 4 });
    } else if (k === "a" || e.key === "/") {
      // A, Shift A (as in Blender) and / open Add node at the mouse.
      e.preventDefault();
      openAdd(here());
    } else if (e.key === "+" || e.key === "=") {
      const r = root.current!.getBoundingClientRect();
      keepView(zoomAt(viewRef.current, r.width / 2, r.height / 2, 1.2));
    } else if (e.key === "-") {
      const r = root.current!.getBoundingClientRect();
      keepView(zoomAt(viewRef.current, r.width / 2, r.height / 2, 1 / 1.2));
    } else if (e.key === "0") {
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

  const addAtPoint = (kind: NodeKind, at: { x: number; y: number }) => {
    const r = addNode(graph(), kind, at.x, at.y);
    openAdd(null);
    openMenu(null);
    if ("reason" in r) return void toast(r.reason, "warn");
    commit(r.graph);
    select([r.id!]);
    focusNext.current = r.id!;
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
      onPointerLeave={() => {
        mouse.current = null;
      }}
      onMouseDown={(e) => {
        // Stops the browser's middle-button auto-scroll everywhere on the canvas.
        if (e.button === 1) e.preventDefault();
      }}
      onContextMenu={onContextMenu}
      onDoubleClick={onDoubleClick}
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
                  data-wire-id={w.id}
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
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
      {addAt ? <AddMenu at={addAt} onPick={(kind) => addAtPoint(kind, addAt)} /> : null}
      {menu ? (
        <ContextMenu
          at={menu}
          onAdd={(kind) => addAtPoint(kind, menu)}
          items={[
            ...(menu.wire ? [{ label: S.deleteWire, key: "Delete", run: () => commit(removeWires(graph(), [menu.wire!])) }] : []),
            ...(menu.node
              ? [
                  { label: S.duplicate, key: "Ctrl D", run: () => void duplicateSelection(false) },
                  { label: S.duplicateWithInputs, key: "Ctrl Shift D", run: () => void duplicateSelection(true) },
                  { label: S.copy, key: "Ctrl C", run: () => copyNodes(getCanvas().selected) },
                  { label: S.disconnect, key: "", run: () => commit(removeWires(graph(), wiresOf(graph(), getCanvas().selected))) },
                  { label: S.deleteNode, key: "Delete", run: () => commit(removeNodes(graph(), getCanvas().selected)) },
                ]
              : []),
            ...(copied ? [{ label: S.paste, key: "Ctrl V", run: () => pasteAt(menu) }] : []),
            ...(!menu.node && !menu.wire
              ? [
                  { label: S.selectAll, key: "Ctrl A", run: () => select(graph().nodes.map((n) => n.id)) },
                  { label: S.fit, key: "0", run: fit },
                ]
              : []),
          ]}
        />
      ) : null}
    </div>
  );
}

/** Keeps a floating menu inside the canvas box. */
function placeMenu(at: MenuAt, w: number, h: number): React.CSSProperties {
  const box = document.querySelector(".gcanvas")?.getBoundingClientRect();
  const maxX = (box?.width ?? 1200) - w - 8;
  const maxY = (box?.height ?? 800) - h - 8;
  return { left: Math.max(8, Math.min(at.sx, maxX)), top: Math.max(8, Math.min(at.sy, maxY)) };
}

function AddMenu({ at, onPick }: { at: MenuAt; onPick: (k: NodeKind) => void }) {
  const [q, setQ] = useState("");
  const kinds = searchAddMenu(q);
  return (
    <div className="gadd glass" style={placeMenu(at, 280, 330)} role="dialog" aria-label={S.addTitle} onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
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
              <span className={`gdot k-${k}`} aria-hidden="true" />
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

interface MenuItem {
  label: string;
  key: string;
  run: () => void;
}

function ContextMenu({ at, items, onAdd }: { at: MenuAt; items: MenuItem[]; onAdd: (k: NodeKind) => void }) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus({ preventScroll: true }), []);
  const kinds = searchAddMenu("");
  return (
    <div
      className="gmenu glass"
      style={placeMenu(at, 240, 34 * (items.length + kinds.length) + 40)}
      role="menu"
      aria-label={S.menu}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        const list = [...(e.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>("button")];
        const i = list.indexOf(document.activeElement as HTMLButtonElement);
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          e.stopPropagation();
          list[(i + (e.key === "ArrowDown" ? 1 : list.length - 1)) % list.length]?.focus();
        }
      }}
    >
      {items.map((it, i) => (
        <button
          key={it.label}
          ref={i === 0 ? first : undefined}
          type="button"
          role="menuitem"
          onClick={() => {
            openMenu(null);
            it.run();
          }}
        >
          <span>{it.label}</span>
          {it.key ? <kbd className="kbd">{it.key}</kbd> : null}
        </button>
      ))}
      <div className="gmenu-head">{S.addNode}</div>
      {kinds.map((k, i) => (
        <button key={k} ref={!items.length && i === 0 ? first : undefined} type="button" role="menuitem" onClick={() => onAdd(k)}>
          <span>
            <span className={`gdot k-${k}`} aria-hidden="true" />
            {KIND_NAME[k]}
          </span>
        </button>
      ))}
    </div>
  );
}
