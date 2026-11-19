// What David's own side-by-side tests found about each Kie model, and the
// short "guard" lines that correct each model's known habits. The tests ran
// the same input image and prompt through each model, without Material Scan
// (Analysis DNA), so the results show each model on its own.
//
// Test 1 (2026-11-19): line sketch of a cafe interior (fluted green counter,
// timber slat ceiling, mint floor rugs, full-height glazing onto a street
// with trees, buildings and a tower crane) through Seedream 5.5,
// Nano Banana 2.1 and GPT Image 2.6 Sunburst.
//
// To add a test: add or update an entry below. Keep "found" to what the
// pictures actually showed. Guard lines go into the prompt, so keep them
// short, in English, and only about the habit the test caught.

export interface ModelNote {
  /** chip on the model card, e.g. "Most faithful" */
  tag: string;
  /** what the model did well in the test */
  strong: string;
  /** what it changed or got wrong */
  watch: string;
  /** when to pick it */
  pick: string;
  /** lines added to the prompt to correct the model's habits (only with an input image) */
  guard: string[];
  /** test date, YYYY-MM-DD */
  tested: string;
}

export const MODEL_NOTES: Record<string, ModelNote> = {
  "seedream/5-5-image-to-image": {
    tag: "Most faithful",
    strong: "Kept almost everything from the sketch: street, trees, buildings, crane, floor rugs, pendant shapes.",
    watch: "Flat, hazy light and a slightly washed-out colour grade. Added woven seats the sketch did not show.",
    pick: "When the result must match the drawing.",
    guard: [
      "Keep full contrast and true colour; no haze or washed-out grade unless the lighting above asks for it.",
      "Keep furniture finishes plain where the input shows them plain; do not add weaves or patterns.",
    ],
    tested: "2026-11-19",
  },
  "nano-banana-2-1": {
    tag: "Most realistic",
    strong: "The most real-looking result: natural daylight, lush trees, convincing timber and concrete.",
    watch: "Changes design details: dropped the floor rugs, added seat cushions and track lights, recoloured a window frame.",
    pick: "For realistic client and marketing images. Check the details against the drawing.",
    guard: [
      "Keep every floor finish, rug, furniture item and light fitting exactly as in the input; do not add cushions, extra lights or new trims.",
      "Keep every surface in the colour shown in the input.",
    ],
    tested: "2026-11-19",
  },
  "gpt-image-2-6/sunburst-image-to-image": {
    tag: "Render-engine look",
    strong: "Polished V-Ray / D5 style: strong sun patches and shadows, crisp high-end materials.",
    watch: "Changed the most: blew the windows out to white (street and crane gone), stone tiles instead of the drawn floor, leather benches, metal bands on pendants.",
    pick: "For a mood image in a rendered style. Check it has not redesigned anything.",
    guard: [
      "Where the input shows a view through glazing, keep that outside view visible and as drawn (street, trees, buildings, cranes); do not blow the windows out to white.",
      "Keep the floor finish, upholstery and light fittings as in the input; do not swap materials or add decoration.",
    ],
    tested: "2026-11-19",
  },
};

export function modelNote(id: string): ModelNote | null {
  return MODEL_NOTES[id] ?? null;
}

/** Guard lines for the model, as one block to add to the prompt; "" when there are none. */
export function modelGuard(id: string): string {
  const n = MODEL_NOTES[id];
  if (!n?.guard.length) return "";
  return `Model check:\n${n.guard.map((g) => `- ${g}`).join("\n")}`;
}

/** The prompt with the model's guard block appended (only when an input image is sent). */
export function withModelGuard(prompt: string, id: string, hasImage: boolean): string {
  const g = hasImage ? modelGuard(id) : "";
  return g ? `${prompt.trimEnd()}\n\n${g}` : prompt;
}
