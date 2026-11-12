// One-click instructions for Spot edit (per painted zone) and Global Edit (whole picture).

export interface QuickAction {
  id: string;
  label: string;
  text: string;
  icon: string;
}

export interface QuickGroup {
  id: string;
  label: string;
  actions: QuickAction[];
}

export const ZONE_GROUPS: QuickGroup[] = [
  {
    id: "light",
    label: "Lighting",
    actions: [
      { id: "add-led", label: "Add LED", icon: "plus", text: "Add recessed LED downlights here, switched on, with a realistic warm glow and soft light spill." },
      { id: "rm-led", label: "Remove LED", icon: "minus", text: "Remove the LED downlights here and fill the surface naturally." },
      { id: "add-strip", label: "Add LED strip", icon: "plus", text: "Add a continuous concealed LED strip along this area, glowing warm white with soft light spill." },
      { id: "rm-strip", label: "Remove LED strip", icon: "minus", text: "Remove the LED strip here and keep the surface clean." },
      { id: "add-cove", label: "Add cove light", icon: "plus", text: "Add indirect cove lighting here: a hidden LED line washing the ceiling or wall with soft warm light." },
      { id: "rm-cove", label: "Remove cove light", icon: "minus", text: "Remove the cove lighting here and keep the ceiling or wall evenly lit." },
      { id: "on", label: "Lights on", icon: "bulb", text: "Turn the light fittings here on, glowing with realistic spill and soft falloff." },
      { id: "off", label: "Lights off", icon: "bulb", text: "Turn the light fittings here off; keep the fittings visible." },
      { id: "restore", label: "Restore original", icon: "undo", text: "Restore the original architectural element that belongs here, matching the surrounding design exactly." },
    ],
  },
  {
    id: "decor",
    label: "Decor",
    actions: [
      { id: "add-decor", label: "Add decorations", icon: "plus", text: "Add tasteful decorative objects that suit the style of the space." },
      { id: "rm-decor", label: "Remove decorations", icon: "minus", text: "Remove the decorative objects here and fill the surfaces naturally." },
      { id: "add-furn", label: "Add furniture", icon: "plus", text: "Add furniture that suits the style and scale of the space." },
      { id: "rm-furn", label: "Remove furniture", icon: "minus", text: "Remove the furniture here and fill the floor and walls naturally." },
      { id: "add-plants", label: "Add plants", icon: "plus", text: "Add healthy tropical plants that suit the space and the light." },
      { id: "rm-plants", label: "Remove plants", icon: "minus", text: "Remove the plants here and fill the ground or surface naturally." },
      { id: "add-people", label: "Add people", icon: "plus", text: "Add one or two natural-looking people at the right scale, not looking at the camera." },
      { id: "rm-people", label: "Remove people", icon: "minus", text: "Remove the people here and fill the space naturally." },
    ],
  },
];

export const SURFACES = [
  { id: "surface", label: "Selected area" },
  { id: "wall", label: "Wall" },
  { id: "floor", label: "Floor" },
  { id: "ceiling", label: "Ceiling" },
];

export const MATERIALS = [
  "travertine",
  "marble",
  "natural stone",
  "flamed granite",
  "exposed concrete",
  "terrazzo",
  "light oak timber",
  "walnut timber",
  "teak timber",
  "brushed metal",
  "clear glass",
  "white render",
];

export function materialSentence(surface: string, material: string): string {
  const what = surface === "surface" ? "surface" : surface;
  return `Change the ${what} here to ${material.trim()}, with realistic texture, scale and reflections.`;
}

export const GLOBAL_PRESETS: QuickAction[] = [
  { id: "day-night", label: "Day to night", icon: "moon", text: "Change the whole scene from day to night: deep blue-black night sky, every interior and exterior light fitting switched on with a warm 2700K to 3000K glow, realistic light spill and reflections, no sunlight or daylight shadows." },
  { id: "night-day", label: "Night to day", icon: "sun", text: "Change the whole scene from night to day: clear daytime sky, natural sunlight with realistic shadows, artificial lights off." },
  { id: "lighting", label: "Better lighting", icon: "bulb", text: "Improve the overall lighting: balanced exposure, natural falloff, soft realistic shadows, no blown-out highlights." },
  { id: "realism", label: "More realism", icon: "aperture", text: "Make the whole image more photorealistic: real material textures, subtle imperfections, natural reflections, true-to-life colour, no CGI look." },
  { id: "materials", label: "Better materials", icon: "layers", text: "Enhance material quality everywhere: sharper real textures, correct scale, realistic reflections and roughness." },
  { id: "landscape", label: "Better landscaping", icon: "sprout", text: "Improve the landscaping: lush, well-kept tropical planting with layered trees, shrubs and ground cover suited to Cambodia." },
  { id: "rain", label: "Monsoon rain", icon: "map", text: "Change the weather to a monsoon shower: overcast sky, light rain, wet reflective ground, no hard shadows." },
  { id: "overcast", label: "Overcast", icon: "map", text: "Change the weather to a soft overcast sky with even, shadowless daylight." },
  { id: "warm", label: "Warm and inviting", icon: "sun", text: "Change the atmosphere to warm and inviting: golden tones and gentle contrast." },
  { id: "calm", label: "Calm and serene", icon: "sprout", text: "Change the atmosphere to calm and serene: soft light, muted tones, quiet mood." },
];

/** Adds a sentence to a zone's text, on its own line, without repeating it. */
export function appendLine(current: string, line: string): string {
  const t = current.trim();
  if (t.includes(line)) return current;
  return t ? `${t}\n${line}` : line;
}
