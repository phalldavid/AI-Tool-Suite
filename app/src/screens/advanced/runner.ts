// Runs the renders the user confirmed, one after another, through the app's
// provider layer (the same one the Render tab uses). Stops at the first error
// and asks before going on, so a bad key never burns through the list.
// Stop all cancels the render in progress; finished renders are kept.

import { getState } from "../../store";
import { makeProvider } from "../../core/settings";
import { nearestAspectRatio } from "../../core/prompt";
import { friendlyError } from "../../core/errors";
import { findKieModel } from "../../core/providers/kie-models";
import { record, refreshCredits } from "../../actions";
import { resultKey } from "../../core/graph";
import type { RenderJob } from "../../core/graph";
import { toast } from "../../toasts";
import { getCanvas, patchJob, setResult, setRun } from "./session";
import { S } from "./strings";

let abort: AbortController | null = null;
/** Set while a failed render waits for "Go on" or "Stop". */
let decide: ((goOn: boolean) => void) | null = null;

/** "Test", or the backend and model, for the confirm step and the panel. */
export function whereLabel(): string {
  const s = getState().settings;
  if (s.testMode) return "Test mode";
  if (s.backend === "kie") return `Kie.ai · ${findKieModel(s.kieModel).label} · ${s.kieResolution}`;
  if (s.backend === "gemini") return "Gemini API";
  if (s.backend === "comfyui") return "ComfyUI";
  return "Prompt Copy";
}

export function isRunning(): boolean {
  const r = getCanvas().run;
  return Boolean(r && (r.status === "running" || r.status === "paused"));
}

/** Stop all: cancels the render in progress and the rest of the list. */
export function stopAll(): void {
  abort?.abort();
  if (decide) {
    decide(false);
    decide = null;
  }
}

/** After a failed render: go on with the rest, or stop. */
export function answerError(goOn: boolean): void {
  decide?.(goOn);
  decide = null;
}

export async function runJobs(jobs: RenderJob[]): Promise<void> {
  if (isRunning() || !jobs.length) return;
  const st = getState();
  const settings = st.settings;
  const provider = makeProvider(settings, st.host);
  setRun({
    status: "running",
    where: whereLabel(),
    startedAt: Date.now(),
    jobs: jobs.map((j) => ({ key: resultKey(j), name: j.name, lookName: j.lookName, status: "waiting" })),
  });
  let stopped = false;
  let made = 0;
  for (const job of jobs) {
    const key = resultKey(job);
    if (stopped) {
      patchJob(key, { status: "stopped" });
      continue;
    }
    const pic = getCanvas().pictures[job.imageNodeId];
    if (!pic) {
      patchJob(key, { status: "skipped", error: S.notLoaded });
      continue;
    }
    patchJob(key, { status: "rendering" });
    abort = typeof AbortController === "undefined" ? null : new AbortController();
    try {
      const w = pic.full.width ?? 4;
      const h = pic.full.height ?? 3;
      const res = await provider.render({ prompt: job.prompt, images: [pic.full], aspectRatio: nearestAspectRatio(w, h) }, abort?.signal);
      const historyId = await record("render", job.prompt, pic.full, res.image, { name: job.lookName });
      setResult(key, { promptHash: job.promptHash, image: res.image, before: pic.full, historyId, at: Date.now() });
      patchJob(key, { status: "done" });
      made++;
    } catch (e) {
      const err = e as Error;
      if (abort?.signal.aborted || err.name === "AbortError") {
        patchJob(key, { status: "stopped" });
        stopped = true;
        continue;
      }
      const nice = friendlyError(err.message)?.text ?? err.message;
      patchJob(key, { status: "failed", error: nice });
      // Ask before going on: the next one would most likely fail the same way.
      const r = getCanvas().run!;
      setRun({ ...r, status: "paused" });
      const goOn = await new Promise<boolean>((resolve) => {
        decide = resolve;
      });
      setRun({ ...getCanvas().run!, status: "running" });
      if (!goOn) stopped = true;
    } finally {
      abort = null;
    }
  }
  setRun({ ...getCanvas().run!, status: stopped ? "stopped" : "finished" });
  if (made) toast(made === 1 ? S.oneDone : `${made} renders done`, "ok");
  else if (stopped) toast(S.runStopped, "info");
  if (settings.backend === "kie" && !settings.testMode) {
    void refreshCredits();
    window.setTimeout(() => void refreshCredits(), 8000);
  }
}
