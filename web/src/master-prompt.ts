// The brief flow: David's own routine, built in. He gives an image and one
// short line ("modern style at night, warm glow"); a vision model reads the
// image with the brief and writes a long master prompt in the shape of the
// ones he writes for Gemini. The master prompt is shown, editable, sent as
// is, and saved with the render. A reply under the result changes one thing
// at a time with the same model.

/** What the AI writer is asked to do. The brief drives style, mood and light. */
export function masterWriterPrompt(brief: string): string {
  const b = brief.trim() || "a photorealistic result with materials and light that suit the design";
  return `You are an architectural visualisation director. Look at the attached image (a SketchUp screenshot, CAD view, photo or hand sketch) and the client's brief. Write ONE master prompt for an image model that will turn this exact image into a photorealistic architectural photograph.

Client brief: "${b.replace(/"/g, "'")}"

The brief decides the style, mood, time of day and lighting. A short brief is expanded with professional judgement. A brief in Khmer is followed for its meaning; write the prompt in English.

Use these headings, in this order, as plain text:
MASTER PROMPT: <style> <space type> | <time of day and mood>
TASK: one sentence.
1. DESIGN INTENT: 3 to 5 sentences on the atmosphere the brief asks for.
2. STRICT GEOMETRY AND DESIGN PRESERVATION: say the image is the absolute reference and nothing is redesigned. Then a list naming EVERY visible element and where it is: walls, openings, windows and doors, ceiling details, floor levels, furniture, fixtures, sanitary ware, stairs, railings, planting, vehicles, people. End with "Do not add architectural elements that are not in the image. Do not remove any existing element."
3. MATERIALS: one short paragraph per visible surface or element, each starting with its name in capitals (FLOORING:, WALLS:, CEILING:, and so on). Choose real materials that fit the brief. Keep real textures already in the image unless the brief changes them. Flat, untextured colours are placeholders to be replaced with real materials.
4. LIGHTING: follow the brief's time of day. Give colour temperatures in K. Use the light fittings that exist in the image. Say what to avoid (overexposure, harsh hotspots, colour casts).
5. STYLING AND SURROUNDINGS: a few believable accessories or planting, never clutter; what is seen through openings or around the building.
6. RENDER QUALITY: a short list: physically based materials, global illumination, soft contact shadows, accurate reflections and glass, real surface imperfections, balanced exposure, professional architectural photography.
7. CAMERA: keep the exact viewpoint, framing, perspective and lens; straight verticals; no crop, zoom or rotation. Remove any black outline edges from the drawing.
8. PRIORITY: end with exactly "Priority if anything conflicts: architectural accuracy first, then the brief's materials and lighting, then styling."

Rules: describe only what is visible; no markdown symbols such as ** or #; under 900 words. Reply with the prompt only.`;
}

/** Cleans the writer's reply: no markdown fences or bold marks. */
export function cleanMaster(text: string): string {
  return text
    .replace(/^```[a-z]*\n?|```$/gim, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^#+\s*/gm, "")
    .trim();
}

/** A master prompt without an AI read (no analysis key): the brief plus the fixed sections. */
export function localMaster(brief: string): string {
  const b = brief.trim() || "photorealistic, materials and light that suit the design";
  return [
    `MASTER PROMPT: ${b}`,
    "TASK: Turn the provided image into an ultra-photorealistic, professionally photographed architectural visualisation.",
    `1. DESIGN INTENT: ${b}. The result must look like a real, finished project photographed by an architectural photographer, not a 3D model.`,
    "2. STRICT GEOMETRY AND DESIGN PRESERVATION: Treat the image as the absolute reference. Keep every wall, opening, window, door, ceiling detail, floor level, furniture item, fixture and object exactly where it is, with the same size and proportions. Do not add architectural elements that are not in the image. Do not remove any existing element.",
    "3. MATERIALS: Replace flat, untextured colours with real materials that fit the design intent. Keep real textures that are already in the image. Natural texture, subtle variation and believable wear, never flat or plastic.",
    "4. LIGHTING: Lighting that fits the design intent, with realistic soft shadows, indirect light and accurate colour temperature. Use the light fittings that exist in the image. No overexposure or colour cast.",
    "5. STYLING AND SURROUNDINGS: A few believable accessories or planting, never cluttered. Realistic surroundings through openings and around the building.",
    "6. RENDER QUALITY: Physically based materials, global illumination, soft contact shadows, accurate reflections and glass, balanced exposure, professional architectural photography.",
    "7. CAMERA: Keep the exact viewpoint, framing, perspective and lens. Straight verticals. No crop, zoom or rotation. Remove any black outline edges from the drawing.",
    "8. PRIORITY: Priority if anything conflicts: architectural accuracy first, then the brief's materials and lighting, then styling.",
  ].join("\n");
}

/** A reply under the result: the master prompt, then only the change, on the current render. */
export function replyPrompt(base: string, change: string): string {
  const c = change.trim().replace(/\.$/, "");
  return [
    "CHANGE REQUEST",
    "Image 1 is the current render of this design. Make only this change:",
    `${c}.`,
    "Keep everything else exactly as in Image 1: geometry, camera, framing, materials, lighting and styling, except where the change needs it.",
    "",
    "For reference, the brief this render was made from:",
    base.trim(),
  ].join("\n");
}

/** Style ideas that add a phrase to the brief. */
export const STYLE_IDEAS: { label: string; text: string }[] = [
  { label: "Night, warm glow", text: "at night with a warm 2700K glow" },
  { label: "Golden hour", text: "golden hour, low warm sun" },
  { label: "Soft overcast", text: "soft overcast daylight" },
  { label: "Bright midday", text: "bright tropical midday sun" },
  { label: "Modern minimal", text: "modern minimal style" },
  { label: "Luxury hotel", text: "five-star boutique hotel feel" },
  { label: "Khmer contemporary", text: "Khmer contemporary style with teak, rattan and laterite" },
  { label: "Tropical modern", text: "tropical modern with lush planting" },
  { label: "Industrial", text: "industrial style, exposed concrete and black steel" },
  { label: "Indochine", text: "Indochine style, patterned cement tiles and timber shutters" },
];
