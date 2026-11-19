// Prompts for working on a finished render (Edit tab and the Advanced tab's
// chain nodes). Pure, so both places give the same text for the same settings.

import { buildZoneEditPrompt, lightingText, relightText } from "./prompt";
import type { SceneFacts } from "./types";
import { lightingGuidance } from "../lib/lighting";
import type { LightScene } from "../lib/lighting";
import { cameraPromptLine } from "../lib/camera";
import type { CameraMove } from "../lib/camera";
import { cameraViewPrompt } from "../lib/views";

/** New views copy the light of the look source; the Render tab's sun is not used. */
export const VIEW_SUN = "the same sun direction, time of day and sky as the look source image";

/** Relight: only the lighting and sky change. */
export function relightPrompt(lightId: string, scene: LightScene, facts?: SceneFacts): string {
  const light = relightText(lightId, facts) ?? lightingText(lightId) ?? lightId;
  return `Change only the lighting and sky of this image to: ${light}. ${lightingGuidance(scene)} Shadows and reflections must match the new light. Keep every building, material, object and the camera exactly as they are. The result must look like a real photograph.`;
}

/** New camera on an approved render (Edit tab, New view, Move camera). */
export function newViewPrompt(camera: CameraMove, interior: boolean): string {
  return cameraViewPrompt(cameraPromptLine(camera), VIEW_SUN, [], interior);
}

/** A change in words for the whole picture (Edit tab, Spot edit with no painted zone). */
export function wordsEditPrompt(change: string): string {
  return buildZoneEditPrompt([], { general: change });
}
