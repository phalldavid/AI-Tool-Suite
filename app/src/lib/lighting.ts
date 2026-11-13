// Interior / Exterior lighting guidance, the Additional Notes override block,
// and the Reference Style Copy prompt.

export type LightScene = "interior" | "exterior";

/** Detailed lighting instructions for the chosen lighting scene. */
export function lightingGuidance(scene: LightScene): string {
  return scene === "interior"
    ? "Interior lighting: natural daylight entering through the windows, doors and openings, balanced with realistic artificial light from ceiling, recessed, pendant, wall and indirect cove fittings at a believable colour temperature. Soft interior shadows, ambient occlusion and natural light falloff. Keep the view through the windows correctly exposed, not blown out, so indoor and outdoor light feel balanced."
    : "Exterior lighting: natural sunlight and sky light, realistic exterior shadows with the right softness for the time of day, environmental reflections in the glazing, true facade material response and naturally lit landscape, with a believable atmosphere.";
}

const KHMER = /[ក-៿]/;

/**
 * The Additional Notes as the top block of every prompt. Empty when there are no notes,
 * so the prompt never opens with an empty top-priority section.
 */
export function overrideBlock(lines: string[], freeText: string): string {
  const free = freeText.trim();
  const all = [...lines, ...(free ? [`${free}${/[.!?។]$/.test(free) ? "" : "."}`] : [])];
  if (!all.length) return "";
  return [
    "CRITICAL OVERRIDE — Additional Notes (highest priority):",
    ...all.map((l) => `- ${l}`),
    `These notes take precedence over every other rule in this prompt. If anything below conflicts with them, follow these notes.${KHMER.test(free) ? " Some notes are written in Khmer: read them in Khmer and follow them." : ""}`,
    "",
  ].join("\n");
}

/** Put the override block (if any) on top of a prompt. */
export function withOverride(prompt: string, lines: string[], freeText: string): string {
  const top = overrideBlock(lines, freeText);
  return top ? `${top}\n${prompt}` : prompt;
}

export interface StyleCopyInput {
  scene: LightScene;
  /** null = copy the light from the reference photo. */
  dialLight: string | null;
  /** Image 1's shape, so the output keeps its orientation even when Image 2's differs. */
  base?: { width: number; height: number; ratio: string };
}

function orientation(w: number, h: number): string {
  const r = w / h;
  return r > 1.05 ? "landscape (wider than tall)" : r < 0.95 ? "portrait (taller than wide)" : "square";
}

export function styleCopyPrompt(p: StyleCopyInput): string {
  const interior = p.scene === "interior";
  const light = p.dialLight
    ? `Lighting: use this light instead of the light in Image 2: ${p.dialLight}. Keep the colour grading and mood of Image 2.`
    : `Lighting and atmosphere: replicate the lighting of Image 2, including the sun angle, time of day, shadow softness, sky mood and colour temperature${interior ? ", the natural light coming in through the openings and the glow of the interior fittings" : ""}.`;
  const lines = [
    "REFERENCE STYLE COPY",
    "Reference roles: use Image 1 (the SketchUp 3D model) strictly as the structural and geometric base, and Image 2 strictly as the visual, material and lighting reference.",
    "",
    `Task: transform the raw SketchUp screenshot in Image 1 into a finished, photorealistic architectural ${interior ? "interior" : "exterior"} photograph by applying the aesthetic, surface materials, lighting and atmosphere of Image 2 onto the building and scene of Image 1.`,
    "",
    "Keep from Image 1, unchanged:",
    interior
      ? "- The exact room geometry, wall, floor and ceiling positions, openings, stairs, built-in joinery and furniture positions, and spatial layout."
      : "- The exact architectural geometry, massing, rooflines, building proportions, window and door openings, stairs and site layout.",
    "- The exact camera angle, focal length, perspective and framing.",
    p.base
      ? `- Output format: the result must have exactly the same orientation and aspect ratio as Image 1: ${orientation(p.base.width, p.base.height)}, ${p.base.ratio}. Ignore the orientation and aspect ratio of Image 2 completely, even if it is ${orientation(p.base.height, p.base.width).split(" (")[0]}. Do not crop, rotate, pad or re-frame Image 1.`
      : "- Output format: keep the orientation and aspect ratio of Image 1, never those of Image 2. Do not crop, rotate or re-frame Image 1.",
    "- Do not copy the building shape, layout or architecture of Image 2. Take only its style, materials and mood.",
    "",
    "Transfer from Image 2:",
    interior
      ? "- Materials and textures: replace all flat SketchUp surfaces and black edge lines with the real finishes of Image 2: wall, floor and ceiling finishes, timber, stone and fabric tones, joinery and furniture materials, glass and metal reflections."
      : "- Materials and textures: replace all flat SketchUp surfaces and black edge lines with the real materials of Image 2: facade and wall finishes, timber, concrete and stone tones, roofing, glazing reflections and ground paving.",
    `- ${light}`,
    `- ${lightingGuidance(p.scene)}`,
    interior
      ? "- Styling: soft furnishings, plants and decor in the same style and density as Image 2, fitted to the layout of Image 1. Windows show a believable outside view in the mood of Image 2, balanced in exposure with the room."
      : "- Surroundings and planting: trees, ground cover, landscape and background in the botanical style, density and treatment of Image 2, fitted to the site of Image 1.",
    "- Camera feel and colour grading: match the lens feel, depth of field, contrast and colour grading of Image 2, while keeping the camera position and framing of Image 1.",
    "",
    "Straight verticals, no lens distortion. No text, no watermark, no CGI look.",
    "Priority if anything conflicts: geometry of Image 1 > camera and orientation of Image 1 > style of Image 2.",
  ];
  return lines.join("\n");
}
