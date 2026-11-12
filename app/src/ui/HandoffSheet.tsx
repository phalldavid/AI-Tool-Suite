// Free path: copy the view, open the site, copy the prompt, paste the result back.

import { useState } from "react";
import { setState, useApp } from "../store";
import { copyImage, handoffSite, importResult } from "../actions";
import { toDataUrl } from "../core/images";
import { toast } from "../toasts";
import { Sheet } from "./Sheet";
import { Icon } from "./Icon";

export function HandoffSheet() {
  const h = useApp((s) => s.handoff);
  const [prompt, setPrompt] = useState("");
  const site = handoffSite();
  if (!h) return <Sheet open={false} onClose={() => undefined}>{null}</Sheet>;
  const text = prompt || h.prompt;
  const close = () => setState({ handoff: null });
  return (
    <Sheet open onClose={close} title={`Render in ${site.label} with your account`} labelledBy="handoff-title">
      <div className="sheet-body thin">
        <p className="note" style={{ margin: 0 }}>No key, no credits: your {site.label} plan applies. Copy the prompt, render there, then paste the result back anywhere on this page with Ctrl V.</p>
        <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          {h.images[0] ? (
            <li>
              <b>Copy your view and open {site.label}</b>
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
                <img src={toDataUrl(h.images[0])} alt="Your view" style={{ width: 120, height: 90, objectFit: "cover", borderRadius: 10 }} />
                <button
                  type="button"
                  className="btn primary"
                  onClick={async () => {
                    const copying = copyImage(h.images[0]);
                    window.open(site.url, "_blank", "noopener");
                    try {
                      await copying;
                      toast(`View copied. In ${site.label}, click the chat box and press Ctrl V.`, "ok");
                    } catch (e) {
                      toast((e as Error).message || "Couldn't copy the image.", "error");
                    }
                  }}
                >
                  <Icon name="clipboard" /> Copy view & open {site.label}
                </button>
              </div>
            </li>
          ) : null}
          {h.images[1] ? (
            <li>
              <b>Copy image 2 and paste it after the first one</b>
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
                <img src={toDataUrl(h.images[1])} alt="Image 2" style={{ width: 120, height: 90, objectFit: "cover", borderRadius: 10 }} />
                <button
                  type="button"
                  className="btn"
                  onClick={async () => {
                    try {
                      await copyImage(h.images[1]);
                      toast(`Image 2 copied. Paste it into ${site.label} after the first image.`, "ok");
                    } catch (e) {
                      toast((e as Error).message || "Couldn't copy the image.", "error");
                    }
                  }}
                >
                  <Icon name="clipboard" /> Copy image 2
                </button>
              </div>
            </li>
          ) : null}
          {h.images[0] ? null : (
            <li>
              <b>Open {site.label}</b>
              <div style={{ marginTop: 8 }}>
                <button type="button" className="btn primary" onClick={() => window.open(site.url, "_blank", "noopener")}>
                  <Icon name="external" /> Open {site.label}
                </button>
              </div>
            </li>
          )}
          <li>
            <b>Copy the prompt and send</b>
            <textarea className="input mono" rows={6} value={text} onChange={(e) => setPrompt(e.target.value)} style={{ marginTop: 8 }} aria-label="Prompt to paste" />
            <button
              type="button"
              className="btn"
              style={{ marginTop: 8 }}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(text);
                  toast("Prompt copied. Paste it under the image and send.", "ok");
                } catch {
                  toast("Couldn't copy. Select the text and press Ctrl C.", "error");
                }
              }}
            >
              <Icon name="clipboard" /> Copy prompt
            </button>
          </li>
          <li>
            <b>Bring the result back</b>
            <p style={{ margin: "6px 0 8px", color: "var(--soft)" }}>Copy the finished image in {site.label}, come back and press <span className="kbd">Ctrl V</span>, or choose the downloaded file.</p>
            <label className="btn" style={{ cursor: "pointer" }}>
              <Icon name="image" /> Choose result file
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && void importResult(e.target.files[0])} />
            </label>
          </li>
        </ol>
      </div>
    </Sheet>
  );
}
