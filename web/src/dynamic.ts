// Dynamic prompts: small forms that each add one plain sentence to the
// render prompt (time and weather, materials, vehicles, people, accessories).
// Any field left at "No change" is left out of the prompt.

export interface Choice {
  id: string;
  label: string;
  /** Words that go into the prompt. */
  text: string;
}

export interface DynField {
  id: string;
  label: string;
  /** "one" = dropdown, "many" = pick any number of chips */
  kind: "one" | "many";
  choices: Choice[];
  /** shown half width next to the following field */
  half?: boolean;
}

export interface DynGenerator {
  id: string;
  name: string;
  icon: string;
  blurb: string;
  fields: DynField[];
  build(v: DynValues): string | null;
}

/** Field id -> chosen choice id(s). Missing or "" means no change. */
export type DynValues = Record<string, string | string[]>;

const NONE: Choice = { id: "", label: "No change", text: "" };

function one(id: string, label: string, choices: Choice[], half = false): DynField {
  return { id, label, kind: "one", choices: [NONE, ...choices], half };
}

function many(id: string, label: string, choices: Choice[]): DynField {
  return { id, label, kind: "many", choices };
}

function c(id: string, label: string, text = label.toLowerCase()): Choice {
  return { id, label, text };
}

/** Prompt text of the choice picked for a "one" field, or "" for no change. */
export function pick(gen: DynGenerator, v: DynValues, fieldId: string): string {
  const f = gen.fields.find((x) => x.id === fieldId);
  const id = v[fieldId];
  if (!f || typeof id !== "string" || !id) return "";
  return f.choices.find((x) => x.id === id)?.text ?? "";
}

/** Prompt texts of the chips picked for a "many" field. */
export function picks(gen: DynGenerator, v: DynValues, fieldId: string): string[] {
  const f = gen.fields.find((x) => x.id === fieldId);
  const ids = v[fieldId];
  if (!f || !Array.isArray(ids)) return [];
  return f.choices.filter((x) => ids.includes(x.id)).map((x) => x.text);
}

function join(parts: string[]): string {
  const p = parts.filter(Boolean);
  if (p.length <= 1) return p.join("");
  return `${p.slice(0, -1).join(", ")} and ${p[p.length - 1]}`;
}

const SURFACES: Choice[] = [
  c("facade", "Facade walls", "the facade walls"),
  c("columns", "Columns and beams", "the columns and beams"),
  c("roof", "Roof", "the roof"),
  c("floor", "Floor", "the floor"),
  c("ceiling", "Ceiling", "the ceiling"),
  c("feature", "Feature wall", "the feature wall"),
  c("frames", "Window and door frames", "the window and door frames"),
  c("screens", "Sun screens / louvers", "the sun screens and louvers"),
  c("joinery", "Joinery and cabinets", "the joinery and cabinets"),
  c("paving", "Outdoor paving", "the outdoor paving"),
];

const MATERIALS: Choice[] = [
  c("boardconcrete", "Board-formed concrete"),
  c("smoothconcrete", "Smooth fair-faced concrete"),
  c("whiterender", "White painted render", "white painted cement render"),
  c("laterite", "Laterite block", "local laterite block"),
  c("sandstone", "Khmer sandstone", "honed Cambodian sandstone"),
  c("brick", "Exposed red brick", "exposed red clay brick"),
  c("terracotta", "Terracotta tiles", "terracotta clay tiles"),
  c("breeze", "Breeze blocks", "white concrete breeze blocks"),
  c("granite", "Grey granite", "flamed grey granite"),
  c("terrazzo", "Terrazzo"),
  c("polished", "Polished concrete"),
  c("marble", "White marble", "white marble with soft grey veining"),
  c("teak", "Teak timber", "oiled teak timber"),
  c("oak", "Light oak", "light oak timber"),
  c("louvers", "Timber louvers", "vertical hardwood timber louvers"),
  c("bamboo", "Bamboo"),
  c("rattan", "Woven rattan"),
  c("blacksteel", "Black steel", "powder-coated black steel"),
  c("aluminium", "Brushed aluminium"),
  c("glass", "Low-iron glass", "clear low-iron glass"),
  c("ceramic", "Glazed ceramic tile"),
  c("limewash", "Limewash plaster", "warm limewash plaster"),
];

const FINISHES: Choice[] = [
  c("matte", "Matte", "matte finish"),
  c("satin", "Satin", "satin finish"),
  c("polished", "Polished", "polished finish"),
  c("weathered", "Weathered", "lightly weathered with rain streaks"),
  c("brushed", "Brushed", "brushed finish"),
];

function materialRow(n: number): DynField[] {
  return [one(`s${n}`, `Surface ${n}`, SURFACES, true), one(`m${n}`, `Material ${n}`, MATERIALS, true), one(`f${n}`, `Finish ${n}`, FINISHES)];
}

export const GENERATORS: DynGenerator[] = [
  {
    id: "time",
    name: "Time, date and weather",
    icon: "history",
    blurb: "Time of day, Cambodian season, sky and wet ground.",
    fields: [
      one("time", "Time of day", [
        c("dawn", "Dawn, 06:00", "dawn at about 06:00, sun just above the eastern horizon"),
        c("morning", "Morning, 08:30", "morning at about 08:30, low sun from the east"),
        c("noon", "Midday, 12:00", "midday, the sun almost directly overhead, short shadows"),
        c("afternoon", "Afternoon, 15:30", "mid-afternoon, strong sun from the west"),
        c("golden", "Golden hour, 17:30", "golden hour at about 17:30, low warm sun from the west"),
        c("blue", "Blue hour, 18:20", "blue hour just after sunset, deep blue sky, interior and street lights on"),
        c("night", "Night, 20:00", "night, dark sky, warm artificial lighting inside and outside"),
      ]),
      one("season", "Season", [
        c("dry", "Dry season (Dec–Mar)", "dry season, clear dry air, slightly dusty ground, dry grass"),
        c("hot", "Hot season (Apr–May)", "hot season, hazy humid air, strong heat shimmer on paving"),
        c("rainy", "Rainy season (Jun–Oct)", "rainy season, lush green planting, damp surfaces"),
        c("cool", "Cool season (Nov)", "cool season after the rains, fresh green planting, clear sky"),
      ]),
      one("sky", "Sky and weather", [
        c("clear", "Clear sky", "clear blue sky"),
        c("scattered", "Scattered clouds", "scattered white cumulus clouds"),
        c("overcast", "Overcast", "soft even light under an overcast sky, no hard shadows"),
        c("storm", "Storm building", "dark monsoon storm clouds building on the horizon"),
        c("lightrain", "Light rain", "light rain falling, wet surfaces"),
        c("heavyrain", "Heavy monsoon rain", "heavy monsoon rain, visible rain streaks, water running off the roof"),
        c("haze", "Hazy and humid", "hazy humid air softening the distance"),
      ]),
      one("ground", "Ground", [
        c("dry", "Dry", "dry ground"),
        c("damp", "Damp", "damp ground with a soft sheen"),
        c("puddles", "Wet with puddles", "wet ground with puddles reflecting the building and sky"),
      ]),
    ],
    build(v) {
      const g = GENERATORS[0];
      const parts = [pick(g, v, "time"), pick(g, v, "season"), pick(g, v, "sky"), pick(g, v, "ground")].filter(Boolean);
      return parts.length ? `Time and weather: ${parts.join("; ")}. Shadows and sky must match this time and weather.` : null;
    },
  },
  {
    id: "material",
    name: "Material prompt",
    icon: "sketch",
    blurb: "Assign real materials to up to three surfaces.",
    fields: [...materialRow(1), ...materialRow(2), ...materialRow(3)],
    build(v) {
      const g = GENERATORS[1];
      const lines: string[] = [];
      for (const n of [1, 2, 3]) {
        const s = pick(g, v, `s${n}`);
        const m = pick(g, v, `m${n}`);
        const f = pick(g, v, `f${n}`);
        if (!m) continue;
        lines.push(`${s ? `${s} in ` : ""}${m}${f ? `, ${f}` : ""}`);
      }
      return lines.length ? `Materials: ${lines.join("; ")}.` : null;
    },
  },
  {
    id: "vehicles",
    name: "Vehicle prompt",
    icon: "aerial",
    blurb: "Local traffic: motorbikes, tuk-tuks, cars, trucks.",
    fields: [
      many("types", "Vehicle types", [
        c("motorbikes", "Motorbikes", "motorbikes and scooters"),
        c("tuktuks", "Tuk-tuks", "Cambodian tuk-tuks (remorque)"),
        c("cars", "Cars and SUVs", "sedans and SUVs"),
        c("pickups", "Pickup trucks"),
        c("vans", "Delivery vans"),
        c("bicycles", "Bicycles"),
        c("trucks", "Construction trucks"),
      ]),
      one("amount", "How many", [
        c("one", "One or two", "one or two"),
        c("few", "A few", "a few"),
        c("moderate", "Moderate traffic", "a moderate number of"),
        c("busy", "Busy street", "busy traffic of"),
      ], true),
      one("motion", "Moving or parked", [
        c("parked", "Parked", "parked"),
        c("moving", "Moving, slight blur", "moving with slight motion blur"),
        c("mixed", "Mix", "some parked and some moving with slight motion blur"),
      ], true),
      one("where", "Where", [
        c("street", "On the street", "on the street in front"),
        c("kerb", "Along the kerb", "along the kerb"),
        c("driveway", "In the driveway", "in the driveway"),
        c("carport", "Under the carport", "under the carport"),
        c("basement", "Basement parking", "in the parking area"),
      ]),
      one("colour", "Colours", [
        c("neutral", "Neutral", "in white, silver, grey and black"),
        c("mixed", "Mixed", "in mixed realistic colours"),
      ]),
    ],
    build(v) {
      const g = GENERATORS[2];
      const types = picks(g, v, "types");
      if (!types.length) return null;
      const amount = pick(g, v, "amount");
      const motion = pick(g, v, "motion");
      const where = pick(g, v, "where");
      const colour = pick(g, v, "colour");
      return `Vehicles: add ${[amount, motion].filter(Boolean).join(" ")} ${join(types)}${where ? ` ${where}` : ""}${colour ? `, ${colour}` : ""}. Correct scale and perspective, sitting on the ground with contact shadows.`.replace(/\s+/g, " ");
    },
  },
  {
    id: "people",
    name: "Fill people prompt",
    icon: "interior",
    blurb: "Who is in the scene, what they wear and do.",
    fields: [
      one("type", "People type", [
        c("adults", "Adults", "adults"),
        c("families", "Families with children", "families with children"),
        c("professionals", "Young professionals", "young professionals"),
        c("students", "Students", "students"),
        c("elderly", "Elderly", "elderly people"),
        c("staff", "Hotel / shop staff", "staff in neat uniforms"),
        c("monks", "Buddhist monks", "Buddhist monks in saffron robes"),
      ]),
      one("region", "Regional appearance", [
        c("sea", "Southeast Asian", "Southeast Asian"),
        c("khmer", "Cambodian", "Cambodian"),
        c("eastasian", "East Asian", "East Asian"),
        c("southasian", "South Asian", "South Asian"),
        c("european", "European", "European"),
        c("mixed", "Mixed international", "a mix of local and international"),
      ]),
      one("gender", "Gender", [c("mixed", "Mixed", "men and women"), c("men", "Mostly men", "mostly men"), c("women", "Mostly women", "mostly women")], true),
      one("age", "Age group", [
        c("young", "18–30", "aged about 18 to 30"),
        c("mid", "30–50", "aged about 30 to 50"),
        c("old", "60+", "aged over 60"),
        c("mixed", "Mixed ages", "of mixed ages"),
      ], true),
      one("clothing", "Clothing style", [
        c("casual", "Casual tropical", "light casual clothes for hot weather"),
        c("business", "Business casual", "business casual clothes"),
        c("formal", "Formal", "formal clothes"),
        c("traditional", "Traditional Khmer", "traditional Khmer clothing such as sampot and krama scarves"),
        c("school", "School uniforms", "white shirts and navy school uniforms"),
        c("sport", "Sportswear", "sportswear"),
        c("resort", "Resort wear", "relaxed resort wear and sun hats"),
      ]),
      one("activity", "Pose / activity", [
        c("walking", "Walking", "walking"),
        c("talking", "Standing and talking", "standing and talking in small groups"),
        c("sitting", "Sitting", "sitting and relaxing"),
        c("dining", "Eating and drinking", "eating and drinking at tables"),
        c("working", "Working on laptops", "working on laptops"),
        c("shopping", "Shopping", "shopping and browsing"),
        c("umbrellas", "Under umbrellas", "walking under umbrellas"),
        c("swimming", "By the pool", "swimming and lounging by the pool"),
      ]),
      one("density", "People density", [
        c("one", "1–2 people", "one or two people"),
        c("few", "A few (3–6)", "a few people (three to six)"),
        c("moderate", "Moderate", "a moderate number of people"),
        c("busy", "Busy", "a busy crowd"),
      ]),
      one("place", "Placement", [
        c("foreground", "Foreground", "in the foreground"),
        c("mid", "Middle ground", "in the middle ground"),
        c("background", "Background", "in the background"),
        c("entrance", "At the entrance", "near the main entrance"),
        c("street", "Along the street", "along the street and footpath"),
        c("spread", "Spread through the scene", "spread naturally through the scene"),
      ]),
      one("focus", "Sharpness", [c("sharp", "Sharp", "in sharp focus"), c("blur", "Slight motion blur", "with slight motion blur")]),
    ],
    build(v) {
      const g = GENERATORS[3];
      const density = pick(g, v, "density");
      const type = pick(g, v, "type");
      const region = pick(g, v, "region");
      const rest = ["gender", "age", "clothing", "activity", "place", "focus"].map((f) => pick(g, v, f));
      if (!density && !type && !region && !rest.some(Boolean)) return null;
      const who = [density || "some people", region && type ? `${region} ${type}` : region ? `${region} people` : type].filter(Boolean).join(", ");
      const [gender, age, clothing, activity, place, focus] = rest;
      const bits = [gender, age, clothing ? `wearing ${clothing}` : "", activity, place, focus].filter(Boolean);
      return `People: add ${who}${bits.length ? `, ${bits.join(", ")}` : ""}. Natural poses, correct scale against doors and steps, never covering the main facade.`;
    },
  },
  {
    id: "accessories",
    name: "Accessories prompt",
    icon: "lights",
    blurb: "Plants, soft furnishings and styling objects.",
    fields: [
      many("items", "Add", [
        c("soft", "Cushions and throws", "cushions and throws"),
        c("rugs", "Rugs", "woven rugs"),
        c("table", "Tableware", "tableware and a bowl of fruit"),
        c("books", "Books and objects", "books and small decor objects"),
        c("art", "Artwork", "framed artwork"),
        c("lamps", "Table and floor lamps", "table and floor lamps"),
        c("baskets", "Woven baskets", "woven rattan and palm-leaf baskets"),
        c("outdoor", "Outdoor furniture", "outdoor lounge chairs and parasols"),
        c("lanterns", "Lanterns", "paper and rattan lanterns"),
      ]),
      one("style", "Style", [
        c("khmer", "Khmer craft", "in a Khmer craft style with silk, rattan, carved timber and woven textiles"),
        c("minimal", "Minimal modern", "in a minimal modern style"),
        c("resort", "Tropical resort", "in a tropical resort style"),
        c("luxury", "Luxury hotel", "in a refined luxury hotel style"),
        c("colonial", "Indochine", "in an Indochine colonial style"),
      ]),
      one("amount", "Amount", [
        c("minimal", "Minimal", "kept minimal and tidy"),
        c("styled", "Styled", "styled like a magazine shoot"),
        c("lived", "Lived-in", "lived-in and natural, a little casual"),
      ]),
    ],
    build(v) {
      const g = GENERATORS[4];
      const items = picks(g, v, "items");
      const style = pick(g, v, "style");
      const amount = pick(g, v, "amount");
      if (!items.length && !style) return null;
      const what = items.length ? join(items) : "styling objects";
      return `Accessories: add ${what}${style ? ` ${style}` : ""}${amount ? `, ${amount}` : ""}. Do not move walls, windows or built-in furniture.`;
    },
  },
  {
    id: "plants",
    name: "Plants",
    icon: "plant",
    blurb: "Trees, palms, shrubs and indoor plants.",
    fields: [
      many("kinds", "Plants", [
        c("frangipani", "Frangipani", "frangipani trees"),
        c("areca", "Areca palms", "areca palms"),
        c("foxtail", "Foxtail palms", "foxtail palms"),
        c("coconut", "Coconut palms", "coconut palms"),
        c("sugarpalm", "Sugar palms", "Cambodian sugar palms"),
        c("raintree", "Rain trees", "large spreading rain trees"),
        c("mango", "Mango trees", "mango trees"),
        c("bougainvillea", "Bougainvillea", "bougainvillea in pink and magenta flower"),
        c("banana", "Banana plants", "banana plants"),
        c("bird", "Bird of paradise", "bird of paradise plants"),
        c("bamboo", "Bamboo", "clumps of bamboo"),
        c("ferns", "Ferns and ground cover", "ferns and low ground cover"),
        c("hedge", "Clipped hedges", "clipped green hedges"),
        c("lawn", "Lawn", "a neat green lawn"),
        c("lotus", "Lotus pond", "a lotus pond"),
        c("monstera", "Monstera (indoor)", "potted monstera"),
        c("fiddle", "Fiddle-leaf fig (indoor)", "potted fiddle-leaf figs"),
        c("pothos", "Hanging pothos (indoor)", "trailing pothos on shelves"),
      ]),
      one("where", "Where", [
        c("front", "Front garden", "in the front garden"),
        c("fence", "Along the boundary wall", "along the boundary wall"),
        c("street", "As street trees", "as street trees along the road"),
        c("balcony", "Planters on balconies", "in planters on the balconies"),
        c("roof", "Roof garden", "on the roof garden"),
        c("pool", "Around the pool", "around the pool"),
        c("indoor", "Indoors in pots", "indoors in ceramic and woven pots"),
        c("spread", "Spread through the scene", "spread naturally through the scene"),
      ]),
      one("density", "Density", [
        c("sparse", "Sparse", "sparse"),
        c("moderate", "Moderate", "moderate"),
        c("lush", "Lush", "lush and full"),
      ], true),
      one("age", "Maturity", [
        c("new", "Newly planted", "newly planted with stakes"),
        c("established", "Established", "established"),
        c("mature", "Mature", "mature and fully grown"),
      ], true),
      one("season", "Look", [
        c("green", "Rainy season green", "deep rainy-season green"),
        c("dry", "Dry season", "slightly dry, dusty dry-season leaves"),
        c("flower", "In flower", "in full flower"),
      ]),
    ],
    build(v) {
      const g = GENERATORS[5];
      const kinds = picks(g, v, "kinds");
      const where = pick(g, v, "where");
      if (!kinds.length && !where) return null;
      const bits = [pick(g, v, "density"), pick(g, v, "age"), pick(g, v, "season")].filter(Boolean);
      return `Plants: add ${kinds.length ? join(kinds) : "tropical planting"}${where ? ` ${where}` : ""}${bits.length ? `, ${bits.join(", ")}` : ""}. Real species at true size, never covering windows, doors or the main facade.`;
    },
  },
];

export function findGenerator(id: string): DynGenerator | undefined {
  return GENERATORS.find((g) => g.id === id);
}

/** One prompt line per generator that has anything set, in a fixed order. */
export function dynamicLines(all: Record<string, DynValues>): string[] {
  const out: string[] = [];
  for (const g of GENERATORS) {
    const v = all[g.id];
    if (!v) continue;
    const line = g.build(v);
    if (line) out.push(line);
  }
  return out;
}

/** How many fields are set in one generator, for the badge on its card. */
export function countSet(v: DynValues | undefined): number {
  if (!v) return 0;
  return Object.values(v).filter((x) => (Array.isArray(x) ? x.length > 0 : Boolean(x))).length;
}
