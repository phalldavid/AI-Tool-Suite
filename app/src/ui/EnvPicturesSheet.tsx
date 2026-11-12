// Developer tool: make card pictures from contact sheets, for environments or looks.
// Each sheet comes from Gemini (copy prompt, paste the image back) or Kie, and is cut
// into thumbnails kept on this computer until exported and baked into the app.

import { useEffect, useState } from "react";
import { setState, useApp } from "../store";
import { clipboardImage, fileToImage, renderSheet } from "../actions";
import { ENV_SHEETS, cutEnvSheet, envExport, envMadeCount, envPicture, envSheetPrompt, loadEnvTiles, onEnvTiles, saveEnvSheet } from "../lib/envPreviews";
import { LOOK_SHEETS, loadLookTiles, lookExport, lookMadeCount, lookSheetPrompt, lookSheetThumbs, onLookTiles, saveLookSheet } from "../lib/lookPreviews";
import type { ImageData64 } from "../core/types";
import { toast } from "../toasts";
import { Sheet } from "./Sheet";
import { Icon } from "./Icon";

export function useEnvTiles(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    void loadEnvTiles();
    return onEnvTiles(() => setN((x) => x + 1));
  }, []);
  return n;
}

export function useLookTiles(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    void loadLookTiles();
    return onLookTiles(() => setN((x) => x + 1));
  }, []);
  return n;
}

interface PicSheet {
  id: string;
  label: string;
  grid: string;
  ratio: string;
  prompt: string;
  thumbs: (string | null)[];
  save: (img: ImageData64) => Promise<{ ok: boolean; issues: string[]; n: number }>;
}

function envSheets(): PicSheet[] {
  return ENV_SHEETS.map((s) => ({
    id: s.id,
    label: s.label,
    grid: `${s.cols} × ${s.rows}`,
    ratio: s.ratio,
    prompt: envSheetPrompt(s),
    thumbs: s.ids.map(envPicture),
    save: async (img) => {
      const cut = await cutEnvSheet(img, s);
      await saveEnvSheet(s, img, cut);
      return { ok: cut.check.ok, issues: cut.check.issues ?? [], n: cut.tiles.length };
    },
  }));
}

function lookSheets(): PicSheet[] {
  return LOOK_SHEETS.map((d) => ({
    id: d.id,
    label: d.label,
    grid: `${d.cols} × ${d.rows}`,
    ratio: d.ratio,
    prompt: lookSheetPrompt(d),
    thumbs: lookSheetThumbs(d),
    save: async (img) => {
      const cut = await saveLookSheet(d, img);
      return { ok: cut.check.ok, issues: cut.check.issues ?? [], n: cut.tiles.length };
    },
  }));
}

export function EnvPicturesSheet() {
  const open = useApp((s) => s.libOpen);
  useEnvTiles();
  useLookTiles();
  const kind = open === "env-pics" ? "env" : open === "look-pics" ? "look" : null;
  const close = () => setState({ libOpen: kind === "look" ? "look" : "env" });
  const sheets = kind === "look" ? lookSheets() : envSheets();
  const made = kind === "look" ? lookMadeCount() : envMadeCount();
  const total = sheets.reduce((n, s) => n + s.thumbs.length, 0);
  return (
    <Sheet
      open={Boolean(kind)}
      onClose={close}
      title={kind === "look" ? "Look pictures · developer" : "Environment pictures · developer"}
      labelledBy="pics-title"
      foot={
        <>
          <small style={{ color: "var(--muted)" }}>{made} of {total} made on this computer</small>
          <div className="end">
            <button
              type="button"
              className="btn ghost"
              disabled={!made}
              title="For baking the pictures into the app for everyone"
              onClick={() => {
                const blob = new Blob([kind === "look" ? lookExport() : envExport()], { type: "application/json" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = kind === "look" ? "style-previews.json" : "env-previews.json";
                a.click();
                URL.revokeObjectURL(a.href);
              }}
            >
              <Icon name="download" /> Export for the app
            </button>
            <button type="button" className="btn primary" onClick={close}>Done</button>
          </div>
        </>
      }
    >
      <div className="sheet-body thin">
        <p className="note" style={{ margin: 0 }}>
          Each sheet is one image of the same {kind === "look" ? "building or room in a grid of styles" : "house in 12 surroundings"}, cut into thumbnails. Make it free in Gemini (copy the prompt, paste the picture back here), or with Kie for about 6 credits.
        </p>
        {sheets.map((s) => <SheetRow key={s.id} s={s} />)}
      </div>
    </Sheet>
  );
}

function SheetRow({ s }: { s: PicSheet }) {
  const busy = useApp((x) => x.busy);
  const [issues, setIssues] = useState<string[]>([]);
  const use = async (img: ImageData64 | null) => {
    if (!img) return void toast("No picture found. Copy the finished sheet in Gemini first, or upload the file.", "warn");
    const r = await s.save(img);
    setIssues(r.issues);
    toast(`${s.label}: ${r.n} pictures saved`, r.ok ? "ok" : "warn");
  };
  return (
    <section className="envsheet">
      <div className="envsheet-head">
        <b>{s.label}</b>
        <small>{s.grid} · {s.ratio}</small>
      </div>
      <div className="envsheet-strip" style={{ gridTemplateColumns: `repeat(${Math.min(12, s.thumbs.length)}, minmax(0, 1fr))` }}>
        {s.thumbs.map((pic, i) => (pic ? <img key={i} src={pic} alt="" /> : <span key={i} className="ph" />))}
      </div>
      <div className="row-btns">
        <button
          type="button"
          className="btn"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(s.prompt);
              toast(`Prompt copied. In Gemini, choose ${s.ratio} if asked, paste and send.`, "ok");
              window.open("https://gemini.google.com/app", "_blank", "noopener");
            } catch {
              toast("Couldn't copy the prompt.", "error");
            }
          }}
        >
          <Icon name="clipboard" /> Copy prompt
        </button>
        <button type="button" className="btn" onClick={async () => use(await clipboardImage())}>
          <Icon name="image" /> Paste sheet
        </button>
        <label className="btn" style={{ cursor: "pointer" }}>
          <Icon name="image" /> Upload
          <input type="file" accept="image/*" className="sr-only" onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) await use(await fileToImage(f, 4096));
          }} />
        </label>
        <button type="button" className="btn" disabled={Boolean(busy)} title="Nano Banana 2.1 at 2K, about 6 credits" onClick={async () => use(await renderSheet(s.prompt, s.ratio))}>
          <Icon name="aperture" /> Kie · 6 cr
        </button>
      </div>
      {issues.length ? <p className="note" style={{ margin: 0, color: "var(--warn)" }}>{issues.join(" ")}</p> : null}
    </section>
  );
}
