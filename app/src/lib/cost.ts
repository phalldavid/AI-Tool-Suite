// What one press of Render costs (audits M-03, M-04).

import type { Settings } from "../core/settings";
import { creditsFor, findKieModel, USD_PER_CREDIT } from "../core/providers/kie-models";

export interface Cost {
  /** Kie credits for this press, all images included; null when not billed by credits. */
  credits: number | null;
  /** Short label for the button. */
  label: string;
  /** Spending needs a confirm step (keyboard shortcut, model switch). */
  paid: boolean;
}

export function renderCost(s: Settings, modelId = s.kieModel): Cost {
  if (s.testMode) return { credits: null, label: "Test", paid: false };
  if (s.backend === "browser") return { credits: null, label: "Free", paid: false };
  if (s.backend === "comfyui") return { credits: null, label: "Local", paid: false };
  if (s.backend === "gemini") return { credits: null, label: "Your Gemini key", paid: true };
  const per = creditsFor(findKieModel(modelId), s.kieResolution);
  const n = Math.max(1, Math.min(4, s.imageCount));
  if (per === null) return { credits: null, label: "Kie credits", paid: true };
  const credits = Math.round(per * n * 100) / 100;
  return { credits, label: `${credits} credits`, paid: true };
}

export function usd(credits: number): string {
  return `$${(credits * USD_PER_CREDIT).toFixed(2)}`;
}
