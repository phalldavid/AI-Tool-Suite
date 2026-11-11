// Presets describe style AND building type. With the geometry lock on, the
// building type must not reach the prompt, or the AI is told two different
// buildings at once (audit H-02). This keeps the style and drops the type.

const STOREYS = /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|single|double|multi|several)[- ](storey|story|level|floor)s?\b|\bstoreys?\b|\bstories\b/i;
const ROOF_FORM = /\b(flat|pitched|hipped|hip|gable|gabled|butterfly|shed|mansard|domed|dome|sawtooth|mono-?pitch|tiered khmer)[- ]roofs?\b/i;
const TYPES =
  /\b(shophouses?|villas?|twin villas?|link ?houses?|town ?houses?|row ?houses?|stilt houses?|towers?|high-rises?|low-rises?|condo(minium)?s?|apartment blocks?|mansions?|warehouses?|bungalows?|skyscrapers?|podium)\b/i;

export interface TypologySplit {
  /** Style text with building-type parts removed. */
  style: string;
  /** The removed parts, to show the user. */
  removed: string[];
}

function isTypeClause(clause: string): boolean {
  const c = clause.trim();
  if (!c) return false;
  if (STOREYS.test(c) || ROOF_FORM.test(c)) return true;
  // "row of shophouses", "a modern villa": short clauses that are mostly a building type.
  const words = c.split(/\s+/).length;
  return TYPES.test(c) && (words <= 5 || /^(a|an|the|row of|block of)\b/i.test(c));
}

export function splitTypology(style: string): TypologySplit {
  const clauses = style.split(/(?<=[,;])\s*/).map((x) => x.replace(/[,;]\s*$/, ""));
  const kept: string[] = [];
  const removed: string[] = [];
  for (const c of clauses) {
    if (!c.trim()) continue;
    (isTypeClause(c) ? removed : kept).push(c.trim());
  }
  return { style: kept.join(", "), removed };
}

/** Building type the style text names, if any (for the mismatch warning). */
export function namedType(style: string): string | null {
  const m = TYPES.exec(style);
  return m ? m[1].toLowerCase().replace(/s$/, "") : null;
}
