// Runs the renders the user confirmed, one after another, through the app's
// provider layer (the same one the Render tab uses). Stops at the first error
// and asks before going on, so a bad key never burns through the list.
// Stop all cancels the render in progress; finished renders are kept.

import { getState } from "../../store";
import { makeProvider } from "../../core/settings";
import { nearestAspectRatio } from "../../core/prompt";
import { friendlyError } from "../../core/errors";
import { findKieModel } from "../../core/providers/kie-models";
import { editModelId, record, refreshCredits } from "../../actions";
import { resultKey } from "../../core/graph";
import type { JobKind, RenderJob, SettingsByKind } from "../../core/graph";
import type { ImageData64, ToolId } from "../../core/types";
import { imageSize } from "../../core/images";
import { styleCopyPrompt } from "../../lib/lighting";
import { lightingText } from "../../core/prompt";
import { toast } from "../../toasts";
import { getCanvas, graph, patchJob, setResult, setRun } from "./session";
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

const TOOL: Record<JobKind, ToolId> = { render: "render", style: "style-copy", relight: "lighting", view: "view", edit: "spot-edit" };

/** The pictures and final prompt for a job, or why it can't run now. */
async function inputsFor(job: RenderJob): Promise<{ images: ImageData64[]; prompt: string } | { skip: string }> {
  const c = getCanvas();
  if (job.sourceKey) {
    // A chain step works on the result before it, made earlier in this run or before.
    const src = c.results[job.sourceKey];
    return src ? { images: [src.image], prompt: job.prompt } : { skip: S.noSource };
  }
  const pic = c.pictures[job.imageNodeId];
  if (!pic) return { skip: S.notLoaded };
  if (job.kind === "style") {
    const ref = job.refImageNodeId ? c.pictures[job.refImageNodeId] : undefined;
    if (!ref) return { skip: S.notLoaded };
    // As on the Edit tab: the prompt names Image 1's shape so the result keeps it.
    const size = await imageSize(pic.full);
    const node = graph().nodes.find((n) => n.id === job.renderNodeId);
    const s = node?.settings as SettingsByKind["style"] | undefined;
    const dial = !s || s.light === "reference" ? null : (lightingText(s.light) ?? "").replace(/\.$/, "").toLowerCase() || null;
    const prompt = styleCopyPrompt({ scene: job.scene, dialLight: dial, base: { width: size.width, height: size.height, ratio: nearestAspectRatio(size.width, size.height) } });
    return { images: [pic.full, ref.full], prompt };
  }
  return { images: [pic.full], prompt: job.prompt };
}

export async function runJobs(jobs: RenderJob[]): Promise<void> {
  if (isRunning() || !jobs.length) return;
  const st = getState();
  const settings = st.settings;
  const provider = makeProvider(settings, st.host);
  // Steps that work on a picture use the Edit tab's model, as the Edit tab does.
  const editProvider = settings.backend === "kie" ? makeProvider({ ...settings, kieModel: editModelId() }, st.host) : provider;
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
    const work = await inputsFor(job);
    if ("skip" in work) {
      patchJob(key, { status: "skipped", error: work.skip });
      continue;
    }
    patchJob(key, { status: "rendering" });
    abort = typeof AbortController === "undefined" ? null : new AbortController();
    try {
      const src = work.images[0];
      const w = src.width ?? 4;
      const h = src.height ?? 3;
      const p = job.kind === "render" ? provider : editProvider;
      const res = await p.render({ prompt: work.prompt, images: work.images, aspectRatio: nearestAspectRatio(w, h) }, abort?.signal);
      const historyId = await record(TOOL[job.kind], work.prompt, src, res.image, {
        name: job.lookName,
        model: job.kind === "render" || settings.backend !== "kie" ? undefined : editModelId(),
      });
      setResult(key, { promptHash: job.promptHash, image: res.image, before: src, historyId, at: Date.now() });
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
