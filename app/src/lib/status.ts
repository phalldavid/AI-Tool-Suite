// What the header pill says about the AI connection (audit H-01).
// Green only after a real check. Copy-paste mode is never "Connected".

import type { Settings } from "../core/settings";
import { BROWSER_SITES } from "../core/settings";

export type KeyCheck = "unknown" | "checking" | "ok" | "bad" | "offline";

export interface BackendStatus {
  tone: "neutral" | "ok" | "bad";
  label: string;
  detail: string;
  /** What fixes it, when something is wrong. */
  fix?: "settings" | "free";
}

export function backendStatus(s: Settings, check: KeyCheck): BackendStatus {
  if (s.testMode) return { tone: "neutral", label: "Test mode", detail: "Renders are sample images. No key and no credits are used." };
  if (s.backend === "browser") {
    const site = BROWSER_SITES.find((x) => x.id === s.browserSite) ?? BROWSER_SITES[0];
    return { tone: "neutral", label: `Prompt Copy · ${site.label}`, detail: `You paste the view and prompt into ${site.label} yourself. Nothing is connected.` };
  }
  if (s.backend === "comfyui") {
    if (!s.comfyWorkflow.trim()) return { tone: "bad", label: "ComfyUI · no workflow", detail: "Add a workflow in Settings.", fix: "settings" };
    return { tone: "neutral", label: "ComfyUI · local", detail: `Renders on ${s.comfyUrl}. Start ComfyUI with --enable-cors-header.` };
  }
  const name = s.backend === "kie" ? "Kie" : "Gemini";
  const key = s.backend === "kie" ? s.kieKey : s.geminiKey;
  if (!key.trim()) return { tone: "bad", label: `No ${name} key`, detail: `Add your ${name} key in Settings, or use Prompt Copy (free).`, fix: "settings" };
  if (check === "bad") return { tone: "bad", label: "Key rejected", detail: `${name} rejected your API key. Paid renders are paused.`, fix: "settings" };
  if (check === "ok") return { tone: "ok", label: `${name} · key OK`, detail: `${name} accepted your key.` };
  if (check === "offline") return { tone: "neutral", label: `${name} · offline`, detail: "Couldn't reach the service to check your key." };
  return { tone: "neutral", label: `${name} · checking`, detail: "Checking your key." };
}
