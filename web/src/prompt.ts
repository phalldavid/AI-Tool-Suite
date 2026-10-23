// Builds the text prompt sent to the image model.
// Plain architectural language only: real materials, real lenses, natural light.

import type { Preset, ProjectType, SceneFacts } from "./types";

export interface Option {
  id: string;
  label: string;
  text: string;
  /** Short line under the label, e.g. a time of day. */
  sub?: string;
  /** Sky colours for the picker card, top to bottom. */
  swatch?: [string, string];
}

export const PROJECT_TYPES: Record<ProjectType, Option> = {
  exterior: {
    id: "exterior",
    label: "Exterior",
    text: "a photorealistic exterior architectural photograph of this building",
  },
  interior: {
    id: "interior",
    label: "Interior",
    text: "a photorealistic interior architectural photograph of this room",
  },
  aerial: {
    id: "aerial",
    label: "Aerial / masterplan",
    text: "a photorealistic aerial photograph of this site, taken from a drone",
  },
  sketch: {
    id: "sketch",
    label: "From sketch",
    text: "a photorealistic architectural photograph that follows this hand sketch",
  },
};

// Times of day for Phnom Penh, about 11.5 degrees north.
export const LIGHTING: Option[] = [
  {
    id: "morning",
    sub: "06:30 – 08:30",
    swatch: ["#9cc7e8", "#f3c98b"],
    label: "Morning, 07:00",
    text: "early morning sun from the east, soft warm light, long gentle shadows, clear sky with light haze",
  },
  {
    id: "noon",
    sub: "11:00 – 13:00",
    swatch: ["#4f9be0", "#cfe6f7"],
    label: "Midday, 12:00",
    text: "midday tropical sun almost directly overhead, short crisp shadows under the overhangs, bright clear sky",
  },
  {
    id: "afternoon",
    sub: "16:00 – 17:30",
    swatch: ["#e9a45a", "#f6dca6"],
    label: "Late afternoon, 16:30",
    text: "low late-afternoon sun from the west, warm golden light, long shadows across the ground",
  },
  {
    id: "blue-hour",
    sub: "18:15 – 18:45",
    swatch: ["#1d2c5a", "#4b6aa8"],
    label: "Blue hour",
    text: "blue hour just after sunset, deep blue sky, warm 2700K to 3000K interior lights glowing through the windows",
  },
  {
    id: "overcast",
    sub: "Rainy season",
    swatch: ["#8e979f", "#c9cfd4"],
    label: "Overcast monsoon",
    text: "overcast monsoon sky, soft even daylight, wet ground with light reflections, no hard shadows",
  },
  {
    id: "night",
    sub: "After 19:00",
    swatch: ["#0b0f1c", "#2a2f45"],
    label: "Night",
    text: "night scene, dark sky, warm 2700K interior and facade lighting, realistic light falloff, no lens flare",
  },
  {
    id: "interior-day",
    sub: "Daylight + 3000K",
    swatch: ["#d9c7a4", "#f4ead6"],
    label: "Interior daylight",
    text: "natural daylight entering through the windows, balanced with warm 3000K ceiling lights, no blown-out windows",
  },
  {
    id: "interior-evening",
    sub: "Lamps at 2700K",
    swatch: ["#3a2a1c", "#c98a4a"],
    label: "Interior evening",
    text: "evening interior, warm 2700K lamps and cove lighting, soft shadows, dark exterior visible through the glass",
  },
];

export const ENVIRONMENTS: Option[] = [
  {
    id: "keep",
    label: "Keep as modelled",
    text: "keep the surroundings as shown in the model",
  },
  {
    id: "pp-street",
    label: "Phnom Penh street",
    text: "a Phnom Penh street setting: paved footpath, street trees, parked motorbikes, a few pedestrians, neighbouring shophouses",
  },
  {
    id: "borey",
    label: "Borey estate",
    text: "inside a gated borey residential estate: concrete road, kerbs, young street trees, low boundary walls, neighbouring houses",
  },
  {
    id: "tropical-garden",
    label: "Tropical garden",
    text: "a mature tropical garden: frangipani, palms, banana plants, lawn and stepping stones",
  },
  {
    id: "riverside",
    label: "Riverside",
    text: "a riverside setting with a wide brown river, a promenade, and distant low-rise city skyline",
  },
  {
    id: "rural",
    label: "Rural Cambodia",
    text: "a rural Cambodian setting: rice fields, sugar palms, red laterite road, distant tree line",
  },
  {
    id: "beach",
    label: "Coastal resort",
    text: "a coastal resort setting near Kep or Sihanoukville: sand, coconut palms, calm sea in the distance",
  },
];

/** Lighting text taken from the SketchUp shadow time. */
export function sketchUpSunText(facts?: SceneFacts): string | null {
  const iso = facts?.shadowTime;
  if (!iso) return null;
  const hour = Number(iso.slice(11, 13)) + Number(iso.slice(14, 16)) / 60;
  const month = Number(iso.slice(5, 7));
  const hh = iso.slice(11, 16);
  // About 11.5 degrees north: sun to the south Sep to Apr, to the north May to Aug.
  const side = month >= 5 && month <= 8 ? "slightly to the north" : "to the south";
  if (hour < 6 || hour >= 19) return `night at ${hh}, dark sky, warm 2700K artificial light only`;
  if (hour < 9) return `morning sun at ${hh}, low from the east and ${side}, warm soft light, long shadows`;
  if (hour < 15) return `tropical sun at ${hh}, high in the sky and ${side}, short crisp shadows`;
  if (hour < 18) return `afternoon sun at ${hh}, low from the west and ${side}, warm golden light, long shadows`;
  return `dusk at ${hh}, sun just set in the west, glowing sky, interior lights starting to show`;
}

export const SKETCHUP_SUN: Option = {
  id: "sketchup",
  label: "SketchUp sun",
  sub: "Uses shadow time",
  swatch: ["#6f8fb3", "#f1d29b"],
  text: "",
};

export function lightingText(id: string, facts?: SceneFacts): string | null {
  if (id === "sketchup") return sketchUpSunText(facts) ?? findOption(LIGHTING, "morning")!.text;
  return findOption(LIGHTING, id)?.text ?? null;
}

/** Prompt lines describing light previews and mirrors placed in the model. */
export function fixtureLines(facts?: SceneFacts): string[] {
  const l = facts?.lights;
  if (!l || !l.visible) return [];
  const out: string[] = [];
  const kinds: string[] = [];
  if (l.spots) kinds.push("spotlights washing the walls");
  if (l.leds) kinds.push("LED strips");
  if (kinds.length) {
    const temp = l.kelvin.length ? ` at about ${l.kelvin.join("K and ")}K` : "";
    out.push(
      `The glowing shapes in the first image are light fixtures: ${kinds.join(" and ")}${temp}. Render them as real switched-on lights with the glow, falloff and soft spill on nearby surfaces that real fittings give, not as flat painted graphics.`,
    );
  }
  if (l.mirrors) {
    out.push("Faces showing a reflected picture of the room are mirrors or glass. Render them as clean silver mirrors with accurate reflections.");
  }
  return out;
}

export function findOption(list: Option[], id: string): Option | undefined {
  return list.find((o) => o.id === id);
}

/** Turns a SketchUp focal length into a plain lens instruction. */
export function lensHint(type: ProjectType, facts?: SceneFacts): string {
  const mm = facts?.focalLengthMm;
  if (facts?.perspective === false) {
    return "orthographic-looking view with no perspective distortion";
  }
  if (mm && mm > 0) {
    return `shot with a ${mm} mm lens (full-frame equivalent), straight vertical lines`;
  }
  if (type === "aerial") return "shot with a 24 mm tilt-shift lens, straight vertical lines";
  if (type === "interior") return "shot with a 24 mm lens at eye level, straight vertical lines";
  return "shot with a 35 mm lens at eye level, straight vertical lines";
}

export interface RenderPromptInput {
  preset: Preset;
  notes?: string;
  facts?: SceneFacts;
  hasLinePass: boolean;
  /** Lines from the dynamic prompt generators. */
  extras?: string[];
}

export function buildRenderPrompt(input: RenderPromptInput): string {
  const { preset, notes, facts, hasLinePass, extras } = input;
  const type = PROJECT_TYPES[preset.projectType];
  const lighting = lightingText(preset.lighting, facts);
  const env = findOption(ENVIRONMENTS, preset.environment);

  const lines: string[] = [];
  lines.push(`Turn the first image into ${type.text}.`);
  lines.push(
    "Keep the exact geometry: building outline, massing, roof shape, floor levels, window and door positions, and camera angle must not change. Do not add or remove storeys, columns or openings.",
  );
  if (hasLinePass) {
    lines.push(
      "The second image is a line drawing of the same view. Use it to hold every edge in place.",
    );
  }
  if (preset.style.trim()) lines.push(`Materials and style: ${preset.style.trim()}.`);
  if (lighting) lines.push(`Lighting: ${lighting}.`);
  lines.push(...fixtureLines(facts));
  if (env && env.id !== "keep") lines.push(`Surroundings: ${env.text}.`);
  if (extras?.length) lines.push(...extras);
  lines.push(`Camera: ${lensHint(preset.projectType, facts)}.`);
  if (notes?.trim()) lines.push(`Additional notes: ${notes.trim()}.`);
  lines.push(
    "Make it look like a real photograph by a professional architectural photographer: true-to-life materials, accurate scale, natural colour. No text, no watermark, no illustration style.",
  );
  return lines.join("\n");
}

export function buildLightingPrompt(lightingId: string, notes?: string, facts?: SceneFacts): string {
  const lighting = lightingText(lightingId, facts);
  const lines = [
    "Change only the lighting and sky of this image.",
    `New lighting: ${lighting ?? lightingId}.`,
    "Keep every building, material, object and the camera exactly as they are. Shadows must fall consistently with the new sun position.",
  ];
  if (notes?.trim()) lines.push(`Additional notes: ${notes.trim()}.`);
  lines.push("The result must still look like a real photograph.");
  return lines.join("\n");
}

export function buildSpotEditPrompt(instruction: string): string {
  return [
    "Edit the first image.",
    "The second image is the same picture with the area to change painted in red.",
    `Inside the red area only: ${instruction.trim()}.`,
    "Everything outside the red area must stay exactly as it is. Match the perspective, lighting and photographic quality of the rest of the image. Do not include any red paint in the result.",
  ].join("\n");
}

/** Supported output aspect ratios for Gemini image models. */
export const ASPECT_RATIOS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];

export function nearestAspectRatio(width: number, height: number): string {
  const target = width / height;
  let best = ASPECT_RATIOS[0];
  let bestDiff = Infinity;
  for (const r of ASPECT_RATIOS) {
    const [w, h] = r.split(":").map(Number);
    const diff = Math.abs(Math.log(w / h / target));
    if (diff < bestDiff) {
      bestDiff = diff;
      best = r;
    }
  }
  return best;
}
