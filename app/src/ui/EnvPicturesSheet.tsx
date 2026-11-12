// Make the environment pictures: three contact sheets, each from Gemini (copy prompt,
// paste the image back) or from Kie. The sheet is cut into thumbnails and kept here.

import { useEffect, useState } from "react";
import { setState, useApp } from "../store";
import { clipboardImage, download, fileToImage, renderSheet } from "../actions";
import { ENV_SHEETS, cutEnvSheet, envExport, envMadeCount, envPicture, envSheetPrompt, loadEnvTiles, onEnvTiles, saveEnvSheet } from "../lib/envPreviews";
import type { EnvSheet } from "../lib/envPreviews";
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

export function EnvPicturesSheet() {
  const open = useApp((s) => s.libOpen === "env-pics");
  useEnvTiles();
  const close = () => setState({ libOpen: "env" });
  return (
    <Sheet
      open={open}
      onClose={close}
      title="Environment pictures"
      labelledBy="envpics-title"
      foot={
        <>
          <small style={{ color: "var(--muted)" }}>{envMadeCount()} of 36 have a picture</small>
          <div className="end">
            <button
              type="button"
              className="btn ghost"
              disabled={!envMadeCount()}
              title="For baking the pictures into the app for everyone"
              onClick={() => {
                const blob = new Blob([envExport()], { type: "application/json" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "env-previews.json";
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
          Same workflow as the style pictures: each sheet is one image of the same house in 12 surroundings, cut into thumbnails. Make it free in Gemini (copy the prompt, paste the picture back here), or with Kie for about 6 credits.
        </p>
        {ENV_SHEETS.map((s) => <SheetRow key={s.id} s={s} />)}
      </div>
    </Sheet>
  );
}

function SheetRow({ s }: { s: EnvSheet }) {
  const busy = useApp((x) => x.busy);
  const [issues, setIssues] = useState<string[]>([]);
  const use = async (img: ImageData64 | null, credits?: number) => {
    if (!img) return void toast("No picture found. Copy the finished sheet in Gemini first, or choose the file.", "warn");
    const cut = await cutEnvSheet(img, s);
    await saveEnvSheet(s, img, cut, credits);
    setIssues(cut.check.issues ?? []);
    toast(`${s.label}: ${cut.tiles.length} pictures saved`, cut.check.ok ? "ok" : "warn");
  };
  return (
    <section className="envsheet">
      <div className="envsheet-head">
        <b>{s.label}</b>
        <small>{s.cols} × {s.rows} · {s.ratio}</small>
      </div>
      <div className="envsheet-strip">
        {s.ids.map((id) => {
          const pic = envPicture(id);
          return pic ? <img key={id} src={pic} alt={id} title={id} /> : <span key={id} className="ph" title={id} />;
        })}
      </div>
      <div className="row-btns">
        <button
          type="button"
          className="btn"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(envSheetPrompt(s));
              toast("Prompt copied. In Gemini, choose 16:9 if asked, paste and send.", "ok");
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
        <button type="button" className="btn" disabled={Boolean(busy)} title="Nano Banana 2.1 at 2K, about 6 credits" onClick={async () => use(await renderSheet(envSheetPrompt(s), s.ratio), 6)}>
          <Icon name="aperture" /> Kie · 6 cr
        </button>
      </div>
      {issues.length ? <p className="note" style={{ margin: 0, color: "var(--warn)" }}>{issues.join(" ")}</p> : null}
    </section>
  );
}

void download;
