// Prompts for working on a finished render (Edit tab and the Advanced tab's
// chain nodes). Pure, so both places give the same text for the same settings.

import { buildZoneEditPrompt, lightingText, parseDialTime, relightText } from "./prompt";
import type { SceneFacts } from "./types";
import { lightingGuidance } from "../lib/lighting";
import type { LightScene } from "../lib/lighting";
import { cameraPromptLine } from "../lib/camera";
import type { CameraMove } from "../lib/camera";
import { cameraViewPrompt } from "../lib/views";

/** New views copy the light of the look source; the Render tab's sun is not used. */
export const VIEW_SUN = "the same sun direction, time of day and sky as the look source image";

/** What the new light is like inside a room: no sun at all, sun, or soft daylight. */
export type LightMood = "dark" | "dusk" | "overcast" | "sun" | "artificial";

const DARK_IDS = new Set(["night", "interior-evening", "int-night-moody", "urb-rain-night", "urb-night-market"]);
const DUSK_IDS = new Set(["blue-hour", "urb-blue-street"]);
const OVERCAST_IDS = new Set(["overcast", "int-overcast", "urb-monsoon"]);

/** Reads a relight id or a dial time ("time:HH:MM") as one of the moods above. */
export function lightMood(lightId: string): LightMood {
  const hour = parseDialTime(lightId);
  if (hour !== null) {
    if (hour < 5.75 || hour >= 19.25) return "dark";
    if (hour < 6.5 || hour >= 18) return "dusk";
    return "sun";
  }
  if (DARK_IDS.has(lightId)) return "dark";
  if (DUSK_IDS.has(lightId)) return "dusk";
  if (OVERCAST_IDS.has(lightId)) return "overcast";
  if (lightId === "int-showroom") return "artificial";
  return "sun";
}

/**
 * Inside a room the old sun is baked into the picture: sun patches on the floor,
 * bright window light on the walls, hard shadows. Saying "change the sky" is not
 * enough, so each mood spells out what must go and what must stay.
 */
export function interiorRelightGuidance(mood: LightMood): string {
  const lead = "This picture shows a room, so the light inside the room must change too, not only the view through the windows.";
  const clear = "Remove every sun patch, sunbeam and bright window-shaped light on the floor, walls, ceiling, furniture and fittings, and every hard shadow that the old sun cast.";
  switch (mood) {
    case "dark":
      return `${lead} There is no sun at all in the new light. ${clear} Also remove the soft daylight glow near the windows. Windows, glass doors and openings show the dark outside only. The room is lit only by the light fittings already in the picture, with warm light, soft falloff and shadows that come from those fittings. No surface may still look sunlit or daylit.`;
    case "dusk":
      return `${lead} The sun has set. ${clear} Windows, glass doors and openings show the deep blue sky. Only a faint cool blue skylight reaches the room. The light fittings already in the picture are on and give the main light, warm and soft, with shadows that come from them.`;
    case "overcast":
      return `${lead} There is no direct sun. ${clear} Soft, even, slightly cool daylight comes in through the windows with gentle, wide shadows and no hard edges. The view through the windows shows the grey sky.`;
    case "artificial":
      return `${lead} Daylight is not the main light. ${clear} Light comes from the ceiling and display fittings already in the picture, even and clean, and the windows are not blown out.`;
    default:
      return `${lead} Sunlight comes through the windows from the direction of the new sun. ${clear} Then draw new sun patches and shadows from the new sun direction and angle only. Keep the windows correctly exposed, not blown out.`;
  }
}

/** Relight: only the lighting and sky change. */
export function relightPrompt(lightId: string, scene: LightScene, facts?: SceneFacts): string {
  const light = relightText(lightId, facts) ?? lightingText(lightId) ?? lightId;
  const where = scene === "interior" ? interiorRelightGuidance(lightMood(lightId)) : `${lightingGuidance(scene)} Light seen through windows, doors and glass must match the new light too.`;
  return `Change only the lighting and sky of this image to: ${light}. ${where} Shadows and reflections must match the new light everywhere in the picture. Keep every building, material, object and the camera exactly as they are. The result must look like a real photograph.`;
}

/** New camera on an approved render (Edit tab, New view, Move camera). */
export function newViewPrompt(camera: CameraMove, interior: boolean): string {
  return cameraViewPrompt(cameraPromptLine(camera), VIEW_SUN, [], interior);
}

/** A change in words for the whole picture (Edit tab, Spot edit with no painted zone). */
export function wordsEditPrompt(change: string): string {
  return buildZoneEditPrompt([], { general: change });
}
