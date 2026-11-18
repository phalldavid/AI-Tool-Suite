// Planning a run of the canvas: which renders, what they cost, and whether the
// run is allowed. Pure: the canvas does the rendering, through the provider layer.
// Nothing here spends anything.

import type { RenderJob } from "./evaluate";
import { resultKey } from "./evaluate";

/** What a finished render is remembered by. */
export interface DoneMark {
  promptHash: string;
}

export interface RunPlan {
  /** Renders this run will make. */
  jobs: RenderJob[];
  /** Already rendered with this exact prompt: skipped, so nothing is paid twice. */
  done: RenderJob[];
  /** The Image node has no picture loaded (after a reload, for example). */
  noPicture: RenderJob[];
}

/**
 * Splits the jobs into ones to render, ones already rendered with the same
 * prompt, and ones whose picture is missing. `again` renders finished ones too.
 */
export function planRun(jobs: RenderJob[], hasPicture: (imageNodeId: string) => boolean, done: Record<string, DoneMark | undefined>, again = false): RunPlan {
  const plan: RunPlan = { jobs: [], done: [], noPicture: [] };
  const seen = new Set<string>();
  for (const j of jobs) {
    const key = resultKey(j);
    if (seen.has(key)) continue;
    seen.add(key);
    if (!hasPicture(j.imageNodeId)) plan.noPicture.push(j);
    else if (!again && done[key]?.promptHash === j.promptHash) plan.done.push(j);
    else plan.jobs.push(j);
  }
  return plan;
}

/** The cost of one render, as lib/cost.ts renderCost gives it for one image. */
export interface OneCost {
  credits: number | null;
  label: string;
  paid: boolean;
}

export interface RunCost {
  /** Total credits, or null when not billed by credits. */
  credits: number | null;
  /** Paid, but the price is not known: Run needs a second click. */
  unknown: boolean;
  paid: boolean;
  /** Short words for the button and the panel. */
  label: string;
}

export function runCost(n: number, one: OneCost, testMode: boolean): RunCost {
  if (testMode) return { credits: null, unknown: false, paid: false, label: "Test, nothing is spent" };
  if (!one.paid) return { credits: null, unknown: false, paid: false, label: one.label === "Local" ? "Your own PC, free" : "Free" };
  if (one.credits === null) return { credits: null, unknown: true, paid: true, label: "Cost unknown" };
  const credits = Math.round(one.credits * n * 100) / 100;
  return { credits, unknown: false, paid: true, label: `about ${credits} credits` };
}

export interface RunCheck {
  backend: "browser" | "kie" | "gemini" | "comfyui";
  testMode: boolean;
  /** Render nodes in the graph. */
  renderNodes: number;
  plan: RunPlan;
  cost: RunCost;
  cap: number;
  /** Kie balance when known. */
  balance: number | null;
}

/** Why Run is not allowed, in plain words, or null when it is. */
export function runBlocker(c: RunCheck): string | null {
  if (c.backend === "browser" && !c.testMode) {
    return "Prompt Copy can't render from the canvas. Copy or save the prompts, or pick Kie, Gemini API, ComfyUI or Test mode in Settings.";
  }
  if (!c.renderNodes) return "Add a Render node after a Prompt node to render.";
  const n = c.plan.jobs.length;
  if (!n) {
    if (c.plan.noPicture.length) return "The images have no picture loaded. Choose the pictures again on the Image nodes.";
    if (c.plan.done.length) return "Everything here is already rendered. Change a prompt, or use Render again.";
    return "Nothing to render yet. Wire images into a Prompt node, then the Prompt node into a Render node.";
  }
  if (n > c.cap) return `This run has ${n} renders; the limit is ${c.cap}. Render fewer, or raise the limit in Settings, Developer.`;
  if (!c.testMode && c.backend === "kie" && c.balance !== null && c.cost.credits !== null && c.cost.credits > c.balance) {
    return `Not enough credits: this run needs about ${c.cost.credits} and your Kie balance is ${Math.round(c.balance * 100) / 100}.`;
  }
  return null;
}

export const DEFAULT_RUN_CAP = 10;
export const MAX_RUN_CAP = 100;

export function clampCap(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.min(MAX_RUN_CAP, Math.max(1, Math.round(n))) : DEFAULT_RUN_CAP;
}
