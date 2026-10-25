// "SketchUp to Render" in one click: a cheap vision call describes the
// screenshot as JSON, then one universal prompt is filled from it. Nothing
// else from the preset library is added, so leftover settings cannot leak in.

export interface AutoScan {
  scene: "interior" | "exterior" | "aerial";
  space: string;
  style: string;
  surfaces: { element: string; material: string; colour: string }[];
  light_sources: string[];
  openings: number;
  time_hint: "day" | "night" | "unclear";
  placeholders: string[];
  camera: "eye level" | "high angle" | "aerial" | "top down";
}

export const AUTO_ANALYSE_PROMPT = `You are reviewing a screenshot exported from SketchUp. Describe only what is visible. Do not suggest changes.
Return JSON only, using this schema:
{
  "scene": "interior" | "exterior" | "aerial",
  "space": short name, e.g. "bathroom", "living room", "shophouse facade", "villa masterplan",
  "style": short style name, e.g. "modern minimal", "tropical modern", "Indochine", "industrial",
  "surfaces": [ { "element": "floor" | "wall" | "ceiling" | "joinery" | "roof" | "facade" | "ground" | other, "material": real material it represents, "colour": colour } ],
  "light_sources": [ visible fixtures, e.g. "recessed downlights", "wall sconce", "LED strip under vanity" ],
  "openings": number of visible windows and doors with glass,
  "time_hint": "day" | "night" | "unclear",
  "placeholders": [ things that are clearly SketchUp stand-ins, e.g. "flat green ground plane", "white background", "2D tree proxies", "face-me people" ],
  "camera": "eye level" | "high angle" | "aerial" | "top down"
}
If a material is unclear, give the most likely real material for that element in this style.`;

const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v.trim() : fallback);
const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => {
  const s = str(v).toLowerCase() as T;
  return allowed.includes(s) ? s : fallback;
};

/** Reads the analyse reply; null when it has no usable JSON. */
export function parseAutoScan(text: string): AutoScan | null {
  const m = /\{[\s\S]*\}/.exec(text);
  if (!m) return null;
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(m[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
  const scene = pick(raw.scene, ["interior", "exterior", "aerial"] as const, "exterior");
  const surfaces = Array.isArray(raw.surfaces)
    ? raw.surfaces
        .map((x) => x as Record<string, unknown>)
        .map((x) => ({ element: str(x.element), material: str(x.material), colour: str(x.colour) }))
        .filter((x) => x.element && x.material)
    : [];
  const list = (v: unknown) => (Array.isArray(v) ? v.map((x) => str(x)).filter(Boolean) : []);
  return {
    scene,
    space: str(raw.space, scene === "interior" ? "room" : "building"),
    style: str(raw.style, "modern"),
    surfaces,
    light_sources: list(raw.light_sources),
    openings: typeof raw.openings === "number" ? raw.openings : 0,
    time_hint: pick(raw.time_hint, ["day", "night", "unclear"] as const, "unclear"),
    placeholders: list(raw.placeholders),
    camera: pick(raw.camera, ["eye level", "high angle", "aerial", "top down"] as const, scene === "aerial" ? "aerial" : "eye level"),
  };
}

/** What each kind of SketchUp stand-in becomes. */
function placeholderFix(p: string): string | null {
  const s = p.toLowerCase();
  if (/green|ground plane/.test(s)) return "flat green ground plane -> real ground matching the site";
  if (/white|grey|gray|background|sky/.test(s)) return "plain background -> real sky and surroundings";
  if (/tree|plant|palm/.test(s)) return "2D trees -> real tropical trees in the same positions";
  if (/people|person|face-me|figure/.test(s)) return "face-me people -> remove them";
  if (/car|vehicle/.test(s)) return "flat cars -> real cars in the same positions";
  return null;
}

export function buildAutoPrompt(scan: AutoScan): string {
  const surfaces = scan.surfaces.map((x) => `${x.element}: ${x.material}${x.colour ? `, ${x.colour}` : ""}`).join("; ");
  const interior = scan.scene === "interior";
  const time = scan.time_hint === "night" ? "evening" : "late morning";
  const lines = [
    `Turn this SketchUp screenshot into a real architectural photograph of the same ${scan.space}.`,
    "Keep exactly: all geometry, proportions, furniture and object positions, openings, camera position, lens and framing. Do not add, remove or redesign anything. Do not create windows or openings on solid walls.",
    `Style: ${scan.style}.${surfaces ? ` Materials, as real physical materials with natural texture and wear: ${surfaces}.` : ""}`,
    interior
      ? `Light: ${scan.light_sources.length ? `turn on the visible fixtures (${scan.light_sources.join(", ")}) with realistic glow and soft shadows, balanced with daylight from the existing openings` : "soft daylight from the existing openings with realistic soft shadows"}.`
      : `Light: natural ${scan.time_hint === "night" ? "blue-hour sky with warm interior lights glowing" : `${time} daylight with soft shadows`}.`,
  ];
  const fixes = [...new Set(scan.placeholders.map(placeholderFix).filter((x): x is string => Boolean(x)))];
  if (!interior && !fixes.some((f) => f.startsWith("flat green"))) fixes.unshift("flat green ground plane -> real ground matching the site");
  if (!interior && !fixes.some((f) => f.startsWith("plain background"))) fixes.push("plain background -> real sky and surroundings");
  if (fixes.length) lines.push(`Replace SketchUp placeholders with real equivalents: ${fixes.join("; ")}.`);
  lines.push(
    `Camera: ${scan.camera}; straight vertical lines, natural lens, accurate white balance, no colour cast.`,
    "Avoid: CGI look, plastic surfaces, cartoon, oversaturated colour, text, watermark, black outlines.",
  );
  return lines.join("\n");
}
