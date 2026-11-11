// Checks a finished prompt for instructions that contradict each other
// before anything is spent (audit H-04). Obvious ones are fixed in place.

export interface LintResult {
  prompt: string;
  /** Changes made automatically, in plain words. */
  fixes: string[];
  /** Conflicts left for the user to decide. */
  warnings: string[];
}

const WANTS_TEXT = /\b(plate|number plate|licen[cs]e plate|sign(age)?|lettering|logo|words?)\b[^.\n]*\b(reads?|says?|shows?|with)\b|["“][^"”]{2,30}["”]/i;
const NIGHT = /\b(night|blue hour|after sunset|dusk)\b/i;
const DAY = /\b(midday|noon|morning sun|afternoon sun|golden hour|tropical sun at|high in the sky)\b/i;
const CGI_ASK = /\b(cgi|3d render|v-?ray|corona render|clay render)\b/i;

export function lintPrompt(prompt: string): LintResult {
  const fixes: string[] = [];
  const warnings: string[] = [];
  let lines = prompt.split("\n");
  const notes = lines.filter((l) => /^Additional notes/i.test(l)).join(" ");
  const asksText = WANTS_TEXT.test(notes);

  if (asksText) {
    let changed = false;
    lines = lines.map((l) => {
      if (/^Avoid:/i.test(l) && /\btext\b/i.test(l)) {
        changed = true;
        return l.replace(/,?\s*\btext\b\s*,?/i, (m) => (m.startsWith(",") && m.endsWith(",") ? "," : "")).replace(/:\s*,\s*/, ": ").replace(/,\s*\./, ".");
      }
      if (/No text, no watermark/i.test(l)) {
        changed = true;
        return l.replace(/No text, no watermark/i, "Only the text asked for in the notes, no watermark");
      }
      return l;
    });
    if (changed) fixes.push("Your notes ask for text (a plate or sign), so “no text” was taken out of the avoid list.");
  }

  const lighting = lines.find((l) => /^Lighting:/i.test(l)) ?? "";
  const others = lines.filter((l) => l !== lighting && !/^Avoid:/i.test(l)).join(" ");
  if ((NIGHT.test(lighting) && DAY.test(others)) || (DAY.test(lighting) && NIGHT.test(others) && !/interior lights/i.test(others))) {
    warnings.push("The lighting says one time of day and another line says a different one. Pick one so the light is consistent.");
  }

  const photo = lines.some((l) => /real photograph/i.test(l));
  if (photo && CGI_ASK.test(notes)) warnings.push("The look is set to Photo, but your notes ask for a 3D/CGI render. Switch the look to 3D render, or remove it from the notes.");

  const locked = lines.some((l) => /^Keep the exact geometry/i.test(l));
  const storeyLine = lines.find((l) => !/^(Keep|Image|Treat|Follow|Use the line|Where the materials)/i.test(l) && /\b\d+[- ]storey|\b(one|two|three|four|five|six)[- ]storey/i.test(l));
  if (locked && storeyLine) warnings.push("Geometry is locked, but a line still describes a number of storeys. The model may add or remove floors.");

  return { prompt: lines.join("\n"), fixes, warnings };
}
