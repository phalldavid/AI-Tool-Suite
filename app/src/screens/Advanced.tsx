// Advanced tab: a node canvas that builds one prompt per image. Stage 1 is prompts
// only: nothing here renders, calls a backend or spends credits.

import { useEffect, useMemo, useRef, useState } from "react";
import { setState, useApp } from "../store";
import { toast } from "../toasts";
import { Icon } from "../ui/Icon";
import { useViewport } from "../layout";
import { allPrompts, defaultsFromSettings, evaluateGraph, graphFileName, parseGraph, promptFiles, rename, serializeGraph, setView, starterGraph, zipFiles } from "../core/graph";
import type { EvalCache } from "../core/graph";
import { Canvas, addPictureFiles } from "./advanced/Canvas";
import { commit, commitView, endTypingRun, graph, openAdd, redo, replaceGraph, undo, useCanvas } from "./advanced/session";
import { screenToWorld, zoomAt } from "./advanced/geometry";
import { S } from "./advanced/strings";

function download(name: string, data: BlobPart, type: string): boolean {
  try {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    return true;
  } catch {
    return false;
  }
}

export function AdvancedScreen() {
  const vp = useViewport();
  if (vp.w < 900) {
    return (
      <div className="body">
        <main className="work gnarrow">
          <h1 style={{ fontSize: 20 }}>{S.narrowTitle}</h1>
          <p className="note">{S.narrowBody}</p>
          <div>
            <button type="button" className="btn primary" onClick={() => setState({ tab: "render" })}>{S.goRender}</button>
          </div>
        </main>
      </div>
    );
  }
  return <AdvancedDesktop />;
}

function AdvancedDesktop() {
  const g = useCanvas((s) => s.undo.present);
  const canUndo = useCanvas((s) => s.undo.past.length > 0);
  const canRedo = useCanvas((s) => s.undo.future.length > 0);
  const settings = useApp((s) => s.settings);
  const cache = useRef<EvalCache | undefined>(undefined);
  const [fitSignal, setFitSignal] = useState(0);
  const openInput = useRef<HTMLInputElement>(null);
  const imagesInput = useRef<HTMLInputElement>(null);

  // The graph's own settings, plus photo or 3D look, things to avoid and the
  // extra prompt options from Settings. The Render tab's notes chips are not used.
  const defaults = useMemo(
    () => defaultsFromSettings(settings),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings.dynamic, settings.lineStrength, settings.look, settings.materialLock, settings.boundaryLock, settings.avoid],
  );
  const result = useMemo(() => evaluateGraph(g, defaults, cache.current), [g.nodes, g.wires, defaults]); // eslint-disable-line react-hooks/exhaustive-deps
  if (result.ok) cache.current = result.outputs;
  const outputs = result.ok ? result.outputs : new Map();
  const prompts = result.ok ? allPrompts(g, result.outputs) : [];

  // Paste a screenshot onto the canvas (the app's own paste goes to the Render tab otherwise).
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith("image/"));
      if (!files.length) return;
      e.preventDefault();
      const v = graph().view;
      const at = screenToWorld(v, 120, 120);
      const named = files.map((f, i) => (f.name && f.name !== "image.png" ? f : new File([f], `Pasted image ${i + 1}.png`, { type: f.type })));
      addPictureFiles(named, at);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);

  const saveGraph = () => {
    if (download(graphFileName(graph()), serializeGraph(graph()), "application/json")) toast(S.graphSaved, "ok");
    else toast(S.saveFailed, "error");
  };

  const saveAll = () => {
    if (!prompts.length) return void toast(S.noPrompts, "warn");
    const zip = zipFiles(promptFiles(prompts));
    const name = graphFileName(graph()).replace(/\.graph\.json$/, "-prompts.zip");
    if (download(name, zip, "application/zip")) toast(S.promptsSaved, "ok");
    else toast(S.saveFailed, "error");
  };

  const openFile = async (file: File) => {
    const r = parseGraph(await file.text().catch(() => ""));
    if (!r.ok) return void toast(r.error, "error");
    replaceGraph(r.graph);
    toast(r.warnings.length ? S.openedWithChanges : S.graphOpened, r.warnings.length ? "warn" : "ok");
    if (r.warnings.length) console.info("Graph file:", r.warnings);
  };

  // Ctrl S saves the graph file while this tab is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveGraph();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const images = g.nodes.filter((n) => n.kind === "image").length;

  return (
    <div className="body">
      <main className="work gwork">
        <div className="gbar">
          <input
            className="input gname"
            value={g.name}
            aria-label={S.graphName}
            title={S.graphName}
            data-no-translate
            onChange={(e) => commit(rename(graph(), e.target.value), "graph-name")}
            onBlur={endTypingRun}
          />
          <button type="button" className="btn primary" onClick={() => openAdd(screenToWorld(graph().view, 200, 120))}>
            <Icon name="plus" size={16} />
            {S.addNode}
          </button>
          <button type="button" className="btn" onClick={() => imagesInput.current?.click()}>
            <Icon name="image" size={16} />
            {S.addImages}
          </button>
          <input
            ref={imagesInput}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              // New images go in columns to the left of everything, then the view fits them in.
              const nodes = graph().nodes;
              const left = nodes.length ? Math.min(...nodes.map((n) => n.x)) - 300 : 0;
              const top = nodes.length ? Math.min(...nodes.map((n) => n.y)) : 0;
              addPictureFiles([...(e.target.files ?? [])], { x: left, y: top });
              e.target.value = "";
              setFitSignal((n) => n + 1);
            }}
          />
          <span className="gsep" />
          <button type="button" className="icon-btn" aria-label={S.undo} title={`${S.undo} · Ctrl Z`} disabled={!canUndo} onClick={undo}>
            <Icon name="undo" size={16} />
          </button>
          <button type="button" className="icon-btn" aria-label={S.redo} title={`${S.redo} · Ctrl Y`} disabled={!canRedo} onClick={redo}>
            <Icon name="redo" size={16} />
          </button>
          <button type="button" className="icon-btn" aria-label={S.zoomOut} title={S.zoomOut} onClick={() => commitZoom(1 / 1.2)}>
            <Icon name="minus" size={16} />
          </button>
          <span className="gzoom num" aria-live="polite">{Math.round(g.view.zoom * 100)}%</span>
          <button type="button" className="icon-btn" aria-label={S.zoomIn} title={S.zoomIn} onClick={() => commitZoom(1.2)}>
            <Icon name="plus" size={16} />
          </button>
          <button type="button" className="icon-btn" aria-label={S.fit} title={`${S.fit} · 0`} onClick={() => setFitSignal((n) => n + 1)}>
            <Icon name="expand" size={16} />
          </button>
          <span className="gsep" />
          <button type="button" className="btn ghost" onClick={() => replaceGraph(starterGraph())}>{S.newGraph}</button>
          <button type="button" className="btn ghost" onClick={() => openInput.current?.click()}>{S.openGraph}</button>
          <input
            ref={openInput}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void openFile(f);
              e.target.value = "";
            }}
          />
          <button type="button" className="btn ghost" onClick={saveGraph}>
            <Icon name="download" size={16} />
            {S.saveGraph}
          </button>
          <button type="button" className="btn primary" disabled={!prompts.length} onClick={saveAll}>
            <Icon name="download" size={16} />
            {S.saveAll}
          </button>
        </div>
        <div className="gstatus">
          <span className="num">{`${prompts.length} prompts ready`}</span>
          <span className="num">{`${images} of 30 images`}</span>
          <span>{S.promptsOnly}</span>
          {result.ok ? null : <span className="gbad">{result.error}</span>}
        </div>
        <Canvas outputs={outputs} fitSignal={fitSignal} />
        <p className="gkeys">{S.keysHelp}</p>
      </main>
    </div>
  );
}

function commitZoom(factor: number): void {
  const r = document.querySelector(".gcanvas")?.getBoundingClientRect();
  const v = zoomAt(graph().view, (r?.width ?? 800) / 2, (r?.height ?? 600) / 2, factor);
  commitView(setView(graph(), v));
}
