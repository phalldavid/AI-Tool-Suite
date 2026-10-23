// Builds the text prompt sent to the image model.
// Plain architectural language only: real materials, real lenses, natural light.

import { contextText } from "./context";
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

// Extra relight presets for the Edit tab, beside the time-of-day ones.
export const INTERIOR_RELIGHT: Option[] = [
  { id: "interior-day", sub: "Daylight + 3000K", swatch: ["#d9c7a4", "#f4ead6"], label: "Interior daylight", text: "natural daylight entering through the windows, balanced with warm 3000K ceiling lights, no blown-out windows" },
  { id: "interior-evening", sub: "Lamps at 2700K", swatch: ["#3a2a1c", "#c98a4a"], label: "Interior evening", text: "evening interior, warm 2700K lamps and cove lighting, soft shadows, dark exterior visible through the glass" },
  { id: "int-morning-sun", sub: "Sun patches", swatch: ["#f3d6a6", "#fff3dc"], label: "Morning sun in", text: "low morning sun streaming in through the windows, crisp sun patches on the floor and walls, soft bounce light, lights off" },
  { id: "int-overcast", sub: "Soft, even", swatch: ["#b7bcc2", "#e3e6e9"], label: "Overcast day", text: "soft even daylight from an overcast sky through the windows, no direct sun, gentle shadows, lights off" },
  { id: "int-night-moody", sub: "Low, warm", swatch: ["#140e0a", "#6b4426"], label: "Moody night", text: "night, only warm 2700K accent lights, table lamps and LED strips on, deep soft shadows, dark windows with faint city lights" },
  { id: "int-showroom", sub: "Bright 4000K", swatch: ["#e9eef3", "#ffffff"], label: "Bright showroom", text: "bright even 4000K ceiling lighting with track spotlights on displays, clean white light, minimal shadows" },
];

export const URBAN_RELIGHT: Option[] = [
  { id: "urb-blue-street", sub: "Shops lit", swatch: ["#162650", "#d08a4a"], label: "Blue hour street", text: "blue hour on the street, shop signs and shophouse windows lit warm, street lights just on, car head and tail lights" },
  { id: "urb-rain-night", sub: "Wet reflections", swatch: ["#0b0f1c", "#3b4a6b"], label: "Rainy night", text: "rainy night in the city, wet asphalt with long reflections of street lights and shop lights, light rain falling" },
  { id: "urb-midday-busy", sub: "Hard sun", swatch: ["#3d8ad6", "#f0e3c4"], label: "Busy midday", text: "harsh midday tropical sun, short hard shadows, bright hazy sky, heat shimmer above the road" },
  { id: "urb-golden-skyline", sub: "Low west sun", swatch: ["#58608c", "#f0a050"], label: "Golden skyline", text: "golden hour with the low sun from the west lighting the tops of the buildings, long shadows across the streets" },
  { id: "urb-night-market", sub: "Festoon lights", swatch: ["#120a05", "#c9792f"], label: "Night market", text: "night with festoon string lights and stall lamps, warm pools of light, people and stalls in the glow" },
  { id: "urb-monsoon", sub: "Storm sky", swatch: ["#38414c", "#8f9aa5"], label: "Monsoon storm", text: "dark monsoon storm clouds, heavy rain about to fall, flat grey light, wet ground" },
];

/** Prompt text for any relight option id from the Edit tab. */
export function relightText(id: string, facts?: SceneFacts): string | null {
  return lightingText(id, facts) ?? findOption([...INTERIOR_RELIGHT, ...URBAN_RELIGHT], id)?.text ?? null;
}

export interface FixtureSettings {
  /** exterior fixtures: true on, false off, null not said */
  exterior: boolean | null;
  led: boolean;
  strip: boolean;
  cabinet: boolean;
  kelvin: number;
}

/** One prompt line for the scene's light fixtures, by scene type. */
export function fixtureSettingsLine(type: ProjectType, f?: FixtureSettings): string | null {
  if (!f) return null;
  if (type === "interior") {
    const on: string[] = [];
    if (f.led) on.push("recessed LED downlights in the ceiling");
    if (f.strip) on.push("LED strip cove lighting along ceilings and shelves");
    if (f.cabinet) on.push("under-cabinet and in-cabinet LED lights");
    if (!on.length) return null;
    return `Interior lights switched on at ${f.kelvin}K: ${on.join(", ")}. Show their real glow and soft falloff on nearby surfaces.`;
  }
  if (f.exterior === true) {
    return `Exterior light fixtures switched on at ${f.kelvin}K: wall lights, entrance downlights, garden and facade uplights glowing, with soft pools of light on walls and paving.`;
  }
  if (f.exterior === false) return "All exterior light fixtures are switched off.";
  return null;
}

export interface EditZone {
  /** colour name used in the prompt, e.g. "red" */
  colour: string;
  instruction: string;
}

export interface ZoneEditOptions {
  /** only the painted copy is sent, not the clean original */
  singleImage?: boolean;
  /** new lighting for the whole picture, in the same request */
  lighting?: string | null;
}

/**
 * Spot edit with coloured zones, each with its own change, and optionally a
 * new lighting for the whole image, all in one request.
 */
export function buildZoneEditPrompt(zones: EditZone[], opts: ZoneEditOptions = {}): string {
  const used = zones.filter((z) => z.instruction.trim());
  const names = used.map((z) => z.colour);
  const painted = used.length === 1 ? `one area painted ${names[0]}` : `areas painted in ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  const lines: string[] = [];
  if (!used.length) {
    lines.push("Edit this image.");
  } else if (opts.singleImage) {
    lines.push(
      `Edit this image. It has ${painted} as see-through markers. The paint only marks where to work; read what is under it and replace it.`,
    );
  } else {
    lines.push("Edit the first image.", `The second image is the same picture with ${painted}.`);
  }
  lines.push(...used.map((z) => `Inside the ${z.colour} area only: ${z.instruction.trim().replace(/\.$/, "")}.`));
  if (opts.lighting) {
    lines.push(
      `Then change the lighting and sky of the whole picture to: ${opts.lighting}. Shadows, reflections and the new elements must all match this light. Keep every building, material, object and the camera exactly as they are apart from the painted changes.`,
    );
  } else if (used.length) {
    lines.push("Everything outside the painted areas must stay exactly as it is. Match the perspective, lighting and photographic quality of the rest of the image.");
  }
  if (used.length) lines.push("Remove every trace of the marker paint: no coloured tint may be left in the result.");
  lines.push("The result must look like a real photograph.");
  return lines.join("\n");
}

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

/**
 * Plain lighting text for a clock time in Phnom Penh (about 11.5 degrees
 * north): the sun is to the south from September to April and slightly to
 * the north from May to August. Sunrise is about 05:45-06:20, sunset about
 * 17:45-18:20 through the year.
 */
export function sunText(hour: number, month: number): string {
  const hh = `${String(Math.floor(hour)).padStart(2, "0")}:${String(Math.round((hour % 1) * 60)).padStart(2, "0")}`;
  const side = month >= 5 && month <= 8 ? "slightly to the north" : "to the south";
  if (hour < 5.75 || hour >= 19.25) return `night at ${hh}, dark sky, warm 2700K artificial light only`;
  if (hour < 6.5) return `dawn at ${hh}, sun just above the eastern horizon, pink and orange sky, very long soft shadows`;
  if (hour < 9) return `morning sun at ${hh}, low from the east and ${side}, warm soft light, long shadows`;
  if (hour < 15) return `tropical sun at ${hh}, high in the sky and ${side}, short crisp shadows`;
  if (hour < 17) return `afternoon sun at ${hh}, low from the west and ${side}, warm light, long shadows`;
  if (hour < 18) return `golden hour at ${hh}, very low warm sun from the west, long golden shadows`;
  if (hour < 18.6) return `dusk at ${hh}, sun just set in the west, glowing orange horizon, interior lights starting to show`;
  return `blue hour at ${hh}, deep blue sky after sunset, warm 2700K to 3000K interior lights glowing through the windows`;
}

/** Name of the light at a clock time, for the sun dial. */
export function sunPhase(hour: number): string {
  if (hour < 5.75 || hour >= 19.25) return "Night";
  if (hour < 6.5) return "Dawn";
  if (hour < 9) return "Morning";
  if (hour < 15) return "Midday";
  if (hour < 17) return "Afternoon";
  if (hour < 18) return "Golden hour";
  if (hour < 18.6) return "Dusk";
  return "Blue hour";
}

/** Lighting text taken from the SketchUp shadow time. */
export function sketchUpSunText(facts?: SceneFacts): string | null {
  const iso = facts?.shadowTime;
  if (!iso) return null;
  const hour = Number(iso.slice(11, 13)) + Number(iso.slice(14, 16)) / 60;
  return sunText(hour, Number(iso.slice(5, 7)));
}

/** "time:16:30" lighting ids come from the sun dial. */
export function parseDialTime(id: string): number | null {
  const m = /^time:(\d{1,2}):(\d{2})$/.exec(id);
  return m ? Number(m[1]) + Number(m[2]) / 60 : null;
}

export function dialTimeId(hour: number): string {
  const mins = Math.round(hour * 4) * 15; // snap to 15 minutes
  return `time:${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, "0")}`;
}

export const SKETCHUP_SUN: Option = {
  id: "sketchup",
  label: "SketchUp sun",
  sub: "Uses shadow time",
  swatch: ["#6f8fb3", "#f1d29b"],
  text: "",
};

export function lightingText(id: string, facts?: SceneFacts): string | null {
  const dial = parseDialTime(id);
  if (dial !== null) {
    const month = facts?.shadowTime ? Number(facts.shadowTime.slice(5, 7)) : new Date().getMonth() + 1;
    return sunText(dial, month);
  }
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
  /** How strictly the render must match the line drawing, 0..1. */
  lineStrength?: number;
  /** "photo" = real photograph (default), "cgi" = high-end 3D render look. */
  look?: RenderLook;
  /** Copy every material from the model one-to-one. */
  materialLock?: boolean;
  /** Improve realism only inside each material's own area. */
  boundaryLock?: boolean;
  /** Material list from Material DNA, one "Object: material" per line. */
  dna?: string[];
  /** People line written by Analyse people. */
  people?: string;
  /** A style reference image is sent after the view (and line pass). */
  referenceIndex?: number;
  /** Things to avoid, comma separated. */
  avoid?: string;
}

export type RenderLook = "photo" | "cgi";

export const DEFAULT_AVOID =
  "CGI look, plastic or fake materials, flat lighting, unrealistic reflections, overexposure, low contrast, cartoon or illustration style, warped lines, text, watermark";

export const MATERIAL_LOCK =
  "Material lock: keep every material, colour and texture exactly as modelled, one to one, with no substitutions.";
export const BOUNDARY_LOCK =
  "Boundary lock: only make each material more realistic inside its own existing area; do not move, merge or blend the edges between materials.";

/**
 * Prompt lines for the hidden-line pass. `strength` 0..1 sets how strictly
 * the result must follow it; the number is also stated as a percentage.
 */
export function geometryLines(strength: number): string[] {
  const k = Math.max(0, Math.min(1, strength));
  const pct = Math.round(k * 100);
  const out = [
    `Image 1 is the SketchUp view: use it for materials, colours and what each surface is. Image 2 is a hidden-line drawing of exactly the same view: it is the geometry driver. Geometry match: ${pct}%.`,
  ];
  if (k >= 0.9) {
    out.push(
      "Treat the line drawing as the strict source of truth. Every line in it must sit on a matching edge in the result at the same position in the frame: walls, roof edges, columns, mouldings, window and door frames, steps, railings and kerbs. Do not move, add, remove, resize or reshape any of them, and do not change the camera, perspective or crop. Only add surface texture, light and surroundings beyond the drawn edges.",
    );
  } else if (k >= 0.6) {
    out.push(
      "Follow the line drawing closely. Keep every main edge where it is drawn: building outline, roof lines, openings, columns and steps. Small details such as trim profiles, railings and planting may be refined, but nothing may move, and the camera must not change.",
    );
  } else if (k >= 0.3) {
    out.push(
      "Use the line drawing as a guide for the overall massing, roof shape, openings and camera. Details may be refined and realistic trim added, as long as the building stays clearly the same design.",
    );
  } else {
    out.push(
      "Use the line drawing only as a loose reference for composition and massing. Details and proportions may be reinterpreted freely while the building stays recognisable.",
    );
  }
  if (k >= 0.6) {
    out.push(
      "Where the materials text below mentions a form that is not in the drawing (number of storeys, roof type, balconies), ignore that part and follow the drawing.",
    );
  }
  return out;
}

export function buildRenderPrompt(input: RenderPromptInput): string {
  const { preset, notes, facts, hasLinePass, extras } = input;
  const cgi = input.look === "cgi";
  const strength = input.lineStrength ?? 0.8;
  const type = PROJECT_TYPES[preset.projectType];
  const lighting = lightingText(preset.lighting, facts);
  const env = contextText(preset.environment);

  const lines: string[] = [];
  lines.push(
    cgi
      ? `Turn the first image into a high-end architectural 3D visualisation (V-Ray or Corona quality) of this ${/of this (.+?)(,|$)/.exec(type.text)?.[1] ?? "design"}.`
      : `Turn the first image into ${type.text}.`,
  );
  if (!hasLinePass || strength >= 0.6) {
    lines.push(
      "Keep the exact geometry: building outline, massing, roof shape, floor levels, window and door positions, and camera angle must not change. Do not add or remove storeys, columns or openings.",
    );
  }
  if (hasLinePass) lines.push(...geometryLines(strength));
  if (input.materialLock) lines.push(MATERIAL_LOCK);
  if (input.boundaryLock) lines.push(BOUNDARY_LOCK);
  if (preset.style.trim()) lines.push(`Materials and style: ${preset.style.trim()}.`);
  if (input.dna?.length) {
    lines.push(`Material list (one line per surface or object, keep these materials):\n${input.dna.map((t) => `- ${t}`).join("\n")}`);
  }
  if (input.referenceIndex) {
    lines.push(
      `Image ${input.referenceIndex} is a style reference only: match its mood, colour palette and material quality, but never copy its geometry, layout or objects.`,
    );
  }
  if (lighting) lines.push(`Lighting: ${lighting}.`);
  lines.push(...fixtureLines(facts));
  if (env) lines.push(`Surroundings: ${env}.`);
  if (extras?.length) lines.push(...extras);
  if (input.people?.trim()) lines.push(`People: ${input.people.trim()}`);
  if (!extras?.some((x) => x.startsWith("Camera and effects:"))) lines.push(`Camera: ${lensHint(preset.projectType, facts)}.`);
  if (notes?.trim()) {
    const khmer = /[\u1780-\u17FF]/.test(notes);
    const n = notes.trim();
    lines.push(`Additional notes${khmer ? " (written in Khmer; read them in Khmer and follow them)" : ""}: ${n}${/[.!?។]$/.test(n) ? "" : "."}`);
    if (input.dna?.length || input.materialLock) lines.push("Where these notes disagree with the material list or the material lock, follow the notes.");
  }
  lines.push(
    cgi
      ? "Make it a clean, polished 3D visualisation: accurate scale, crisp materials, balanced lighting. No text, no watermark."
      : "Make it look like a real photograph by a professional architectural photographer: true-to-life materials, accurate scale, natural colour. No text, no watermark, no illustration style.",
  );
  const avoid = input.avoid === undefined ? "" : input.avoid.trim();
  if (avoid) lines.push(`Avoid: ${cgi ? avoid.replace(/CGI look,?\s*/i, "") : avoid}.`);
  return lines.join("\n");
}

export function buildLightingPrompt(lightingId: string, notes?: string, facts?: SceneFacts): string {
  const lighting = relightText(lightingId, facts);
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
