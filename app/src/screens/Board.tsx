// Edit tab > Board: make a presentation board picture, pin numbered captions on it,
// and download it laid out on a true A-series sheet. The model draws no text; the
// app draws the numbers, legend and title block (lib/board-sheet.ts).

import { useMemo, useRef, useState } from "react";
import { setState, useApp } from "../store";
import type { BoardSetup } from "../store";
import { editModelId, exportBoardSheet, runBoard, setPins } from "../actions";
import { BOARD_PRESETS, boardAspect, findBoardPreset, sheetMm, type SheetSize } from "../core/boards";
import { toDataUrl } from "../core/images";
import { renderCost } from "../lib/cost";
import { Icon } from "../ui/Icon";
import { ModelPicker } from "../ui/ModelPicker";
import { Foot } from "../ui/PhoneBar";
import { StopButton } from "../ui/RenderLoader";
import { useRatio } from "../ui/useRatio";

const SIZES: SheetSize[] = ["A0", "A1", "A2", "A3"];

function patchBoard(p: Partial<BoardSetup>) {
  setState((x) => ({ board: { ...x.board, ...p } }));
}

/** The picture area: the board with its pins. Click to add a pin, drag a pin to move it. */
export function BoardStage() {
  const v = useApp((s) => s.versions[s.activeVersion]);
  const isBoard = Boolean(v?.pins);
  const img = v?.image ?? null;
  const r = useRatio(img);
  const src = useMemo(() => (img ? toDataUrl(img) : ""), [img]);
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<number | null>(null);
  const busy = useApp((s) => s.busy);
  if (!v) return null;
  const pins = v.pins ?? [];
  const at = (e: React.PointerEvent) => {
    const b = frame.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)), y: Math.min(1, Math.max(0, (e.clientY - b.top) / b.height)) };
  };
  return (
    // Above the loader layer (which holds the last result) unless a render is running.
    <div className={`fit${busy ? "" : " board-top"}`}>
      <div
        ref={frame}
        className={`frame board-frame${isBoard ? " pinning" : ""}`}
        style={{ width: `min(100cqw, 100cqh * ${r.toFixed(4)})`, aspectRatio: `${r}` }}
        onPointerDown={(e) => {
          if (!isBoard || (e.target as HTMLElement).closest(".bpin")) return;
          const p = at(e);
          setPins([...pins, { ...p, text: "" }]);
        }}
        onPointerMove={(e) => {
          if (drag.current === null) return;
          const p = at(e);
          setPins(pins.map((x, i) => (i === drag.current ? { ...x, ...p } : x)));
        }}
        onPointerUp={() => (drag.current = null)}
      >
        <img src={src} alt={isBoard ? "Board" : "Image the board is made from"} draggable={false} />
        {pins.map((p, i) => (
          <button
            key={i}
            type="button"
            className="bpin"
            style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
            title={p.text || `Pin ${i + 1}: add a caption in the panel`}
            onPointerDown={(e) => {
              e.stopPropagation();
              drag.current = i;
              (e.currentTarget.parentElement as HTMLElement).setPointerCapture(e.pointerId);
            }}
          >
            {i + 1}
          </button>
        ))}
        {!isBoard ? <span className="board-hint">This is the source image. Make the board from the panel.</span> : null}
      </div>
    </div>
  );
}

export function BoardPanel() {
  const b = useApp((s) => s.board);
  const v = useApp((s) => s.versions[s.activeVersion]);
  const busy = useApp((s) => s.busy);
  const s = useApp((x) => x.settings);
  const cap = useApp((x) => x.capture);
  const [open, setOpen] = useState(false);
  const preset = findBoardPreset(b.preset);
  const cost = renderCost(s, s.backend === "kie" ? editModelId() : s.kieModel);
  const isBoard = Boolean(v?.pins);
  const pins = v?.pins ?? [];
  const [mmW, mmH] = sheetMm(b.size, b.orient);
  const hasSource = Boolean(v || cap);
  return (
    <>
      <div>
        <h2 style={{ fontSize: 22 }}>Presentation board</h2>
        <p className="sub">The AI makes the pictures. The app adds the numbers, captions and title block, so the text is always right.</p>
      </div>

      <section className="step">
        <h2 style={{ fontSize: 16 }}>Board type</h2>
        <div style={{ display: "grid", gap: 8 }}>
          {BOARD_PRESETS.map((p) => (
            <button key={p.id} type="button" className="fontopt" role="radio" aria-checked={preset.id === p.id} onClick={() => patchBoard({ preset: p.id })} style={{ alignItems: "flex-start", flexDirection: "column", gap: 2 }}>
              <b style={{ color: "var(--text)" }}>{p.label}</b>
              <small style={{ color: "var(--muted)" }}>{p.sub}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="step">
        <h2 style={{ fontSize: 16 }}>Sheet</h2>
        <div className="tabs3" style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))" }} role="radiogroup" aria-label="Sheet size">
          {SIZES.map((x) => (
            <button key={x} type="button" role="radio" aria-checked={b.size === x} onClick={() => patchBoard({ size: x })}>{x}</button>
          ))}
        </div>
        <div className="tabs2" role="radiogroup" aria-label="Orientation">
          <button type="button" role="radio" aria-checked={b.orient === "landscape"} onClick={() => patchBoard({ orient: "landscape" })}>Landscape</button>
          <button type="button" role="radio" aria-checked={b.orient === "portrait"} onClick={() => patchBoard({ orient: "portrait" })}>Portrait</button>
        </div>
        <small style={{ color: "var(--muted)" }}>{mmW} × {mmH} mm. The picture is made at {boardAspect(b.size, b.orient)}, then laid out on the sheet with a legend and title block.</small>
      </section>

      <section className="step">
        <div className="field">
          <label htmlFor="board-subject">What is on the board</label>
          <input id="board-subject" className="input" value={b.subject} placeholder={preset.subjectHint} onChange={(e) => patchBoard({ subject: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="board-title">Sheet title</label>
          <input id="board-title" className="input" value={b.title} placeholder={b.subject || preset.label} onChange={(e) => patchBoard({ title: e.target.value })} />
        </div>
        <button type="button" className="linkish" style={{ alignSelf: "flex-start" }} onClick={() => setOpen(!open)}>{open ? "Hide" : "Add"} extra wishes</button>
        {open ? <textarea className="input" rows={2} value={b.notes} placeholder="e.g. show the drawer open in the side view" onChange={(e) => patchBoard({ notes: e.target.value })} /> : null}
      </section>

      {isBoard ? (
        <section className="step">
          <div className="step-head">
            <h2 style={{ fontSize: 16 }}>Pins</h2>
            <small className="end" style={{ color: "var(--muted)" }}>Click the board to add, drag to move</small>
          </div>
          {pins.length ? (
            <div style={{ display: "grid", gap: 6 }}>
              {pins.map((p, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span className="bpin static">{i + 1}</span>
                  <input className="input" value={p.text} aria-label={`Caption for pin ${i + 1}`} placeholder={preset.pins[i] ?? "Caption"} onChange={(e) => setPins(pins.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
                  <button type="button" className="icon-btn" aria-label={`Remove pin ${i + 1}`} onClick={() => setPins(pins.filter((_, j) => j !== i))}>
                    <Icon name="close" size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="note" style={{ margin: 0 }}>No pins yet. Click on a part of the board to number it.</p>
          )}
          {pins.some((p) => !p.text) && preset.pins.length ? (
            <button type="button" className="linkish" style={{ alignSelf: "flex-start" }} onClick={() => setPins(pins.map((p, i) => (p.text ? p : { ...p, text: preset.pins[i] ?? "" })))}>Fill empty captions with suggestions</button>
          ) : null}
        </section>
      ) : null}

      <Foot inline>
        <ModelPicker edit />
        {busy ? (
          <StopButton />
        ) : (
          <>
            <button type="button" className={isBoard ? "btn" : "cta sheen"} disabled={!hasSource} onClick={() => void runBoard()}>
              <Icon name="grid" size={18} /> {isBoard ? "Make another" : "Make board"} · {cost.label}
            </button>
            {isBoard ? (
              <button type="button" className="cta sheen" onClick={() => void exportBoardSheet()}>
                <Icon name="download" size={18} /> Download {b.size} sheet
              </button>
            ) : null}
          </>
        )}
      </Foot>
    </>
  );
}
