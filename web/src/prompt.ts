// Builds the text prompt sent to the image model.
// Plain architectural language only: real materials, real lenses, natural light.

import type { Preset, ProjectType, SceneFacts } from "./types";

export interface Option {
  id: string;
  label: string;
  text: string;
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
    label: "Morning, 07:00",
    text: "early morning sun from the east, soft warm light, long gentle shadows, clear sky with light haze",
  },
  {
    id: "noon",
    label: "Midday, 12:00",
    text: "midday tropical sun almost directly overhead, short crisp shadows under the overhangs, bright clear sky",
  },
  {
    id: "afternoon",
    label: "Late afternoon, 16:30",
    text: "low late-afternoon sun from the west, warm golden light, long shadows across the ground",
  },
  {
    id: "blue-hour",
    label: "Blue hour",
    text: "blue hour just after sunset, deep blue sky, warm 2700K to 3000K interior lights glowing through the windows",
  },
  {
    id: "overcast",
    label: "Overcast monsoon",
    text: "overcast monsoon sky, soft even daylight, wet ground with light reflections, no hard shadows",
  },
  {
    id: "night",
    label: "Night",
    text: "night scene, dark sky, warm 2700K interior and facade lighting, realistic light falloff, no lens flare",
  },
  {
    id: "interior-day",
    label: "Interior daylight",
    text: "natural daylight entering through the windows, balanced with warm 3000K ceiling lights, no blown-out windows",
  },
  {
    id: "interior-evening",
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
}

export function buildRenderPrompt(input: RenderPromptInput): string {
  const { preset, notes, facts, hasLinePass } = input;
  const type = PROJECT_TYPES[preset.projectType];
  const lighting = findOption(LIGHTING, preset.lighting);
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
  if (lighting) lines.push(`Lighting: ${lighting.text}.`);
  if (env && env.id !== "keep") lines.push(`Surroundings: ${env.text}.`);
  lines.push(`Camera: ${lensHint(preset.projectType, facts)}.`);
  if (notes?.trim()) lines.push(`Additional notes: ${notes.trim()}.`);
  lines.push(
    "Make it look like a real photograph by a professional architectural photographer: true-to-life materials, accurate scale, natural colour. No text, no watermark, no illustration style.",
  );
  return lines.join("\n");
}

export function buildLightingPrompt(lightingId: string, notes?: string): string {
  const lighting = findOption(LIGHTING, lightingId);
  const lines = [
    "Change only the lighting and sky of this image.",
    `New lighting: ${lighting ? lighting.text : lightingId}.`,
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
