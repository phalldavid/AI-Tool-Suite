// Slor Cheam Mode: one press, one call, no analysis step. Learned from Sombok
// (docs/sombok-study): their "Sketchup to Real" preset is a fixed text block the
// model reads together with the image. Ours differs where Sombok was weak:
// - outdoor-only blocks (paving, planting, green ground) are left out indoors;
// - the user's own time, sun, light and notes are kept, never reset;
// - the material list can come free from SketchUp instead of a paid AI scan;
// - the line drawing is sent too when there is one, so geometry is not held by words only.

import { MATERIAL_LOCK, BOUNDARY_LOCK, PLACEHOLDER_RULE, geometryLines } from "./prompt";

export interface SlorCheamInput {
  /** true for exterior and aerial scenes: adds paving, planting and the green-ground fix. */
  outdoor: boolean;
  hasLinePass: boolean;
  lineStrength: number;
  /** "Lighting: ..." from the time dial or light card; null when the Time or Sun controls set it. */
  lighting: string | null;
  /** Lines from the Time, Sun, fittings and dynamic controls, already built. */
  extras: string[];
  /** Lines about light previews and mirrors placed in the model. */
  fixtures?: string[];
  /** Camera line from the SketchUp lens, e.g. "shot with a 28 mm lens ...". */
  lens: string;
  /** Material list read from SketchUp (free). Empty = the material lock alone. */
  materials?: string[];
  avoid?: string;
}

export const SLOR_CHEAM_OPENING =
  "Turn this SketchUp view into a real photograph taken by a professional architectural photographer with a DSLR. Keep the geometry and the textures of the model.";
export const SLOR_CHEAM_CAMERA = "Camera lock: same camera position, angle, lens and framing as the input. Do not crop, zoom or re-frame.";
export const SLOR_CHEAM_GEOMETRY =
  "Geometry lock: do not move, add, remove or resize any building element, opening, furniture or object. Do not create windows or openings on solid walls.";
export const SLOR_CHEAM_HARDSCAPE =
  "Hardscape: make paving, kerbs, steps, drains and ground surfaces real, with visible joints, slight wear and natural rain staining.";
export const SLOR_CHEAM_PLANTING =
  "Planting: turn SketchUp trees, shrubs and green areas into real tropical planting, lawn and soil in the same positions and at the same size.";
export const SLOR_CHEAM_GLASS =
  "Glass and light: real glass with true reflections and see-through depth, never flat, grey or invisible. Artificial lights in neutral-warm LED with high colour rendering and soft natural falloff.";
export const SLOR_CHEAM_PHOTO =
  "Photo look: correct exposure, straight verticals, accurate white balance and natural colour. True-to-life materials at real scale. No text, no watermark, no illustration or CGI look.";

export function buildSlorCheam(i: SlorCheamInput): string {
  const L: string[] = [SLOR_CHEAM_OPENING, SLOR_CHEAM_CAMERA, SLOR_CHEAM_GEOMETRY];
  if (i.hasLinePass) L.push(...geometryLines(i.lineStrength));
  L.push(MATERIAL_LOCK, BOUNDARY_LOCK);
  if (i.materials?.length) L.push(`Material list (one line per surface or object, keep these materials):\n${i.materials.map((m) => `- ${m}`).join("\n")}`);
  if (i.outdoor) L.push(SLOR_CHEAM_HARDSCAPE, SLOR_CHEAM_PLANTING, PLACEHOLDER_RULE);
  if (i.lighting) L.push(`Lighting: ${i.lighting}.`);
  L.push(...i.extras, ...(i.fixtures ?? []));
  L.push(SLOR_CHEAM_GLASS, `Camera: ${i.lens}.`, SLOR_CHEAM_PHOTO);
  const a = i.avoid?.trim();
  if (a) L.push(`Avoid: ${a.replace(/\.$/, "")}.`);
  return L.join("\n");
}
