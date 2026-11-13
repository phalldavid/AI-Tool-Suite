import { useEffect, useState } from "react";
import { useApp } from "../store";
import { closeReview, confirmReview, buildPrompt, editModelId, updateSettings } from "../actions";
import { renderCost, usd } from "../lib/cost";
import { findKieModel } from "../core/providers/kie-models";
import { Sheet } from "./Sheet";
import { Icon } from "./Icon";

export function ReviewSheet() {
  const review = useApp((s) => s.review);
  const s = useApp((x) => x.settings);
  const balance = useApp((x) => x.kieCredits);
  const [text, setText] = useState("");
  useEffect(() => setText(review?.prompt ?? ""), [review]);
  if (!review) return <Sheet open={false} onClose={closeReview}>{null}</Sheet>;
  const editTool = review.kind === "view" || review.kind === "shots" || review.kind === "style";
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
      title="Review before render"
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
