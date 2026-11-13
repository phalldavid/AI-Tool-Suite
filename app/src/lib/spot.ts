// One-click instructions for Spot edit (per painted zone) and Global Edit (whole picture).

export interface QuickAction {
  id: string;
  label: string;
  text: string;
  icon: string;
  /** The opposite action (Add LED / Remove LED). Picking one takes the other out. */
  pair?: string;
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
      { id: "add-led", pair: "rm-led", label: "Add LED", icon: "plus", text: "Add recessed LED downlights here, switched on, with a realistic warm glow and soft light spill." },
      { id: "rm-led", pair: "add-led", label: "Remove LED", icon: "minus", text: "Remove the LED downlights here and fill the surface naturally." },
      { id: "add-strip", pair: "rm-strip", label: "Add LED strip", icon: "plus", text: "Add a continuous concealed LED strip along this area, glowing warm white with soft light spill." },
      { id: "rm-strip", pair: "add-strip", label: "Remove LED strip", icon: "minus", text: "Remove the LED strip here and keep the surface clean." },
      { id: "add-cove", pair: "rm-cove", label: "Add cove light", icon: "plus", text: "Add indirect cove lighting here: a hidden LED line washing the ceiling or wall with soft warm light." },
      { id: "rm-cove", pair: "add-cove", label: "Remove cove light", icon: "minus", text: "Remove the cove lighting here and keep the ceiling or wall evenly lit." },
      { id: "on", pair: "off", label: "Lights on", icon: "bulb", text: "Turn the light fittings here on, glowing with realistic spill and soft falloff." },
      { id: "off", pair: "on", label: "Lights off", icon: "bulb", text: "Turn the light fittings here off; keep the fittings visible." },
      { id: "restore", label: "Restore original", icon: "undo", text: "Restore the original architectural element that belongs here, matching the surrounding design exactly." },
    ],
  },
  {
    id: "decor",
    label: "Decor",
    actions: [
      { id: "add-decor", pair: "rm-decor", label: "Add decorations", icon: "plus", text: "Add tasteful decorative objects that suit the style of the space." },
      { id: "rm-decor", pair: "add-decor", label: "Remove decorations", icon: "minus", text: "Remove the decorative objects here and fill the surfaces naturally." },
      { id: "add-furn", pair: "rm-furn", label: "Add furniture", icon: "plus", text: "Add furniture that suits the style and scale of the space." },
      { id: "rm-furn", pair: "add-furn", label: "Remove furniture", icon: "minus", text: "Remove the furniture here and fill the floor and walls naturally." },
      { id: "add-plants", pair: "rm-plants", label: "Add plants", icon: "plus", text: "Add healthy tropical plants that suit the space and the light." },
      { id: "rm-plants", pair: "add-plants", label: "Remove plants", icon: "minus", text: "Remove the plants here and fill the ground or surface naturally." },
      { id: "add-people", pair: "rm-people", label: "Add people", icon: "plus", text: "Add one or two natural-looking people at the right scale, not looking at the camera." },
      { id: "rm-people", pair: "add-people", label: "Remove people", icon: "minus", text: "Remove the people here and fill the space naturally." },
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

/** Plants for "Add plants": a short name and the sentence. "{where}" is filled per pick. */
export const PLANTS: { id: string; label: string; text: string }[] = [
  { id: "mixed", label: "Tropical mix", text: "Add healthy tropical plants that suit the space and the light." },
  { id: "pothos", label: "Golden Pothos", text: "Add a Golden Pothos (also known as a Money Plant or Epipremnum aureum), a popular trailing houseplant sitting on a wall shelf, its vines hanging down naturally." },
  { id: "monstera", label: "Monstera", text: "Add a large Monstera deliciosa (Swiss cheese plant) in a matte ceramic floor pot, with big glossy split leaves." },
  { id: "fiddle", label: "Fiddle-leaf fig", text: "Add a tall Fiddle-leaf fig (Ficus lyrata) in a woven basket planter, about 1.6 m high, with broad upright leaves." },
  { id: "snake", label: "Snake plant", text: "Add a Snake plant (Sansevieria trifasciata) in a simple cylindrical pot, with stiff upright striped leaves." },
  { id: "areca", label: "Areca palm", text: "Add an Areca palm (Dypsis lutescens) in a large floor planter, with soft feathery fronds." },
  { id: "bird", label: "Bird of paradise", text: "Add a Bird of paradise (Strelitzia nicolai) in a large floor planter, with tall paddle-shaped leaves." },
  { id: "peace", label: "Peace lily", text: "Add a Peace lily (Spathiphyllum) in a small pot, with dark green leaves and a few white flowers." },
  { id: "zz", label: "ZZ plant", text: "Add a ZZ plant (Zamioculcas zamiifolia) in a low ceramic pot, with glossy dark green leaves." },
  { id: "fern", label: "Boston fern", text: "Add a Boston fern (Nephrolepis exaltata) in a hanging basket, with soft arching fronds." },
  { id: "philo", label: "Heartleaf philodendron", text: "Add a Heartleaf philodendron trailing from a high shelf or hanging planter, with heart-shaped leaves cascading down." },
  { id: "olive", label: "Olive tree (indoor)", text: "Add a small indoor olive tree in a textured stone pot, with silvery narrow leaves." },
  { id: "frangipani", label: "Frangipani (outdoor)", text: "Add a Frangipani tree (Plumeria) with white and yellow flowers, planted in the ground or a large outdoor planter." },
  { id: "bougain", label: "Bougainvillea (outdoor)", text: "Add Bougainvillea with magenta flowers climbing naturally over the wall or pergola." },
  { id: "bamboo", label: "Bamboo screen (outdoor)", text: "Add a slim row of clumping bamboo (Bambusa multiplex) as a green screen along the edge." },
];

/** Removes a sentence from a zone's text, with its line. */
export function removeLine(current: string, line: string): string {
  return current
    .split("\n")
    .map((l) => l.split(line).join("").replace(/\s{2,}/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

/** Adds a sentence to a zone's text, on its own line, without repeating it. */
export function appendLine(current: string, line: string): string {
  const t = current.trim();
  if (t.includes(line)) return current;
  return t ? `${t}\n${line}` : line;
}
