// Adaptive Style Match: puts the look of a reference image (materials,
// light, colour grade, sky) onto the user's view without moving anything.
// Image 1 is always the target and Image 2 the reference.

export type TransferPart = "materials" | "lighting" | "grade" | "sky";
export type MatchStrength = "subtle" | "balanced" | "strong";

export const TRANSFER_PARTS: { id: TransferPart; label: string; text: string }[] = [
  { id: "materials", label: "Materials", text: "materials, textures and their colours" },
  { id: "lighting", label: "Lighting", text: "lighting direction, softness and colour temperature" },
  { id: "grade", label: "Colour grade", text: "overall colour grade, contrast and exposure" },
  { id: "sky", label: "Environment / sky", text: "sky, weather and surroundings seen through openings or behind the building" },
];

export const MATCH_STRENGTHS: { id: MatchStrength; label: string; text: string }[] = [
  { id: "subtle", label: "Subtle", text: "keep Image 1's own materials, only match the lighting and colour grade of Image 2" },
  { id: "balanced", label: "Balanced", text: "match the materials and lighting of Image 2, but keep Image 1's layout of materials (which surface gets which kind of material)" },
  { id: "strong", label: "Strong", text: "fully adopt the material palette, lighting and mood of Image 2" },
];

export function buildStyleMatchPrompt(parts: TransferPart[], strength: MatchStrength, notes = ""): string {
  const chosen = TRANSFER_PARTS.filter((p) => parts.includes(p.id));
  const list = (chosen.length ? chosen : TRANSFER_PARTS).map((p) => p.text).join("; ");
  const strengthText = (MATCH_STRENGTHS.find((s) => s.id === strength) ?? MATCH_STRENGTHS[1]).text;
  const lines = [
    "ADAPTIVE STYLE MATCH",
    "Image 1 = TARGET. It defines everything that has a shape: walls, openings, floor and ceiling levels, furniture, objects, their sizes and positions, camera position, lens and framing.",
    "Image 2 = REFERENCE. Use it only for how surfaces and light look.",
    "Step 1 - Lock Image 1. Treat it as a fixed 3D scene. Do not add, remove, move, resize or redesign anything. Keep the exact camera, perspective and crop. Keep every door, window and opening exactly where it is; do not create new ones.",
    `Step 2 - Read Image 2 for: ${list}.`,
    "Step 3 - Apply those qualities to the matching surfaces in Image 1 (floor to floor, wall to wall, joinery to joinery, sky to sky). If Image 2 has no match for a surface, give it a material that fits the same palette.",
    `Step 4 - Transfer strength: ${strengthText}.`,
  ];
  const n = notes.trim().replace(/\.$/, "");
  if (n) lines.push(`Also: ${n}.`);
  lines.push(
    "Step 5 - Output one photorealistic architectural photograph, straight verticals, natural exposure, no text, no watermark.",
    "Priority if anything conflicts: geometry of Image 1 > camera of Image 1 > look of Image 2.",
  );
  return lines.join("\n");
}
