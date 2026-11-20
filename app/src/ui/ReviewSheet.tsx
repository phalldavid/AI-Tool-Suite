import { useEffect, useState } from "react";
import { useApp } from "../store";
import { closeReview, confirmReview, buildPrompt, editModelId, fileName, updateSettings } from "../actions";
import { toast } from "../toasts";
import { renderCost, usd } from "../lib/cost";
import { findKieModel } from "../core/providers/kie-models";
import { Sheet } from "./Sheet";
import { Icon } from "./Icon";
import { baseName } from "../lib/room";

/** Saves text as a file in the browser's downloads. */
function saveText(name: string, text: string, type: string): void {
  try {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Prompt saved", "ok");
  } catch {
    toast("Couldn't save the file.", "error");
  }
}

export function ReviewSheet() {
  const review = useApp((s) => s.review);
  const s = useApp((x) => x.settings);
  const balance = useApp((x) => x.kieCredits);
  const preset = useApp((x) => x.preset);
  const imageName = useApp((x) => x.captureName);
  const [text, setText] = useState("");
  useEffect(() => setText(review?.prompt ?? ""), [review]);
  if (!review) return <Sheet open={false} onClose={closeReview}>{null}</Sheet>;
  const editTool = review.kind === "edit" || review.kind === "view" || review.kind === "shots" || review.kind === "style";
  const modelId = editTool && s.backend === "kie" ? editModelId() : s.kieModel;
  const one = renderCost(s, modelId);
  const n = review.batch?.length ?? 1;
  const cost = n > 1 && one.credits !== null ? { ...one, credits: one.credits * n, label: `${one.credits * n} credits` } : one;
  const removed = review.kind === "render" ? buildPrompt().removed : [];
  const where = s.testMode
    ? "Nothing is sent. Test mode makes a sample image."
    : s.backend === "kie"
      ? "Uploaded to Kie.ai to render. Not stored by David Render Studio."
      : s.backend === "gemini"
        ? "Sent to Google's Gemini API with your key."
        : s.backend === "comfyui"
          ? "Stays on your computer (ComfyUI)."
          : "You paste it into the site yourself in the next step.";
  const words = text.trim().split(/\s+/).length;
  const low = s.backend === "kie" && !s.testMode && balance !== null && cost.credits !== null && cost.credits > balance;
  const variations = s.backend !== "browser" || s.testMode;
  return (
    <Sheet
      open
      onClose={closeReview}
      title={s.slorCheamMode && review.kind === "render" ? "Review · Slor Cheam Mode" : "Review before render"}
      labelledBy="review-title"
      foot={
        <>
          <small style={{ color: "var(--muted)" }}>Enter renders · Esc goes back</small>
          <div className="end">
            <button type="button" className="btn ghost" onClick={closeReview}>Back</button>
            <button type="button" className="btn primary" autoFocus onClick={() => void confirmReview(text)}>
              {s.backend === "browser" && !s.testMode ? "Next: copy and paste" : `${low ? "Render anyway" : n > 1 ? `Render ${n} views` : s.imageCount > 1 ? `Render ${s.imageCount} variations` : "Render"} · ${cost.label}`}
            </button>
          </div>
        </>
      }
    >
      <div className="sheet-body thin">
        {low ? (
          <div className="check warn">
            <Icon name="warn" size={18} style={{ color: "var(--warn)", marginTop: 1 }} />
            <div><b>Not enough credits</b><small>This costs {cost.credits} credits and your Kie balance is {Math.round(balance! * 100) / 100}. Top up on kie.ai, pick a lower-cost model, or use fewer variations.</small></div>
          </div>
        ) : null}
        {review.lint.fixes.length || review.lint.warnings.length || removed.length ? (
          <section className="step" style={{ gap: 8 }}>
            <h3 style={{ fontSize: 13, color: "var(--soft)" }}>Checks</h3>
            {review.lint.fixes.map((f) => (
              <div key={f} className="check fix">
                <Icon name="check" size={18} style={{ color: "var(--ok)", marginTop: 1 }} />
                <div><b>Fixed for you</b><small>{f}</small></div>
              </div>
            ))}
            {removed.length ? (
              <div className="check fix">
                <Icon name="lock" size={18} style={{ color: "var(--ok)", marginTop: 1 }} />
                <div><b>Kept your building as modelled</b><small>Left out of the look because geometry is locked: “{removed.join("”, “")}”.</small></div>
              </div>
            ) : null}
            {review.lint.warnings.map((w) => (
              <div key={w} className="check warn">
                <Icon name="warn" size={18} style={{ color: "var(--warn)", marginTop: 1 }} />
                <div><b>Check this</b><small>{w}</small></div>
              </div>
            ))}
          </section>
        ) : null}
        <section className="field">
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <label htmlFor="rv-prompt" style={{ fontWeight: 600, color: "var(--soft)" }}>Final prompt</label>
            <span className="num" style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)" }}>Editable · {words} words</span>
          </div>
          <textarea
            id="rv-prompt"
            className="input mono"
            rows={9}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void confirmReview(text);
            }}
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn ghost"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(text);
                  toast("Prompt copied", "ok");
                } catch {
                  toast("Couldn't copy. Select the text and press Ctrl C.", "error");
                }
              }}
            >
              <Icon name="clipboard" /> Copy
            </button>
            <button type="button" className="btn ghost" onClick={() => saveText(`${fileName(baseName(imageName) || "prompt")}.txt`, `${text}\n`, "text/plain")}>
              <Icon name="download" /> Save as .txt
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() =>
                saveText(
                  `${fileName(baseName(imageName) || "prompt")}.json`,
                  `${JSON.stringify({ app: "David Render Studio", saved: new Date().toISOString(), preset: { id: preset.id, name: preset.name }, prompt: text }, null, 2)}\n`,
                  "application/json",
                )
              }
            >
              <Icon name="download" /> Save as .json
            </button>
          </div>
        </section>
        <div className="grid2">
          <div className="tile">
            <div className="k">Cost</div>
            <div className="v num">{cost.credits !== null ? `${cost.credits} credits` : cost.label}</div>
            <small style={{ color: "var(--soft)" }}>
              {s.backend === "kie" && !s.testMode ? `${findKieModel(modelId).label} · ${s.kieResolution} · ${s.imageCount} image${s.imageCount > 1 ? "s" : ""}${cost.credits !== null ? ` · about ${usd(cost.credits)}` : ""}` : !review.images.length ? "Prompt only, no image" : review.images.length > 1 ? `${review.images.length} images sent` : "1 image sent"}
            </small>
          </div>
          {variations ? (
            <div className="tile">
              <div className="k">Variations</div>
              <div className="tabs3" role="radiogroup" aria-label="How many variations" style={{ marginTop: 6, gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
                {[1, 2, 3, 4].map((k) => (
                  <button key={k} type="button" role="radio" aria-checked={s.imageCount === k} onClick={() => void updateSettings({ imageCount: k })}>×{k}</button>
                ))}
              </div>
              <small style={{ color: "var(--soft)" }}>Same prompt, {s.imageCount > 1 ? `${s.imageCount} results to pick from` : "one result"}. Each one costs a render.</small>
            </div>
          ) : null}
          <div className="tile">
            <div className="k">Where your image goes</div>
            <div style={{ marginTop: 4, fontSize: 13 }}>{where}</div>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
